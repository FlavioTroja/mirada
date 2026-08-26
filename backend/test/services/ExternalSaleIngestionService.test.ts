import { configureServiceTest } from "fastify-decorators/testing";
import {
    DeclaredDanceRole,
    ExternalSaleStatus,
    QuotaReservedFor,
    QuotaScope,
    RegistrationChannel,
    RegistrationStatus,
    SalesChannelStatus,
    TicketStatus,
} from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";
import { ExternalSaleIngestionService } from "@services/ExternalSaleIngestionService";
import { MailService } from "@mail/MailService";
import { QrImageService } from "@mail/QrImageService";
import { ShopifyChannelAdapterService } from "@services/ShopifyChannelAdapterService";
import { createEventScenario, createQuota, readConsumed } from "../fixtures/capacity";
import {
    addDepositCode,
    connectShopifyChannel,
    mapProduct,
    setCheckoutFields,
    shopifyOrderPayload,
    signedDelivery,
    waitForSale,
} from "../fixtures/salesChannel";

/**
 * # L'ingestione delle vendite esterne — fase E
 *
 * La regola che questa suite difende è la stessa di `RB20`, applicata a un caso
 * nuovo: **una vendita già incassata non può essere rifiutata**. Il denaro si è
 * mosso su un negozio che non è nostro, e Mirada non può disfarlo — può solo
 * registrare, avvisare, e non perdere nulla per strada.
 *
 * Le tre cose che, se si rompessero, si scoprirebbero soltanto all'ingresso:
 *  - la **firma** (una notifica non firmata non deve entrare);
 *  - l'**idempotenza** (la stessa consegna due volte non emette due biglietti);
 *  - la **quarantena** (ciò che non si sa tradurre non si perde).
 */
describe("ExternalSaleIngestionService — la vendita incassata non si rifiuta", () => {
    let ingestion: ExternalSaleIngestionService;
    let adapter: ShopifyChannelAdapterService;
    let sentMails: { to: string; input: any; localeHint?: string | null }[];

    /**
     * ── Le due sole sostituzioni, e perché sono legittime ────────────────────
     * Il database è **vero**, come impone la regola 1 di `testing.md`: qui non
     * si sostituisce nulla di ciò che è sotto collaudo. Si sostituiscono i due
     * confini verso il mondo esterno.
     *
     * `MailService` diventa un registratore, perché l'asserzione che conta è
     * *«è partita un'email all'acquirente del negozio con i codici giusti»*, e
     * senza un registratore la si potrebbe fare solo leggendo un log.
     *
     * `QrImageService` restituisce `null` — che è già il suo comportamento
     * quando il disegno fallisce, e che il modello di email gestisce da sé
     * lasciando il codice in chiaro. Non è per evitare un effetto collaterale:
     * è per il tempo. Il disegno di un QR costa **162 ms sul compilato e oltre
     * 13 s sotto `ts-jest`**, misurati: la strumentazione di Jest rende
     * `pngjs` due ordini di grandezza più lento, e tredici casi di collaudo
     * diventerebbero minuti di attesa per collaudare un PNG che ha già i suoi
     * di collaudi.
     */
    beforeAll(async () => {
        sentMails = [];
        const mocks = [
            {
                provide: MailService,
                useValue: {
                    sendRegistrationConfirmed: async (
                        to: string,
                        input: any,
                        _images?: unknown,
                        localeHint?: string | null,
                    ) => {
                        sentMails.push({ to, input, localeHint });
                    },
                },
            },
            { provide: QrImageService, useValue: { ticketQr: async () => null } },
        ];

        ingestion = await configureServiceTest({ service: ExternalSaleIngestionService, mocks });
        adapter = await configureServiceTest({ service: ShopifyChannelAdapterService });
    });

    beforeEach(() => {
        sentMails = [];
    });

    /** Un evento che gestisce i canali esterni, con il proprio contingente. */
    async function externalChannelEvent() {
        const scenario = await createEventScenario();
        await getPrismaClient().event.update({
            where: { id: scenario.event.id },
            data: { manageExternalChannels: true },
        });
        const { channel, webhookSecret } = await connectShopifyChannel({ organizationId: scenario.organizationId });
        return { scenario, channel, webhookSecret };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Il percorso felice
    // ═════════════════════════════════════════════════════════════════════════

    it("una notifica FIRMATA di ordine pagato produce iscrizioni, biglietti e consumo di capienza", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });

        const room = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.EVENT,
            limit: 100,
            consumed: 0,
        });
        const contingent = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.EVENT,
            limit: 20,
            consumed: 0,
            reservedFor: QuotaReservedFor.EXTERNAL_CHANNEL,
        });

        const payload = shopifyOrderPayload({ lines: [{ productId: "P1", quantity: 2 }] });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret });

        const outcome = await ingestion.receive(channel.publicId, rawBody, headers);
        expect(outcome.duplicate).toBe(false);
        expect(outcome.scheduled).toBe(true);

        const sale = await waitForSale(channel.id, String(payload.id));
        expect(sale.status).toBe(ExternalSaleStatus.INGESTED);
        expect(sale.eventId).toBe(scenario.event.id);
        expect(sale.buyerName).toBe("Giulia");
        expect(sale.buyerSurname).toBe("Rossi");
        // `"90.00"` → 9000 centesimi, passando dalle cifre e non da `parseFloat`.
        expect(sale.totalAmount).toBe(9_000);

        const registrations = await getPrismaClient().registration.findMany({ where: { externalSaleId: sale.id } });
        expect(registrations).toHaveLength(2);
        // Il canale è quello che il `05` §5 dichiara, e lo stato è confermato:
        // ciò che manca è il ruolo, non il pagamento.
        expect(registrations.every(r => r.channel === RegistrationChannel.EXTERNAL_CHANNEL)).toBe(true);
        expect(registrations.every(r => r.status === RegistrationStatus.CONFIRMED)).toBe(true);

        const tickets = await getPrismaClient().ticket.findMany({ where: { externalSaleId: sale.id } });
        expect(tickets).toHaveLength(2);
        expect(tickets.every(t => t.status === TicketStatus.VALID && !t.bearer)).toBe(true);

        // I due contatori si sono mossi: la sala **e** il contingente riservato
        // ai canali esterni, che è ciò che rende il modello «uno specchio» e non
        // una seconda vendita.
        expect(await readConsumed(room.id)).toBe(2);
        expect(await readConsumed(contingent.id)).toBe(2);
    });

    it("RF-COM-1 — l'acquirente del NEGOZIO riceve l'email con i suoi biglietti", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });

        const payload = shopifyOrderPayload({
            email: "chi.ha.comprato@example.it",
            firstName: "Marta",
            lastName: "Bianchi",
            totalPrice: "180.00",
            lines: [{ productId: "P1", quantity: 2 }],
        });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret });
        await ingestion.receive(channel.publicId, rawBody, headers);

        const sale = await waitForSale(channel.id, String(payload.id));
        const tickets = await getPrismaClient().ticket.findMany({ where: { externalSaleId: sale.id } });

        // L'email parte DOPO il commit: si attende che arrivi, non si dà per
        // scontato che sia già partita quando la vendita risulta ingerita.
        const deadline = Date.now() + 5_000;
        while (Date.now() < deadline && !sentMails.length) {
            await new Promise(resolve => setTimeout(resolve, 25));
        }

        expect(sentMails).toHaveLength(1);
        // Va all'indirizzo del NEGOZIO, non a un utente di Mirada: chi compra su
        // Shopify un account qui non ce l'ha, ed è precisamente il caso che
        // renderebbe l'email impossibile da recapitare se la si cercasse in `User`.
        expect(sentMails[0]!.to).toBe("chi.ha.comprato@example.it");
        expect(sentMails[0]!.input.firstName).toBe("Marta");
        expect(sentMails[0]!.input.eventSlug).toBe(scenario.event.slug);
        // L'importo è quello incassato dal negozio: è l'unico che l'acquirente
        // abbia visto, e l'unico in cui può riconoscersi.
        expect(sentMails[0]!.input.total).toBe(18_000);

        const codes = sentMails[0]!.input.tickets.map((t: { code: string }) => t.code).sort();
        expect(codes).toEqual(tickets.map(t => t.code).sort());
        expect(sentMails[0]!.input.tickets.every((t: { holder: string }) => t.holder === "Marta Bianchi")).toBe(true);
    });

    it("una vendita in QUARANTENA non manda nessuna email: non c'è ancora nulla da consegnare", async () => {
        const { channel, webhookSecret } = await externalChannelEvent();

        const payload = shopifyOrderPayload({ lines: [{ productId: "SCONOSCIUTO", quantity: 1 }] });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret });
        await ingestion.receive(channel.publicId, rawBody, headers);

        const sale = await waitForSale(channel.id, String(payload.id));
        expect(sale.status).toBe(ExternalSaleStatus.QUARANTINED);
        await new Promise(resolve => setTimeout(resolve, 200));
        expect(sentMails).toHaveLength(0);
    });

    it("`seatsPerUnit` — un pacchetto coppia venduto come un articolo vale DUE posti", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({
            salesChannelId: channel.id,
            externalProductId: "COPPIA",
            ticketTypeId: scenario.ticketTypeId,
            seatsPerUnit: 2,
        });

        const payload = shopifyOrderPayload({ lines: [{ productId: "COPPIA", quantity: 1 }] });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret });
        await ingestion.receive(channel.publicId, rawBody, headers);

        const sale = await waitForSale(channel.id, String(payload.id));
        const registrations = await getPrismaClient().registration.findMany({ where: { externalSaleId: sale.id } });
        expect(registrations).toHaveLength(2);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // La firma
    // ═════════════════════════════════════════════════════════════════════════

    it("una notifica con firma SBAGLIATA è rifiutata e non lascia traccia", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });

        const payload = shopifyOrderPayload({ lines: [{ productId: "P1", quantity: 1 }] });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret: "un-altro-segreto" });

        await expect(ingestion.receive(channel.publicId, rawBody, headers)).rejects.toMatchObject({ statusCode: 401 });

        // Nemmeno la riga di registro: ciò che non è firmato non è nostro.
        const recorded = await getPrismaClient().externalSaleEvent.count({ where: { salesChannelId: channel.id } });
        expect(recorded).toBe(0);
        expect(await getPrismaClient().externalSale.count({ where: { salesChannelId: channel.id } })).toBe(0);
    });

    it("il corpo alterato dopo la firma non passa — è l'HMAC sui BYTE, non sull'oggetto", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });

        const payload = shopifyOrderPayload({ lines: [{ productId: "P1", quantity: 1 }] });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret });

        // Stesso oggetto, byte diversi: una quantità gonfiata dopo la firma.
        const tampered = Buffer.from(rawBody.toString("utf8").replace('"quantity":1', '"quantity":99'), "utf8");

        await expect(ingestion.receive(channel.publicId, tampered, headers)).rejects.toMatchObject({ statusCode: 401 });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // L'idempotenza
    // ═════════════════════════════════════════════════════════════════════════

    it("RF-EXT-4 — la stessa CONSEGNA due volte non emette un secondo biglietto", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });

        const payload = shopifyOrderPayload({ lines: [{ productId: "P1", quantity: 1 }] });
        const delivery = signedDelivery({ payload, webhookSecret });

        const first = await ingestion.receive(channel.publicId, delivery.rawBody, delivery.headers);
        const sale = await waitForSale(channel.id, String(payload.id));

        const second = await ingestion.receive(channel.publicId, delivery.rawBody, delivery.headers);
        expect(second.duplicate).toBe(true);
        expect(second.externalSaleEventId).toBe(first.externalSaleEventId);

        const tickets = await getPrismaClient().ticket.findMany({ where: { externalSaleId: sale.id } });
        expect(tickets).toHaveLength(1);
    });

    it("lo stesso ORDINE consegnato due volte con id di consegna diversi resta una vendita sola", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });

        const payload = shopifyOrderPayload({ lines: [{ productId: "P1", quantity: 1 }] });

        await ingestion.receive(channel.publicId, ...deliveryArgs(payload, webhookSecret, "consegna-1"));
        const sale = await waitForSale(channel.id, String(payload.id));

        await ingestion.receive(channel.publicId, ...deliveryArgs(payload, webhookSecret, "consegna-2"));
        // La seconda consegna è nuova per il registro ma non per la vendita:
        // `ingest` è un no-op sullo stato `INGESTED`.
        await new Promise(resolve => setTimeout(resolve, 300));

        const registrations = await getPrismaClient().registration.count({ where: { externalSaleId: sale.id } });
        expect(registrations).toBe(1);
        expect(await getPrismaClient().externalSale.count({ where: { salesChannelId: channel.id } })).toBe(1);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // La quarantena
    // ═════════════════════════════════════════════════════════════════════════

    it("un prodotto NON MAPPATO manda la vendita in quarantena, con il motivo — e non tocca la capienza", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        const room = await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 100, consumed: 0 });

        const payload = shopifyOrderPayload({
            lines: [{ productId: "SCONOSCIUTO", quantity: 1, title: "Full Pass 2027" }],
        });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret });
        await ingestion.receive(channel.publicId, rawBody, headers);

        const sale = await waitForSale(channel.id, String(payload.id));
        expect(sale.status).toBe(ExternalSaleStatus.QUARANTINED);
        expect(sale.quarantineReason).toContain("Full Pass 2027");
        expect(sale.eventId).toBeNull();

        expect(await readConsumed(room.id)).toBe(0);
        expect(await getPrismaClient().ticket.count({ where: { externalSaleId: sale.id } })).toBe(0);
    });

    it("un articolo mappato SENZA titolo è ignorato: l'ordine misto non finisce in quarantena", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });
        // La maglietta: la si conosce, e non è un biglietto.
        await mapProduct({ salesChannelId: channel.id, externalProductId: "MAGLIETTA", ticketTypeId: null });

        const payload = shopifyOrderPayload({
            lines: [
                { productId: "P1", quantity: 1 },
                { productId: "MAGLIETTA", quantity: 3, title: "Maglietta" },
            ],
        });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret });
        await ingestion.receive(channel.publicId, rawBody, headers);

        const sale = await waitForSale(channel.id, String(payload.id));
        expect(sale.status).toBe(ExternalSaleStatus.INGESTED);
        // Un posto, non quattro.
        expect(await getPrismaClient().registration.count({ where: { externalSaleId: sale.id } })).toBe(1);
    });

    it("un evento che NON gestisce i canali esterni manda la vendita in quarantena (`05` §5)", async () => {
        const scenario = await createEventScenario();
        // `manageExternalChannels` resta `false`: l'interruttore per evento.
        const { channel, webhookSecret } = await connectShopifyChannel({ organizationId: scenario.organizationId });
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });

        const payload = shopifyOrderPayload({ lines: [{ productId: "P1", quantity: 1 }] });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret });
        await ingestion.receive(channel.publicId, rawBody, headers);

        const sale = await waitForSale(channel.id, String(payload.id));
        expect(sale.status).toBe(ExternalSaleStatus.QUARANTINED);
        expect(sale.quarantineReason).toContain("non gestisce i canali");
    });

    // ═════════════════════════════════════════════════════════════════════════
    // `RB20` — si sfora, si avvisa, si procede
    // ═════════════════════════════════════════════════════════════════════════

    it("RB20 — la vendita OLTRE il contingente è ACCETTATA: il denaro si è già mosso", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });

        const contingent = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.EVENT,
            limit: 2,
            consumed: 2,
            reservedFor: QuotaReservedFor.EXTERNAL_CHANNEL,
        });

        const payload = shopifyOrderPayload({ lines: [{ productId: "P1", quantity: 3 }] });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret });
        await ingestion.receive(channel.publicId, rawBody, headers);

        const sale = await waitForSale(channel.id, String(payload.id));
        expect(sale.status).toBe(ExternalSaleStatus.INGESTED);
        expect(await getPrismaClient().ticket.count({ where: { externalSaleId: sale.id } })).toBe(3);
        // Il contatore registra lo sforamento invece di nasconderlo: invariante
        // `I1` del `05` — il consumo dei canali esterni PUÒ eccedere.
        expect(await readConsumed(contingent.id)).toBe(5);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // La revoca
    // ═════════════════════════════════════════════════════════════════════════

    it("un rimborso rilascia la capienza e INVALIDA i QR — non basta segnare la riga", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });
        const room = await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 100, consumed: 0 });

        const payload = shopifyOrderPayload({ lines: [{ productId: "P1", quantity: 2 }] });
        await ingestion.receive(channel.publicId, ...deliveryArgs(payload, webhookSecret, "vendita"));
        const sale = await waitForSale(channel.id, String(payload.id));
        expect(await readConsumed(room.id)).toBe(2);

        // Il corpo di `refunds/create` è il rimborso: l'ordine sta su `order_id`.
        const refund = { id: 555, order_id: payload.id };
        const delivery = signedDelivery({
            payload: refund,
            webhookSecret,
            topic: "refunds/create",
            deliveryId: "rimborso",
        });
        await ingestion.receive(channel.publicId, delivery.rawBody, delivery.headers);

        const deadline = Date.now() + 5_000;
        let refunded = sale;
        while (Date.now() < deadline && refunded.status !== ExternalSaleStatus.REFUNDED) {
            await new Promise(resolve => setTimeout(resolve, 25));
            refunded = await getPrismaClient().externalSale.findFirstOrThrow({ where: { id: sale.id } });
        }

        expect(refunded.status).toBe(ExternalSaleStatus.REFUNDED);
        expect(await readConsumed(room.id)).toBe(0);

        const tickets = await getPrismaClient().ticket.findMany({ where: { externalSaleId: sale.id } });
        expect(tickets.every(t => t.status === TicketStatus.REFUNDED && t.qrRevokedAt !== null)).toBe(true);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // Il canale in pausa
    // ═════════════════════════════════════════════════════════════════════════

    it("un canale in PAUSA registra la notifica e non ingerisce — mettere in pausa non è perdere", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });
        await getPrismaClient().salesChannel.update({
            where: { id: channel.id },
            data: { status: SalesChannelStatus.PAUSED },
        });

        const payload = shopifyOrderPayload({ lines: [{ productId: "P1", quantity: 1 }] });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret });

        const outcome = await ingestion.receive(channel.publicId, rawBody, headers);
        expect(outcome.scheduled).toBe(false);

        // La notifica c'è, la vendita no: è ciò che permette di riprenderla.
        expect(await getPrismaClient().externalSaleEvent.count({ where: { salesChannelId: channel.id } })).toBe(1);
        expect(await getPrismaClient().externalSale.count({ where: { salesChannelId: channel.id } })).toBe(0);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // Il profilo che arriva dal negozio
    // ═════════════════════════════════════════════════════════════════════════

    it("il RUOLO e il NOMINATIVO dichiarati al checkout finiscono sull'iscrizione, posto per posto", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });
        await setCheckoutFields({
            salesChannelId: channel.id,
            roleAttributeName: "Ruolo",
            attendeeNameAttributeName: "Nome partecipante",
        });

        // Una riga da due posti con il campo ripetuto: è così che un ordine da
        // due pass porta due persone invece di due volte l'acquirente.
        const payload = shopifyOrderPayload({
            lines: [{
                productId: "P1",
                quantity: 2,
                properties: [
                    { name: "Nome partecipante", value: "Giulia Rossi" },
                    { name: "Nome partecipante", value: "Marco Bianchi" },
                    { name: "Ruolo", value: "follower" },
                    { name: "Ruolo", value: "Leader" },
                ],
            }],
        });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret });
        await ingestion.receive(channel.publicId, rawBody, headers);

        const sale = await waitForSale(channel.id, String(payload.id));
        const registrations = await getPrismaClient().registration.findMany({
            where: { externalSaleId: sale.id },
            orderBy: { id: "asc" },
        });

        expect(registrations).toHaveLength(2);
        expect(registrations[0]).toMatchObject({
            holderName: "Giulia",
            holderSurname: "Rossi",
            declaredRole: DeclaredDanceRole.FOLLOWER,
        });
        expect(registrations[1]).toMatchObject({
            holderName: "Marco",
            holderSurname: "Bianchi",
            declaredRole: DeclaredDanceRole.LEADER,
        });
        // L'indirizzo resta quello dell'acquirente su entrambe: è l'unico che il
        // negozio ha visto, ed è a lui che i biglietti sono stati mandati.
        expect(registrations.every(r => r.holderEmail === "ballerina@example.it")).toBe(true);
    });

    it("l'attributo del CARRELLO vale per il primo posto, non per tutti", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });
        await setCheckoutFields({ salesChannelId: channel.id, roleAttributeName: "Ruolo" });

        const payload = shopifyOrderPayload({
            // Un carrello ha un solo insieme di attributi, e chi lo compila è la
            // persona al checkout: spalmarlo su tre pass produrrebbe tre leader
            // dichiarati, cioè un equilibrio falso — peggio di uno mancante.
            noteAttributes: [{ name: "Ruolo", value: "leader" }],
            lines: [{ productId: "P1", quantity: 3 }],
        });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret });
        await ingestion.receive(channel.publicId, rawBody, headers);

        const sale = await waitForSale(channel.id, String(payload.id));
        const registrations = await getPrismaClient().registration.findMany({
            where: { externalSaleId: sale.id },
            orderBy: { id: "asc" },
        });

        expect(registrations[0]!.declaredRole).toBe(DeclaredDanceRole.LEADER);
        expect(registrations[1]!.declaredRole).toBe(DeclaredDanceRole.FLEXIBLE);
        expect(registrations[2]!.declaredRole).toBe(DeclaredDanceRole.FLEXIBLE);
    });

    it("un ruolo che non si riconosce NON si indovina: resta flessibile", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });
        await setCheckoutFields({ salesChannelId: channel.id, roleAttributeName: "Ruolo" });

        // Non esiste alcuna corrispondenza fra genere e ruolo: dedurla
        // manderebbe una persona dalla parte sbagliata della sala, e il difetto
        // si vedrebbe alla porta.
        const payload = shopifyOrderPayload({
            lines: [{ productId: "P1", quantity: 1, properties: [{ name: "Ruolo", value: "donna" }] }],
        });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret });
        await ingestion.receive(channel.publicId, rawBody, headers);

        const sale = await waitForSale(channel.id, String(payload.id));
        const registrations = await getPrismaClient().registration.findMany({ where: { externalSaleId: sale.id } });
        expect(registrations[0]!.declaredRole).toBe(DeclaredDanceRole.FLEXIBLE);
    });

    it("senza i campi configurati NULLA cambia: flessibile e intestato all'acquirente", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });

        // Il negozio manda i campi lo stesso, ma il canale non sa come si
        // chiamano: senza configurazione non si indovina un nome.
        const payload = shopifyOrderPayload({
            lines: [{
                productId: "P1",
                quantity: 1,
                properties: [{ name: "Ruolo", value: "leader" }, { name: "Nome partecipante", value: "Ada Neri" }],
            }],
        });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret });
        await ingestion.receive(channel.publicId, rawBody, headers);

        const sale = await waitForSale(channel.id, String(payload.id));
        const registrations = await getPrismaClient().registration.findMany({ where: { externalSaleId: sale.id } });
        expect(registrations[0]).toMatchObject({
            holderName: "Giulia",
            holderSurname: "Rossi",
            declaredRole: DeclaredDanceRole.FLEXIBLE,
        });
    });

    it("il cliente del negozio e la sua lingua si registrano, e la lingua arriva alla posta", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });

        const payload = shopifyOrderPayload({
            customerId: 998_877,
            locale: "en-GB",
            email: "dancer@example.co.uk",
            lines: [{ productId: "P1", quantity: 1 }],
        });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret });
        await ingestion.receive(channel.publicId, rawBody, headers);

        const sale = await waitForSale(channel.id, String(payload.id));
        // È l'unico modo di riconoscere chi ha già comprato l'anno scorso:
        // l'email cambia, questo no. Non aggancia alcuna utenza di Mirada.
        expect(sale.externalCustomerId).toBe("998877");
        expect(sale.customerLocale).toBe("en-GB");

        const deadline = Date.now() + 5_000;
        let mail = sentMails.find(sent => sent.to === "dancer@example.co.uk");
        while (Date.now() < deadline && !mail) {
            await new Promise(resolve => setTimeout(resolve, 25));
        mail = sentMails.find(sent => sent.to === "dancer@example.co.uk");
        }
        expect(mail).toBeDefined();
        // La lingua viaggia fino al servizio di posta, che è l'unico punto in
        // cui si decide in che lingua scrivere (`MailService.localeFor`).
        expect(mail!.localeHint).toBe("en-GB");
    });

    it("l'acquisto come OSPITE non ha cliente, e non è un errore", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });

        const payload = shopifyOrderPayload({ customerId: null, lines: [{ productId: "P1", quantity: 1 }] });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret });
        await ingestion.receive(channel.publicId, rawBody, headers);

        const sale = await waitForSale(channel.id, String(payload.id));
        expect(sale.status).toBe(ExternalSaleStatus.INGESTED);
        expect(sale.externalCustomerId).toBeNull();
    });

    // ═════════════════════════════════════════════════════════════════════════
    // L'acconto e il residuo — `14-acconto-e-saldo.md`
    // ═════════════════════════════════════════════════════════════════════════

    it("il residuo è la quota del SOLO codice di acconto — l'early bird resta onorato", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });
        await addDepositCode({ salesChannelId: channel.id, code: "ACCONTO_30" });

        // Il caso del §4.2: pacchetto da €155, early bird −10%, poi `ACCONTO_30`.
        // La persona paga €41,85 adesso e deve €97,65 alla porta: in tutto
        // €139,50, non €155. Con `total_discounts` il residuo sarebbe €113,15 e
        // l'early bird promesso si riprenderebbe di nascosto, alla porta.
        const payload = shopifyOrderPayload({
            totalPrice: "41.85",
            discountCodes: ["EARLYBIRD", "ACCONTO_30"],
            lines: [{
                productId: "P1",
                quantity: 1,
                price: "155.00",
                discounts: [
                    { index: 0, amount: "15.50" },
                    { index: 1, amount: "97.65" },
                ],
            }],
        });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret });
        await ingestion.receive(channel.publicId, rawBody, headers);

        const sale = await waitForSale(channel.id, String(payload.id));
        expect(sale.status).toBe(ExternalSaleStatus.INGESTED);
        expect(sale.ticketListAmount).toBe(15_500);
        expect(sale.depositPaidAmount).toBe(4_185);
        expect(sale.balanceDueAmount).toBe(9_765);
        expect(sale.nonTicketDepositAmount).toBe(0);

        const registrations = await getPrismaClient().registration.findMany({ where: { externalSaleId: sale.id } });
        expect(registrations).toHaveLength(1);
        expect(registrations[0]!.balanceDueAmount).toBe(9_765);
        expect(registrations[0]!.balanceSettledAmount).toBe(0);
    });

    it("RB28 — la somma delle quote per posto è ESATTAMENTE il residuo: 108,50 su 3 fa 36,17 · 36,17 · 36,16", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });
        await addDepositCode({ salesChannelId: channel.id, code: "ACCONTO_30" });

        const payload = shopifyOrderPayload({
            totalPrice: "139.50",
            discountCodes: ["ACCONTO_30"],
            lines: [{
                productId: "P1",
                quantity: 3,
                price: "155.00",
                discounts: [{ index: 0, amount: "108.50" }],
            }],
        });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret });
        await ingestion.receive(channel.publicId, rawBody, headers);

        const sale = await waitForSale(channel.id, String(payload.id));
        const registrations = await getPrismaClient().registration.findMany({
            where: { externalSaleId: sale.id },
            orderBy: { id: "asc" },
        });

        expect(registrations.map(r => r.balanceDueAmount)).toEqual([3_617, 3_617, 3_616]);
        // L'invariante, che è l'unica cosa che conta: nessun centesimo si crea e
        // nessuno si perde. Un centesimo per posto su ottocento posti sono otto
        // euro che non tornano e una serata a cercarli.
        expect(registrations.reduce((sum, r) => sum + r.balanceDueAmount, 0)).toBe(10_850);
        expect(sale.balanceDueAmount).toBe(10_850);
    });

    it("RF-SAL-4 — la fetta di acconto caduta sulla MERCE non è residuo: si registra e si segnala", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });
        // Mappatura senza titolo: «so cos'è, non è un biglietto».
        await mapProduct({ salesChannelId: channel.id, externalProductId: "T-SHIRT", ticketTypeId: null });
        await addDepositCode({ salesChannelId: channel.id, code: "ACCONTO_30" });

        const payload = shopifyOrderPayload({
            totalPrice: "52.50",
            discountCodes: ["ACCONTO_30"],
            lines: [
                { productId: "P1", quantity: 1, price: "155.00", discounts: [{ index: 0, amount: "108.50" }] },
                { productId: "T-SHIRT", quantity: 1, price: "25.00", discounts: [{ index: 0, amount: "17.50" }] },
            ],
        });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret });
        await ingestion.receive(channel.publicId, rawBody, headers);

        const sale = await waitForSale(channel.id, String(payload.id));
        // Alla porta nessuno chiede il saldo di una maglietta già consegnata.
        expect(sale.balanceDueAmount).toBe(10_850);
        expect(sale.nonTicketDepositAmount).toBe(1_750);
        // Si SEGNALA, non si mette in quarantena: la vendita è legittima e incassata.
        expect(sale.status).toBe(ExternalSaleStatus.INGESTED);

        const registrations = await getPrismaClient().registration.findMany({ where: { externalSaleId: sale.id } });
        expect(registrations).toHaveLength(1);
        expect(registrations[0]!.balanceDueAmount).toBe(10_850);
    });

    it("RF-SAL-2 — il confronto è normalizzato: ` acconto_30 ` è lo stesso codice", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });
        await addDepositCode({ salesChannelId: channel.id, code: "ACCONTO_30" });

        const payload = shopifyOrderPayload({
            totalPrice: "46.50",
            // Applicato a mano dal back-office del negozio, con un'altra
            // capitalizzazione. Senza normalizzazione la vendita entrerebbe come
            // se fosse a prezzo pieno: nessun errore, nessun segnale, e al
            // botteghino nessuno chiede quei €108,50.
            discountCodes: [" acconto_30 "],
            lines: [{ productId: "P1", quantity: 1, price: "155.00", discounts: [{ index: 0, amount: "108.50" }] }],
        });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret });
        await ingestion.receive(channel.publicId, rawBody, headers);

        const sale = await waitForSale(channel.id, String(payload.id));
        expect(sale.balanceDueAmount).toBe(10_850);
    });

    it("RF-SAL-3 — uno sconto NON configurato come acconto è uno sconto, e non genera residuo", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });
        await addDepositCode({ salesChannelId: channel.id, code: "ACCONTO_30" });

        const payload = shopifyOrderPayload({
            totalPrice: "139.50",
            discountCodes: ["EARLYBIRD"],
            lines: [{ productId: "P1", quantity: 1, price: "155.00", discounts: [{ index: 0, amount: "15.50" }] }],
        });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret });
        await ingestion.receive(channel.publicId, rawBody, headers);

        const sale = await waitForSale(channel.id, String(payload.id));
        expect(sale.status).toBe(ExternalSaleStatus.INGESTED);
        expect(sale.balanceDueAmount).toBe(0);

        const registrations = await getPrismaClient().registration.findMany({ where: { externalSaleId: sale.id } });
        expect(registrations[0]!.balanceDueAmount).toBe(0);
    });

    it("RF-SAL-13 — l'email dice l'acconto versato E il saldo da versare al check-in", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });
        await addDepositCode({ salesChannelId: channel.id, code: "ACCONTO_30" });

        const payload = shopifyOrderPayload({
            totalPrice: "46.50",
            discountCodes: ["ACCONTO_30"],
            lines: [{ productId: "P1", quantity: 1, price: "155.00", discounts: [{ index: 0, amount: "108.50" }] }],
        });
        const { rawBody, headers } = signedDelivery({ payload, webhookSecret });
        await ingestion.receive(channel.publicId, rawBody, headers);
        await waitForSale(channel.id, String(payload.id));

        // Si cerca **l'email di QUESTO ordine**, non «la prima arrivata»: la
        // consegna avviene dopo il commit, quindi l'email di un caso precedente
        // può atterrare qui dentro un istante dopo che il registratore è stato
        // svuotato. Un test che contasse le email sarebbe intermittente.
        const deadline = Date.now() + 5_000;
        let mail = sentMails.find(sent => sent.input.total === 4_650);
        while (Date.now() < deadline && !mail) {
            await new Promise(resolve => setTimeout(resolve, 25));
            mail = sentMails.find(sent => sent.input.total === 4_650);
        }

        expect(mail).toBeDefined();
        // Senza `balanceDue`, `total` sarebbe l'unica cifra dell'email — €46,50
        // su un pacchetto da €155 — e direbbe a qualcuno che ha pagato quando non
        // ha finito di pagare.
        expect(mail!.input.balanceDue).toBe(10_850);
    });

    it("la revoca CHIUDE il residuo: nessuno si presenterà a quella porta", async () => {
        const { scenario, channel, webhookSecret } = await externalChannelEvent();
        await mapProduct({ salesChannelId: channel.id, externalProductId: "P1", ticketTypeId: scenario.ticketTypeId });
        await addDepositCode({ salesChannelId: channel.id, code: "ACCONTO_30" });

        const payload = shopifyOrderPayload({
            totalPrice: "46.50",
            discountCodes: ["ACCONTO_30"],
            lines: [{ productId: "P1", quantity: 1, price: "155.00", discounts: [{ index: 0, amount: "108.50" }] }],
        });
        await ingestion.receive(channel.publicId, ...deliveryArgs(payload, webhookSecret, "consegna-acconto"));
        const sale = await waitForSale(channel.id, String(payload.id));

        const refund = { id: 99_001, order_id: payload.id };
        const revocation = signedDelivery({
            payload: refund,
            webhookSecret,
            topic: "refunds/create",
            deliveryId: "consegna-rimborso",
        });
        await ingestion.receive(channel.publicId, revocation.rawBody, revocation.headers);

        const deadline = Date.now() + 5_000;
        while (Date.now() < deadline) {
            const current = await getPrismaClient().externalSale.findFirstOrThrow({ where: { id: sale.id } });
            if (current.status === ExternalSaleStatus.REFUNDED) {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 25));
        }

        const registrations = await getPrismaClient().registration.findMany({ where: { externalSaleId: sale.id } });
        expect(registrations.every(r => r.balanceDueAmount === 0)).toBe(true);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // La conversione degli importi
    // ═════════════════════════════════════════════════════════════════════════

    it("gli importi passano per le CIFRE: `45.10` non diventa 4509", () => {
        const read = (total: string) => adapter.readNotification(
            Buffer.from(JSON.stringify({ id: 1, total_price: total, line_items: [], email: "a@b.it" }), "utf8"),
            { "x-shopify-topic": "orders/paid", "x-shopify-webhook-id": "d" },
        ).sale!.totalAmount;

        expect(read("45.10")).toBe(4_510);
        expect(read("45")).toBe(4_500);
        expect(read("45.5")).toBe(4_550);
        expect(read("0.99")).toBe(99);
    });
});

/** Scorciatoia: `receive` prende corpo e intestazioni come due argomenti. */
function deliveryArgs(
    payload: Record<string, unknown>,
    webhookSecret: string,
    deliveryId: string,
): [Buffer, Record<string, string>] {
    const delivery = signedDelivery({ payload, webhookSecret, deliveryId });
    return [delivery.rawBody, delivery.headers];
}
