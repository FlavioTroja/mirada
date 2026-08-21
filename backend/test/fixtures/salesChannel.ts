import { createHmac } from "node:crypto";
import { ExternalSale, ExternalSaleStatus, PrismaClient, SalesChannel, SalesChannelProvider } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";
import { seal } from "@utils/adapters/secretBox";

/**
 * Fixture dei canali di vendita esterni — fase E.
 *
 * Costruisce un negozio Shopify collegato, le sue associazioni prodotto → titolo
 * e le notifiche **firmate davvero**: la firma è calcolata con lo stesso
 * HMAC-SHA256 sui byte che il prestatore userebbe. Un test che aggirasse la
 * verifica non collauderebbe il presidio che conta di più.
 */

let sequence = 0;
const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++sequence}`;

export type ConnectedChannel = {
    channel: SalesChannel;
    /** Il segreto in chiaro, per firmare le notifiche del test. */
    webhookSecret: string;
};

export async function connectShopifyChannel(input: {
    organizationId: number;
    webhookSecret?: string;
    prisma?: PrismaClient;
}): Promise<ConnectedChannel> {
    const prisma = input.prisma ?? getPrismaClient();
    const webhookSecret = input.webhookSecret ?? unique("secret");

    const channel = await prisma.salesChannel.create({
        data: {
            organizationId: input.organizationId,
            provider: SalesChannelProvider.SHOPIFY,
            label: "Negozio di collaudo",
            publicId: unique("pub"),
            externalShopId: `${unique("shop")}.myshopify.com`,
            webhookSecret: seal(webhookSecret),
            credentials: seal(JSON.stringify({ accessToken: "shpat_collaudo" })),
        },
    });

    return { channel, webhookSecret };
}

export async function mapProduct(input: {
    salesChannelId: number;
    externalProductId: string;
    externalVariantId?: string;
    /** `null` = «questo articolo non è un biglietto, ignoralo». */
    ticketTypeId: number | null;
    seatsPerUnit?: number;
    prisma?: PrismaClient;
}) {
    const prisma = input.prisma ?? getPrismaClient();
    return prisma.salesChannelMapping.create({
        data: {
            salesChannelId: input.salesChannelId,
            externalProductId: input.externalProductId,
            externalVariantId: input.externalVariantId ?? "",
            ticketTypeId: input.ticketTypeId,
            seatsPerUnit: input.seatsPerUnit ?? 1,
        },
    });
}

/** Il corpo di un ordine Shopify, nella forma che il prestatore spedisce davvero. */
export function shopifyOrderPayload(input: {
    id?: number;
    orderNumber?: number;
    email?: string;
    firstName?: string;
    lastName?: string;
    totalPrice?: string;
    lines: { productId: string; variantId?: string; quantity: number; price?: string; title?: string }[];
}): Record<string, unknown> {
    const id = input.id ?? Math.floor(Math.random() * 1_000_000_000);
    return {
        id,
        name: `#${input.orderNumber ?? 1042}`,
        order_number: input.orderNumber ?? 1042,
        email: input.email ?? "ballerina@example.it",
        currency: "EUR",
        total_price: input.totalPrice ?? "90.00",
        processed_at: new Date().toISOString(),
        customer: {
            first_name: input.firstName ?? "Giulia",
            last_name: input.lastName ?? "Rossi",
        },
        line_items: input.lines.map((line, index) => ({
            id: id * 10 + index,
            product_id: line.productId,
            variant_id: line.variantId ?? null,
            title: line.title ?? "Full Pass",
            quantity: line.quantity,
            price: line.price ?? "90.00",
        })),
    };
}

/**
 * Corpo grezzo e intestazioni firmate. Il corpo è la **stringa**, non l'oggetto:
 * è precisamente ciò che la firma protegge, e passare l'oggetto lascerebbe al
 * test la libertà di riserializzarlo diversamente — cioè di collaudare qualcosa
 * che in esercizio non accade.
 */
export function signedDelivery(input: {
    payload: Record<string, unknown>;
    webhookSecret: string;
    topic?: string;
    deliveryId?: string;
}): { rawBody: Buffer; headers: Record<string, string> } {
    const rawBody = Buffer.from(JSON.stringify(input.payload), "utf8");
    const signature = createHmac("sha256", input.webhookSecret).update(rawBody).digest("base64");

    return {
        rawBody,
        headers: {
            "x-shopify-topic": input.topic ?? "orders/paid",
            "x-shopify-webhook-id": input.deliveryId ?? unique("delivery"),
            "x-shopify-hmac-sha256": signature,
            "content-type": "application/json",
        },
    };
}

/**
 * L'ingestione è programmata con `setImmediate` per rispondere in fretta al
 * prestatore: il test deve lasciarla arrivare in fondo prima di guardare il
 * database.
 *
 * Si **interroga il database**, non si contano i giri di coda: dentro
 * l'ingestione ci sono attese su Postgres vere, e un numero fisso di
 * `setImmediate` produrrebbe una suite che passa sulla macchina di chi l'ha
 * scritta e fallisce a caso altrove.
 */
export async function waitForSale(
    salesChannelId: number,
    externalOrderId: string,
    timeoutMs = 5_000,
): Promise<ExternalSale> {
    const prisma = getPrismaClient();
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const sale = await prisma.externalSale.findFirst({ where: { salesChannelId, externalOrderId } });
        if (sale && sale.status !== ExternalSaleStatus.RECEIVED) {
            return sale;
        }
        await new Promise(resolve => setTimeout(resolve, 25));
    }

    throw new Error(
        `La vendita esterna ${externalOrderId} del canale ${salesChannelId} non ha raggiunto uno stato definitivo `
        + `entro ${timeoutMs}ms.`,
    );
}
