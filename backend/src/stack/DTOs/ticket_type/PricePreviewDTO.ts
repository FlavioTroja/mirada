import { z } from "zod";
import { PriceTierKindSchema } from "@prisma-gen/zod";

/**
 * `POST /ticket-types/:id/price-preview` (`RF-EVT-26`).
 * Il prezzo è SEMPRE calcolato dal server: `at` e `soldQuantity` sono
 * facoltativi e servono solo a simulare uno scenario dal back-office. In assenza
 * valgono «adesso» e il venduto reale degli scaglioni.
 */
export const PricePreviewRequestSchema = z.object({
    at: z.coerce.date().optional(),
    soldQuantity: z.number().int().min(0).optional(),
});
export type PricePreviewRequestDTO = z.infer<typeof PricePreviewRequestSchema>;

/** Criterio per cui il prezzo corrente cesserà di valere. */
export const PriceExpiryCriterionSchema = z.enum(["BY_DATE", "BY_QUANTITY", "COMBINED", "NONE"]);
export type PriceExpiryCriterion = z.infer<typeof PriceExpiryCriterionSchema>;

/**
 * Scarsità dichiarata con DATI REALI (`RF-EVT-26`): `remainingAtThisPrice` è il
 * residuo effettivo dello scaglione, mai una stima.
 */
export const PricePreviewResponseSchema = z.object({
    ticketTypeId: z.number().int(),
    price: z.number().int(),
    basePrice: z.number().int(),
    priceTierId: z.number().int().nullable(),
    kind: PriceTierKindSchema.nullable(),
    expiryCriterion: PriceExpiryCriterionSchema,
    expiresAt: z.coerce.date().nullable(),
    remainingAtThisPrice: z.number().int().nullable(),
});
export type PricePreviewResponseDTO = z.infer<typeof PricePreviewResponseSchema>;
