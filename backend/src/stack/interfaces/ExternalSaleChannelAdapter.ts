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

/**
 * Uno sconto applicato a **una riga**, con il nome che porta sul negozio.
 *
 * ── Perché il nome, e perché per riga ───────────────────────────────────────
 * È il nome a dire se quello sconto è un **acconto** (`14` §3.1): con un codice
 * sconto, per il negozio l'ordine non è parzialmente pagato — è pagato per
 * intero a un prezzo ridotto, e l'unica traccia dell'acconto è come si chiama il
 * codice.
 *
 * Ed è per riga perché il residuo si calcola **sulle sole righe biglietto**
 * (`14` §4.4): un carrello con un pacchetto e una maglietta ha una fetta di
 * sconto caduta sulla maglietta, e quella fetta non è un saldo da chiedere alla
 * porta. Un totale d'ordine non permetterebbe di distinguerle senza inventare
 * una ripartizione.
 */
export type CanonicalDiscount = {
    /** Il codice **come lo scrive il negozio**, non normalizzato: normalizzare è
     *  una decisione di chi confronta, e questo strato traduce soltanto. */
    code: string;
    /** Centesimi interi, positivi: quanto questo sconto ha tolto **a questa riga**. */
    amount: number;
};

/**
 * Un campo che il negozio ha raccolto al checkout — attributo del carrello o
 * proprietà della riga.
 *
 * ── Perché arrivano tutti, e senza interpretazione ──────────────────────────
 * Il ruolo di ballo e il nominativo del partecipante **non sono dati di un
 * negozio**: esistono solo se l'organizzatore li chiede, e li chiama come vuole.
 * L'adapter riporta quindi ciò che ha trovato, con il nome che porta; è il
 * servizio di ingestione — l'unico che conosce la configurazione del canale — a
 * sapere quale nome significa cosa. È la stessa divisione degli sconti, e per la
 * stessa ragione: il giorno di WooCommerce i campi personalizzati hanno un nome
 * e un valore esattamente come qui.
 *
 * ⚠️ **Lo stesso nome può comparire più volte**, ed è voluto: è così che una
 * riga da tre posti porta tre nominativi. L'ordine è quello in cui il negozio li
 * consegna, e viene rispettato.
 */
export type CanonicalAttribute = {
    name: string;
    value: string;
};

/** Una riga d'ordine del negozio, tradotta nei termini che Mirada capisce. */
export type CanonicalSaleLine = {
    externalProductId: string;
    /** `""` quando il prestatore non distingue le varianti. */
    externalVariantId: string;
    /** Come la riga si chiama sul negozio. Serve al motivo di quarantena, che un
     *  umano deve poter leggere e riconoscere. */
    title: string;
    quantity: number;
    /** Centesimi interi, come ovunque nel dominio (§3.1). **Prezzo di listino**,
     *  cioè prima degli sconti: è ciò che gli `discounts` qui sotto riducono. */
    unitPrice: number;
    /**
     * Gli sconti caduti su questa riga, **tutti**, con il loro nome.
     *
     * ⚠️ L'adapter non sa quali di questi siano acconti, e non deve saperlo: a
     * decidere è il servizio di ingestione, l'unico che conosce la configurazione
     * del canale. È la stessa ragione per cui la porta esiste — il giorno di
     * WooCommerce i coupon hanno un nome e un importo per riga esattamente come
     * qui, e si scrive un adapter, non un percorso (`14` §3.6).
     *
     * Vuoto sulla stragrande maggioranza delle vendite, che sono a prezzo pieno.
     */
    discounts: CanonicalDiscount[];
    /**
     * Le proprietà di **questa riga** (`line_items[].properties` su Shopify) —
     * dove finiscono il ruolo e il nominativo quando l'organizzatore li chiede
     * sul modulo del prodotto.
     *
     * Vuoto sulla stragrande maggioranza delle vendite.
     */
    attributes: CanonicalAttribute[];
};

/** La vendita, nella forma canonica. Qui non c'è nulla di Shopify. */
export type CanonicalSale = {
    externalOrderId: string;
    /** Il numero che l'organizzatore legge sul suo negozio (`#1042`). */
    externalOrderNumber: string | null;
    buyerName: string;
    buyerSurname: string;
    buyerEmail: string;
    /**
     * L'identificativo del cliente presso il negozio. `null` sugli acquisti come
     * ospite.
     *
     * ⚠️ **Non è un aggancio a un'utenza di Mirada, e non deve diventarlo.**
     * Riconosce chi ha già comprato *su quel negozio*; collegare un account
     * richiede un indirizzo dimostrato, non uno digitato al checkout.
     */
    externalCustomerId: string | null;
    /** La lingua dichiarata dal cliente (`it`, `en-GB`, …), quando c'è. */
    locale: string | null;
    totalAmount: number;
    currency: string;
    lines: CanonicalSaleLine[];
    /**
     * Gli attributi dell'**ordine intero** (`note_attributes` su Shopify): ciò
     * che il negozio raccoglie sul carrello invece che sul singolo prodotto.
     *
     * Descrivono **chi ha comprato**, non ciascun posto: un carrello ha un solo
     * insieme di attributi, e chi lo compila è la persona al checkout. È il
     * motivo per cui l'ingestione li applica al primo posto dell'ordine e non a
     * tutti — tre pass non diventano tre persone con lo stesso nome.
     */
    attributes: CanonicalAttribute[];
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
     * Rilegge una **vendita** da un corpo grezzo già registrato, senza firma e
     * senza intestazioni. `null` se quel corpo non è un ordine — una notifica di
     * rimborso, per esempio, che per lo stesso ordine esiste eccome.
     *
     * ── A cosa serve, e perché non basta `readNotification` ─────────────────
     * Alla rielaborazione di una quarantena creata **prima** che il canonico
     * conoscesse gli sconti: la forma canonica salvata allora non li porta, e
     * l'unico posto dove esistono ancora è il corpo che il negozio aveva mandato
     * (`14` §3.6). `readNotification` pretende le intestazioni della richiesta —
     * la firma, l'identificativo di consegna — che a quel punto non ci sono più e
     * che ricostruire significherebbe scrivere qui dentro i nomi delle
     * intestazioni di un prestatore specifico, cioè bucare la porta.
     */
    readSale(payload: unknown): CanonicalSale | null;

    /**
     * Le vendite modificate dopo un certo momento — la passata di
     * riconciliazione. È ciò che recupera le notifiche che il prestatore ha
     * perso, o che sono arrivate mentre il backend era fermo.
     */
    fetchSalesUpdatedSince(channel: SalesChannel, since: Date): Promise<CanonicalSale[]>;
}
