import { SalesChannel, SalesChannelProvider } from "@prisma/client";

/**
 * # La porta dei canali di vendita esterni — fase E
 *
 * Il modello **canonico** di una vendita esterna, e il contratto che ogni
 * prestatore deve soddisfare per entrare in Mirada.
 *
 * ── Perché una porta, con un solo prestatore ────────────────────────────────
 * Oggi c'è solo Shopify, e una porta con una sola implementazione sembra
 * cerimonia. Non lo è, per una ragione che è già scritta nel piano: ogni
 * organizzatore che si registrerà avrà **il suo** negozio, e il secondo sarà su
 * un'altra piattaforma. Ciò che varia da prestatore a prestatore è soltanto
 * questo strato — la firma, la forma del corpo, il nome dei campi. Tutto ciò che
 * sta a valle (iscrizioni, capienza, biglietti, WebSocket) non deve sapere da
 * quale negozio è arrivata la vendita, esattamente come `OrderFulfilmentService`
 * non sa se il `SettlementFact` viene da Stripe o da `confirm-free`.
 *
 * Il giorno di WooCommerce si scrive un adapter, non un percorso.
 */

/** Una riga d'ordine del negozio, tradotta nei termini che Mirada capisce. */
export type CanonicalSaleLine = {
    externalProductId: string;
    /** `""` quando il prestatore non distingue le varianti. */
    externalVariantId: string;
    /** Come la riga si chiama sul negozio. Serve al motivo di quarantena, che un
     *  umano deve poter leggere e riconoscere. */
    title: string;
    quantity: number;
    /** Centesimi interi, come ovunque nel dominio (§3.1). */
    unitPrice: number;
};

/** La vendita, nella forma canonica. Qui non c'è nulla di Shopify. */
export type CanonicalSale = {
    externalOrderId: string;
    /** Il numero che l'organizzatore legge sul suo negozio (`#1042`). */
    externalOrderNumber: string | null;
    buyerName: string;
    buyerSurname: string;
    buyerEmail: string;
    totalAmount: number;
    currency: string;
    lines: CanonicalSaleLine[];
    /** Quando il negozio dichiara l'incasso. Nullo se non lo dice. */
    paidAt: Date | null;
};

/**
 * Cosa Mirada deve fare di una notifica. Deliberatamente **più povero**
 * dell'insieme degli argomenti di Shopify: gli argomenti sono decine e cambiano
 * con le versioni dell'API, le conseguenze sono quattro e non cambiano mai.
 */
export enum ExternalNotificationKind {
    /** Vendita incassata: da ingerire. */
    SALE_PAID = "SALE_PAID",
    /** Rimborsata o annullata: capienza da rilasciare, biglietti da invalidare. */
    SALE_REVOKED = "SALE_REVOKED",
    /** Valida e senza conseguenze. Si registra e si archivia. */
    IGNORED = "IGNORED",
}

export type CanonicalNotification = {
    /** L'identificativo della **consegna** presso il prestatore — l'idempotenza del registro. */
    externalEventId: string;
    /** L'argomento come lo chiama il prestatore. Conservato tale e quale: serve a
     *  capire cosa è successo, e non tutto ciò che si registra si deve tradurre. */
    topic: string;
    externalOrderId: string | null;
    kind: ExternalNotificationKind;
    /** Presente su `SALE_PAID`. Nullo altrove. */
    sale: CanonicalSale | null;
};

/** Le intestazioni della richiesta, in minuscolo — come le consegna Fastify. */
export type NotificationHeaders = Record<string, string | string[] | undefined>;

export interface ExternalSaleChannelAdapter {
    readonly provider: SalesChannelProvider;

    /**
     * Verifica che la notifica venga davvero dal negozio.
     *
     * ⚠️ Il corpo è **grezzo**: la firma è calcolata sui byte, e un `JSON.parse`
     * seguito da `JSON.stringify` produce byte diversi (ordine delle chiavi,
     * spaziatura, caratteri fuori ASCII) e quindi una firma diversa. È il modo
     * più comune di rompere un webhook, e non dà segnali: le notifiche
     * cominciano semplicemente a essere rifiutate tutte.
     */
    verifySignature(rawBody: Buffer, headers: NotificationHeaders, webhookSecret: string): boolean;

    /** Traduce la notifica nel modello canonico. Solleva se il corpo è illeggibile. */
    readNotification(rawBody: Buffer, headers: NotificationHeaders): CanonicalNotification;

    /**
     * Le vendite modificate dopo un certo momento — la passata di
     * riconciliazione. È ciò che recupera le notifiche che il prestatore ha
     * perso, o che sono arrivate mentre il backend era fermo.
     */
    fetchSalesUpdatedSince(channel: SalesChannel, since: Date): Promise<CanonicalSale[]>;
}
