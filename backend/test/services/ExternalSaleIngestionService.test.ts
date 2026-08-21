import { configureServiceTest } from "fastify-decorators/testing";
import {
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
    connectShopifyChannel,
    mapProduct,
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
    let sentMails: { to: string; input: any }[];

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
                    sendRegistrationConfirmed: async (to: string, input: any) => {
                        sentMails.push({ to, input });
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
