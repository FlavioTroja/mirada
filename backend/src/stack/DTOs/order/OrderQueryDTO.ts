import { z } from "zod";
import { OrderStatusSchema, PaymentStatusSchema } from "@prisma-gen/zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

/** `POST /orders/` — elenco paginato del dialetto §3.2. */
export const OrderQuerySchema = z.object({
    /** Full-text: qui l'unico testo di un ordine è il nome dei partecipanti sulle righe. */
    value: z.string().optional(),
    status: OrderStatusSchema.optional(),
    eventId: z.number().int().optional(),
    organizationId: z.number().int().optional(),
    purchaseId: z.number().int().optional(),
});
export type OrderQueryDTO = z.infer<typeof OrderQuerySchema>;

export const OrderPaginateBodyInputSchema = paginateSchema(OrderQuerySchema);
export type OrderPaginateDTO = z.infer<typeof OrderPaginateBodyInputSchema>;

/** `POST /purchases/` */
export const PurchaseQuerySchema = z.object({
    value: z.string().optional(),
    buyerUserId: z.number().int().optional(),
});
export type PurchaseQueryDTO = z.infer<typeof PurchaseQuerySchema>;

export const PurchasePaginateBodyInputSchema = paginateSchema(PurchaseQuerySchema);
export type PurchasePaginateDTO = z.infer<typeof PurchasePaginateBodyInputSchema>;

/** `POST /reservations/` — **sola lettura** (§3.4). */
export const ReservationQuerySchema = z.object({
    value: z.string().optional(),
    eventId: z.number().int().optional(),
    userId: z.number().int().optional(),
    orderId: z.number().int().optional(),
    /** `true` = non ancora rilasciate; `false` = già rilasciate. */
    active: z.boolean().optional(),
});
export type ReservationQueryDTO = z.infer<typeof ReservationQuerySchema>;

export const ReservationPaginateBodyInputSchema = paginateSchema(ReservationQuerySchema);
export type ReservationPaginateDTO = z.infer<typeof ReservationPaginateBodyInputSchema>;

/** `POST /payments/` — **sola lettura** (§3.4). */
export const PaymentQuerySchema = z.object({
    value: z.string().optional(),
    orderId: z.number().int().optional(),
    status: PaymentStatusSchema.optional(),
});
export type PaymentQueryDTO = z.infer<typeof PaymentQuerySchema>;

export const PaymentPaginateBodyInputSchema = paginateSchema(PaymentQuerySchema);
export type PaymentPaginateDTO = z.infer<typeof PaymentPaginateBodyInputSchema>;
