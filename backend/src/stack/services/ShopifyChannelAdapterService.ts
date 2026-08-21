import { Service } from "fastify-decorators";
import { createHmac, timingSafeEqual } from "node:crypto";
import { SalesChannel, SalesChannelProvider } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { fetch } from "@utils/adapters/fetch";
import { open } from "@utils/adapters/secretBox";
import {
    CanonicalNotification,
    CanonicalSale,
    CanonicalSaleLine,
    ExternalNotificationKind,
    ExternalSaleChannelAdapter,
    NotificationHeaders,
} from "@interfaces/ExternalSaleChannelAdapter";

/**
 * Versione dell'API di amministrazione usata per la riconciliazione. Shopify le
 * data e ne ritira di vecchie: fissarla qui è ciò che rende un aggiornamento una
 * decisione presa, invece di una rottura scoperta il giorno in cui la vecchia
 * smette di rispondere.
 */
const ADMIN_API_VERSION = "2025-01";

/** Quante vendite chiedere per pagina alla riconciliazione. Il massimo di Shopify è 250. */
const RECONCILIATION_PAGE_SIZE = 100;

/** Le credenziali che l'app *custom* del negozio richiede. Vedi la nota nel servizio. */
type ShopifyCredentials = {
    /** `shpat_…` — token di amministrazione dell'app custom. */
    accessToken: string;
};

@Service()
export class ShopifyChannelAdapterService implements ExternalSaleChannelAdapter {
    public readonly provider = SalesChannelProvider.SHOPIFY;

    // ═════════════════════════════════════════════════════════════════════════
    // La firma
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * HMAC-SHA256 sul corpo **grezzo**, chiave = segreto del webhook, confronto
     * in base64.
     *
     * ── Il confronto è a tempo costante ─────────────────────────────────────
     * `a === b` su stringhe esce al primo byte diverso, e il tempo di uscita
     * racconta quanti byte erano giusti. Con abbastanza tentativi si costruisce
     * una firma valida un byte alla volta. `timingSafeEqual` esiste per questo, e
     * pretende buffer della stessa lunghezza — la disuguaglianza di lunghezza va
     * quindi respinta **prima**, e non è una perdita: la lunghezza di una firma
     * HMAC-SHA256 è nota a chiunque.
     */
    public verifySignature(rawBody: Buffer, headers: NotificationHeaders, webhookSecret: string): boolean {
        const provided = this.header(headers, "x-shopify-hmac-sha256");
        if (!provided) {
            Log.warn("[ShopifyChannelAdapter Service]: notification refused — no 'X-Shopify-Hmac-Sha256' header");
            return false;
        }

        const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("base64");

        const providedBuffer = Buffer.from(provided, "utf8");
        const expectedBuffer = Buffer.from(expected, "utf8");
        if (providedBuffer.length !== expectedBuffer.length) {
            Log.warn("[ShopifyChannelAdapter Service]: notification refused — signature length mismatch");
            return false;
        }

        const valid = timingSafeEqual(providedBuffer, expectedBuffer);
        if (!valid) {
            Log.warn("[ShopifyChannelAdapter Service]: notification refused — invalid HMAC signature");
        }
        return valid;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // La traduzione
    // ═════════════════════════════════════════════════════════════════════════

    public readNotification(rawBody: Buffer, headers: NotificationHeaders): CanonicalNotification {
        const topic = this.header(headers, "x-shopify-topic") ?? "";
        // Senza `X-Shopify-Webhook-Id` non c'è idempotenza del registro. Non
        // succede con Shopify, ma un ripiego silenzioso su una stringa a caso
        // trasformerebbe una consegna ripetuta in una vendita doppia: meglio
        // rifiutare e vederlo.
        const externalEventId = this.header(headers, "x-shopify-webhook-id");
        if (!externalEventId) {
            Log.error("[ShopifyChannelAdapter Service]: notification without 'X-Shopify-Webhook-Id' — refused");
            throw new httpErrors.BadRequest("Notifica priva dell'identificativo di consegna.");
        }

        const payload = this.parse(rawBody);
        const kind = this.kindOf(topic);

        // Su `refunds/create` il corpo è il rimborso, e l'ordine è `order_id`.
        const externalOrderId = payload.order_id != null
            ? String(payload.order_id)
            : (payload.id != null ? String(payload.id) : null);

        Log.info(
            `[ShopifyChannelAdapter Service]: notification '${topic}' (delivery ${externalEventId}) read as ${kind}`
            + `${externalOrderId ? ` for external order ${externalOrderId}` : ""}`,
        );

        return {
            externalEventId,
            topic,
            externalOrderId,
            kind,
            sale: kind === ExternalNotificationKind.SALE_PAID ? this.toCanonicalSale(payload) : null,
        };
    }

    /**
     * Gli argomenti che ci riguardano, e nient'altro.
     *
     * `orders/paid` e non `orders/create`: un ordine creato non è un ordine
     * incassato, e ingerire alla creazione emetterebbe biglietti per carrelli mai
     * pagati. Con i metodi di pagamento asincroni — bonifico, contrassegno — fra
     * i due passano giorni.
     */
    private kindOf(topic: string): ExternalNotificationKind {
        switch (topic) {
            case "orders/paid":
                return ExternalNotificationKind.SALE_PAID;
            case "refunds/create":
            case "orders/cancelled":
                return ExternalNotificationKind.SALE_REVOKED;
            default:
                return ExternalNotificationKind.IGNORED;
        }
    }

    private toCanonicalSale(payload: Record<string, any>): CanonicalSale {
        const lines: CanonicalSaleLine[] = (payload.line_items ?? []).map((item: Record<string, any>) => ({
            externalProductId: item.product_id != null ? String(item.product_id) : "",
            externalVariantId: item.variant_id != null ? String(item.variant_id) : "",
            title: [item.title, item.variant_title].filter(Boolean).join(" — ") || "riga senza titolo",
            quantity: Number(item.quantity ?? 0),
            unitPrice: this.toCents(item.price),
        }));

        const { name, surname } = this.splitBuyerName(payload);

        return {
            externalOrderId: String(payload.id),
            // `name` è il numero come lo mostra Shopify ("#1042"); `order_number`
            // è lo stesso senza prefisso. Si preferisce il primo perché è ciò che
            // l'organizzatore legge davvero nella sua interfaccia.
            externalOrderNumber: payload.name ?? (payload.order_number != null ? `#${payload.order_number}` : null),
            buyerName: name,
            buyerSurname: surname,
            buyerEmail: (payload.email ?? payload.contact_email ?? "").trim().toLowerCase(),
            totalAmount: this.toCents(payload.total_price),
            currency: payload.currency ?? "EUR",
            lines,
            paidAt: payload.processed_at ? new Date(payload.processed_at) : null,
        };
    }

    /**
     * Shopify tiene nome e cognome separati sul cliente, ma il cliente può
     * mancare (acquisto come ospite con la sola email). Il ripiego usa
     * l'indirizzo di fatturazione, e in ultima istanza l'email: un'iscrizione
     * senza nome non è registrabile, e il modulo di completamento serve
     * precisamente a farsi dire il nome vero.
     */
    private splitBuyerName(payload: Record<string, any>): { name: string; surname: string } {
        const customer = payload.customer ?? {};
        const billing = payload.billing_address ?? payload.shipping_address ?? {};

        const first = (customer.first_name ?? billing.first_name ?? "").trim();
        const last = (customer.last_name ?? billing.last_name ?? "").trim();

        if (first || last) {
            return { name: first || "—", surname: last || "—" };
        }

        const email = (payload.email ?? payload.contact_email ?? "").trim();
        return { name: email ? email.split("@")[0]! : "Acquirente", surname: "da nominare" };
    }

    /**
     * Shopify manda gli importi come stringa decimale (`"45.00"`). La
     * conversione passa per le **cifre**, non per `parseFloat`: `45.10 * 100` in
     * virgola mobile fa `4509.999999999999`, e un `Math.round` che oggi salva la
     * situazione non è una ragione per costruirci sopra un registro contabile.
     */
    private toCents(value: unknown): number {
        if (value == null) {
            return 0;
        }
        const text = String(value).trim().replace(",", ".");
        const negative = text.startsWith("-");
        const [whole = "0", fraction = ""] = text.replace("-", "").split(".");
        const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
        return Number.isFinite(cents) ? (negative ? -cents : cents) : 0;
    }

    private parse(rawBody: Buffer): Record<string, any> {
        try {
            return JSON.parse(rawBody.toString("utf8"));
        } catch (err) {
            Log.error(`[ShopifyChannelAdapter Service]: notification body is not valid JSON: ${(err as Error).message}`);
            throw new httpErrors.BadRequest("Corpo della notifica non leggibile.");
        }
    }

    private header(headers: NotificationHeaders, name: string): string | null {
        const value = headers[name];
        if (Array.isArray(value)) {
            return value[0] ?? null;
        }
        return value ?? null;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // La riconciliazione
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Le vendite incassate e modificate dopo `since`.
     *
     * ── `status=any`, non `status=open` ─────────────────────────────────────
     * Un ordine archiviato dall'organizzatore resta una vendita da ingerire, e
     * il filtro predefinito di Shopify lo escluderebbe. È il modo più naturale di
     * perdere proprio gli ordini più vecchi — cioè quelli che la riconciliazione
     * esiste per recuperare.
     */
    public async fetchSalesUpdatedSince(channel: SalesChannel, since: Date): Promise<CanonicalSale[]> {
        const credentials = this.credentialsOf(channel);

        const url = new URL(`https://${channel.externalShopId}/admin/api/${ADMIN_API_VERSION}/orders.json`);
        url.searchParams.set("status", "any");
        url.searchParams.set("financial_status", "paid");
        url.searchParams.set("updated_at_min", since.toISOString());
        url.searchParams.set("limit", String(RECONCILIATION_PAGE_SIZE));

        Log.info(
            `[ShopifyChannelAdapter Service]: reconciling sales channel (id ${channel.id}, shop '${channel.externalShopId}') `
            + `for orders updated since ${since.toISOString()}`,
        );

        const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
                "X-Shopify-Access-Token": credentials.accessToken,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const body = await response.text();
            Log.error(
                `[ShopifyChannelAdapter Service]: reconciliation failed for sales channel (id ${channel.id}) — `
                + `HTTP ${response.status}: ${body.slice(0, 300)}`,
            );
            throw new httpErrors.BadGateway("Il negozio Shopify non ha risposto correttamente.");
        }

        const payload = await response.json() as { orders?: Record<string, any>[] };
        const sales = (payload.orders ?? []).map(order => this.toCanonicalSale(order));

        Log.info(
            `[ShopifyChannelAdapter Service]: reconciliation returned ${sales.length} paid order(s) for sales channel (id ${channel.id})`,
        );
        return sales;
    }

    /**
     * ── Perché le credenziali sono una busta e non tre colonne ──────────────
     * Oggi Trani usa un'app *custom* del proprio negozio: un token statico, che
     * l'amministratore genera e incolla. Il secondo organizzatore su Shopify
     * richiederà un'app pubblica con OAuth, e la busta conterrà anche il token di
     * aggiornamento e le concessioni. Essendo un JSON cifrato, quel giorno è una
     * riga di configurazione e non una migrazione.
     */
    private credentialsOf(channel: SalesChannel): ShopifyCredentials {
        if (!channel.credentials) {
            Log.error(`[ShopifyChannelAdapter Service]: sales channel (id ${channel.id}) has no stored credentials`);
            throw new httpErrors.BadRequest("Il canale di vendita non ha credenziali: va ricollegato.");
        }

        const credentials = JSON.parse(open(channel.credentials)) as ShopifyCredentials;
        if (!credentials.accessToken) {
            Log.error(`[ShopifyChannelAdapter Service]: sales channel (id ${channel.id}) credentials carry no access token`);
            throw new httpErrors.BadRequest("Il canale di vendita non ha un token di accesso valido.");
        }
        return credentials;
    }
}
