import { Service } from "fastify-decorators";
import { EventService as EventServiceModel, Prisma, TicketType } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { presaleRightsForTicket, PresaleRightsPolicy } from "@utils/helpers/presaleRights";
import { readI18nText } from "@utils/helpers/i18nText";
import { TicketTypeRepository } from "@repositories/TicketTypeRepository";
import { EventServiceRepository } from "@repositories/EventServiceRepository";
import { TicketTypeService } from "@services/TicketTypeService";
import { CheckoutPolicyService } from "@services/CheckoutPolicyService";

/** Una riga di carrello vista dal calcolo del denaro: **nessun prezzo in ingresso**. */
export type PricedLineRequest = {
    ticketTypeId?: number | null;
    eventServiceId?: number | null;
    quantity: number;
};

/**
 * L'esito del calcolo di **una** riga, in centesimi interi (§3.1).
 *
 * `presaleRightsPerUnit` è per **biglietto**, non per riga e non per ordine
 * (`RF-PAY-35`): `lineTotal = (unitPrice + presaleRightsPerUnit) × quantity`.
 */
export type PricedLine = {
    ticketTypeId: number | null;
    eventServiceId: number | null;
    quantity: number;
    unitPrice: number;
    presaleRightsPerUnit: number;
    lineTotal: number;
    /** Scaglione da cui viene il prezzo bloccato — `null` sul prezzo base e sui servizi. */
    priceTierId: number | null;
    /** Etichetta umana della riga, per la ricevuta e per i log. Mai verso il client come prezzo. */
    label: string;
};

/** I totali di un ordine, sempre ricalcolati e mai accettati dal client. */
export type PricedTotals = {
    subtotal: number;
    presaleRights: number;
    total: number;
};

/**
 * # Il calcolo del denaro — backend-brief §4.11, `RF-PAY-35`, `RB1`
 *
 * Un servizio a sé, e non un metodo privato di `OrderService`, per una ragione
 * sola: **il denaro non deve stare dove sta l'orchestrazione**. Chi legge questo
 * file vede tutto ciò che determina quanto paga un partecipante, e non deve
 * leggere altro; chi legge `OrderService` non trova una moltiplicazione in cui
 * infilare per sbaglio uno sconto.
 *
 * ── Le due regole che questo file esiste per far rispettare ──────────────────
 *
 * 1. **Nessun prezzo arriva mai dal client** (§4.11). `PricedLineRequest` non ha
 *    un campo prezzo, e non è un'omissione: è la forma che rende impossibile
 *    l'errore. *Un prezzo che arriva dal client è un difetto di sicurezza.*
 * 2. **I diritti di prevendita si calcolano per biglietto, non per ordine**
 *    (`RF-PAY-35`). È ciò che rende la suddivisione del carrello in un ordine per
 *    organizzatore (`RF-PAY-34`) **invisibile al totale complessivo**: sommando
 *    per riga e poi per ordine, il totale che il partecipante paga è lo stesso
 *    qualunque sia il numero di ordini in cui il carrello è finito. Con una quota
 *    per ordine, comprare da due organizzatori costerebbe due volte i diritti —
 *    cioè far pagare all'utente una scelta di architettura della piattaforma.
 *
 * ── I servizi accessori e i diritti di prevendita ────────────────────────────
 * `RF-PAY-35` dice **per biglietto**. Un servizio accessorio — una cena, un
 * transfer — **non è un biglietto**: non porta capienza di sala, non produce un
 * `Ticket`, non è un titolo d'ingresso. I diritti di prevendita si applicano
 * perciò alle sole righe di **titolo**, e una riga di servizio porta
 * `presaleRightsPerUnit = 0`. Dichiarato qui perché è una lettura del testo, non
 * un fatto scritto altrove: vedi il punto 3+1 nel rapporto.
 *
 * ── Tutto in centesimi interi ────────────────────────────────────────────────
 * Nessun `float` compare in questo file. La divisione per euro esiste **solo**
 * nella stampa della ricevuta (`OrderDocumentService`), dove il destinatario è un
 * essere umano e non un contatore.
 */
@Service()
export class OrderPricingService {
    constructor(
        private readonly ticketTypeRepository: TicketTypeRepository,
        private readonly eventServiceRepository: EventServiceRepository,
        private readonly ticketTypeService: TicketTypeService,
        private readonly checkoutPolicyService: CheckoutPolicyService,
    ) {}

    /**
     * La tariffa corrente della piattaforma. Si legge **una volta per ordine** e
     * si passa a `priceLine`: due righe dello stesso carrello non possono essere
     * valutate con due tariffe diverse perché la configurazione è cambiata a
     * metà del calcolo.
     */
    public async policy(tx?: Prisma.TransactionClient): Promise<PresaleRightsPolicy> {
        return this.checkoutPolicyService.presaleRights(tx);
    }

    /**
     * Il prezzo di **una** riga, risolto dal server.
     *
     * - **Titolo d'ingresso** → `TicketTypeService.resolvePrice`, che valuta gli
     *   scaglioni nell'ordine dichiarato dall'organizzatore e restituisce anche
     *   `priceTierId`. È quel `priceTierId`, scritto sulla riga d'ordine, che
     *   rende verificabile il **blocco del prezzo** di `RF-EVT-27`: si sa da
     *   quale scaglione veniva il prezzo, non solo quanto valeva.
     * - **Servizio accessorio** → il suo `price`, che non ha scaglioni: un
     *   servizio non ha *early bird*, e inventargliene uno sarebbe inventare una
     *   funzione che nessuno ha chiesto.
     */
    public async priceLine(
        line: PricedLineRequest,
        policy: PresaleRightsPolicy,
        tx?: Prisma.TransactionClient,
    ): Promise<PricedLine> {
        if (line.quantity <= 0) {
            Log.warn(`[OrderPricing Service]: pricing refused — a line cannot have quantity ${line.quantity}`);
            throw new httpErrors.BadRequest("La quantità di una riga d'ordine deve essere almeno 1.");
        }

        if (line.ticketTypeId) {
            return this.priceTicketTypeLine(line.ticketTypeId, line.quantity, policy, tx);
        }
        if (line.eventServiceId) {
            return this.priceEventServiceLine(line.eventServiceId, line.quantity, tx);
        }

        Log.warn("[OrderPricing Service]: pricing refused — the line carries neither a ticket type nor an event service");
        throw new httpErrors.BadRequest(
            "Una riga d'ordine porta un titolo d'ingresso oppure un servizio accessorio, non nessuno dei due.",
        );
    }

    /**
     * Somma le righe **già valutate**. Non ricalcola nulla: se i totali e le
     * righe potessero divergere, il documento e il contatore direbbero due cose
     * diverse sullo stesso ordine.
     */
    public totals(lines: { unitPrice: number; presaleRightsPerUnit: number; quantity: number }[]): PricedTotals {
        const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
        const presaleRights = lines.reduce((sum, line) => sum + line.presaleRightsPerUnit * line.quantity, 0);
        return { subtotal, presaleRights, total: subtotal + presaleRights };
    }

    // ─────────────────────────────────────────────────────────────────────────

    private async priceTicketTypeLine(
        ticketTypeId: number,
        quantity: number,
        policy: PresaleRightsPolicy,
        tx?: Prisma.TransactionClient,
    ): Promise<PricedLine> {
        const ticketType: TicketType | null = await this.ticketTypeRepository.findOne(
            { id: ticketTypeId, deleted: false },
            undefined,
            tx,
        );
        if (!ticketType) {
            Log.warn(`[OrderPricing Service]: pricing refused — ticket type (id ${ticketTypeId}) not found`);
            throw new httpErrors.NotFound("Titolo d'ingresso non trovato.");
        }

        // Il prezzo lo decide il server, sempre: stessa risoluzione che alimenta
        // la disponibilità pubblica, così il prezzo mostrato e quello bloccato in
        // checkout non possono divergere.
        const resolved = await this.ticketTypeService.resolvePrice(ticketTypeId, {}, tx);
        const unitPrice = resolved.price;

        // `RF-PAY-35` — per BIGLIETTO. Il proporzionale segue il prezzo BLOCCATO:
        // chi entra sull'early bird paga i diritti dell'early bird.
        const presaleRightsPerUnit = presaleRightsForTicket(unitPrice, policy);

        const priced: PricedLine = {
            ticketTypeId,
            eventServiceId: null,
            quantity,
            unitPrice,
            presaleRightsPerUnit,
            lineTotal: (unitPrice + presaleRightsPerUnit) * quantity,
            priceTierId: resolved.priceTierId ?? null,
            label: readI18nText(ticketType.name, `Titolo #${ticketTypeId}`)!,
        };

        Log.debug(
            `[OrderPricing Service]: priced ticket type (id ${ticketTypeId}) × ${quantity} — `
            + `${unitPrice} + ${presaleRightsPerUnit} presale cents per unit `
            + `from tier ${priced.priceTierId ?? "none (base price)"}, line total ${priced.lineTotal}`,
        );
        return priced;
    }

    private async priceEventServiceLine(
        eventServiceId: number,
        quantity: number,
        tx?: Prisma.TransactionClient,
    ): Promise<PricedLine> {
        const service: EventServiceModel | null = await this.eventServiceRepository.findOne(
            { id: eventServiceId, deleted: false },
            undefined,
            tx,
        );
        if (!service) {
            Log.warn(`[OrderPricing Service]: pricing refused — event service (id ${eventServiceId}) not found`);
            throw new httpErrors.NotFound("Servizio accessorio non trovato.");
        }

        const priced: PricedLine = {
            ticketTypeId: null,
            eventServiceId,
            quantity,
            unitPrice: service.price,
            // Un servizio accessorio non è un biglietto: nessun diritto di
            // prevendita. Vedi la nota in testa al file.
            presaleRightsPerUnit: 0,
            lineTotal: service.price * quantity,
            priceTierId: null,
            label: readI18nText(service.name, `Servizio #${eventServiceId}`)!,
        };

        Log.debug(
            `[OrderPricing Service]: priced event service (id ${eventServiceId}) × ${quantity} — `
            + `${service.price} cents per unit, no presale rights, line total ${priced.lineTotal}`,
        );
        return priced;
    }
}
