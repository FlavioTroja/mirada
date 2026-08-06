import { Service } from "fastify-decorators";
import { Prisma } from "@prisma/client";
import { Log } from "@utils/adapters/log";
import { ConfigRepository } from "@repositories/ConfigRepository";
import { NO_PRESALE_RIGHTS, PresaleRightsPolicy } from "@utils/helpers/presaleRights";

/** Ambito delle righe di `Config` che governano il checkout. */
export const CHECKOUT_CONFIG_SCOPE = "checkout";

/** Nomi delle righe di `Config` — chiavi primarie della tabella, non stringhe libere. */
export const CheckoutConfigKey = {
    RESERVATION_MINUTES: "checkout.reservationMinutes",
    REARM_MINUTES: "checkout.rearmMinutes",
    PRESALE_RIGHTS_FIXED_CENTS: "checkout.presaleRightsFixedCents",
    PRESALE_RIGHTS_BASIS_POINTS: "checkout.presaleRightsBasisPoints",
    PRESALE_RIGHTS_MIN_CENTS: "checkout.presaleRightsMinCents",
    PRESALE_RIGHTS_MAX_CENTS: "checkout.presaleRightsMaxCents",
} as const;

/**
 * `RF-PAY-25` — quindici minuti, **parametro di piattaforma e non scelta
 * dell'organizzatore**, e **sempre attivo su qualunque evento**
 * indipendentemente dalla disponibilità residua.
 */
export const DEFAULT_RESERVATION_MINUTES = 15;

/** `RF-PAY-22` — riarmo ad **almeno dieci minuti residui** all'avvio del pagamento. */
export const DEFAULT_REARM_MINUTES = 10;

/**
 * # I parametri di piattaforma del checkout — backend-brief §4.11
 *
 * Un servizio a sé perché la loro natura è **dichiarata**: la durata della
 * prenotazione è «parametro di piattaforma, **non scelta dell'organizzatore**»
 * (`RF-PAY-25`), e i diritti di prevendita sono ricavo della piattaforma
 * (`RB1`). Nessuno dei due appartiene all'evento, e tenerli in un servizio
 * separato è ciò che impedisce che ci finiscano un giorno per comodità: qui non
 * arriva alcun `eventId`, quindi non c'è modo di farli dipendere dall'evento.
 *
 * ── Perché `Config` e non variabili d'ambiente ───────────────────────────────
 * `Config` è la tabella dei parametri della foundation (§1.2): è leggibile
 * dall'interfaccia, ha un tipo dichiarato, si cambia senza un rilascio e la
 * modifica lascia traccia. Una tariffa che cambia con un deploy è una tariffa
 * che nessuno cambia.
 *
 * Il valore di serie è restituito quando la riga non esiste: il sistema funziona
 * su un database appena migrato, che è la condizione della suite di test.
 */
@Service()
export class CheckoutPolicyService {
    constructor(private readonly configRepository: ConfigRepository) {}

    /**
     * Durata della prenotazione, in minuti. **Sempre attiva**: non esiste un
     * percorso che la disattivi «perché ci sono ancora posti». La scarsità di un
     * evento è una condizione che cambia fra il primo e il quindicesimo minuto,
     * e un impegno che valesse solo sugli eventi scarsi renderebbe la capienza
     * non impegnata proprio dove nessuno la sta guardando (`RF-PAY-25`).
     */
    public async reservationMinutes(tx?: Prisma.TransactionClient): Promise<number> {
        return this.readInteger(CheckoutConfigKey.RESERVATION_MINUTES, DEFAULT_RESERVATION_MINUTES, tx);
    }

    /** Minuti residui garantiti dal riarmo all'avvio del pagamento (`RF-PAY-22`). */
    public async rearmMinutes(tx?: Prisma.TransactionClient): Promise<number> {
        return this.readInteger(CheckoutConfigKey.REARM_MINUTES, DEFAULT_REARM_MINUTES, tx);
    }

    /**
     * Tariffa dei diritti di prevendita. **Default a zero**: l'importo non è
     * deciso dal committente e il §5 vieta di inventarlo. Vedi la nota estesa in
     * `@utils/helpers/presaleRights`.
     */
    public async presaleRights(tx?: Prisma.TransactionClient): Promise<PresaleRightsPolicy> {
        const [fixedCents, basisPoints, minCents, maxCents] = await Promise.all([
            this.readInteger(CheckoutConfigKey.PRESALE_RIGHTS_FIXED_CENTS, NO_PRESALE_RIGHTS.fixedCents, tx),
            this.readInteger(CheckoutConfigKey.PRESALE_RIGHTS_BASIS_POINTS, NO_PRESALE_RIGHTS.basisPoints, tx),
            this.readNullableInteger(CheckoutConfigKey.PRESALE_RIGHTS_MIN_CENTS, tx),
            this.readNullableInteger(CheckoutConfigKey.PRESALE_RIGHTS_MAX_CENTS, tx),
        ]);

        return { fixedCents, basisPoints, minCents, maxCents };
    }

    // ─────────────────────────────────────────────────────────────────────────

    private async readInteger(name: string, fallback: number, tx?: Prisma.TransactionClient): Promise<number> {
        const row = await this.configRepository.findOne({ name }, undefined, tx);
        if (!row || row.integer === null || row.integer === undefined) {
            Log.debug(`[CheckoutPolicy Service]: config '${name}' not set — falling back to ${fallback}`);
            return fallback;
        }
        return row.integer;
    }

    private async readNullableInteger(name: string, tx?: Prisma.TransactionClient): Promise<number | null> {
        const row = await this.configRepository.findOne({ name }, undefined, tx);
        return row?.integer ?? null;
    }
}
