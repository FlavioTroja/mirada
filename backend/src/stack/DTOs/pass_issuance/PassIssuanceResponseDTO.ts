import { z } from "zod";
import { PassIssuanceSchema, TicketSchema } from "@prisma-gen/zod";

export const PassIssuanceResponseSchema = PassIssuanceSchema;
export type PassIssuanceResponseDTO = z.infer<typeof PassIssuanceResponseSchema>;

/**
 * Esito di `POST /events/:id/pass-issuances/bulk`.
 *
 * `warnings` è la forma in cui `RB20` si realizza: **avviso, non blocco**. Ogni
 * voce nomina la quota superata con il suo limite e il consumo raggiunto, così
 * l'organizzatore vede *di quanto* ha ecceduto e su cosa — la capienza della
 * sala, una sessione, il contingente accrediti.
 */
export const CapacityWarningSchema = z.object({
    quotaId: z.number().int(),
    scope: z.string(),
    scopeId: z.number().int().nullish(),
    scopeLabel: z.string(),
    role: z.string().nullish(),
    limit: z.number().int(),
    consumed: z.number().int(),
    exceededBy: z.number().int(),
});
export type CapacityWarningDTO = z.infer<typeof CapacityWarningSchema>;

export const PassIssuanceBulkResultSchema = z.object({
    passIssuance: PassIssuanceSchema,
    tickets: TicketSchema.array(),
    registrationIds: z.number().int().array(),
    warnings: CapacityWarningSchema.array(),
});
export type PassIssuanceBulkResultDTO = z.infer<typeof PassIssuanceBulkResultSchema>;
