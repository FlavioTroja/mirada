import { z } from "zod";
import { PriceTierSchema } from "@prisma-gen/zod";
import { withToBeDisconnected } from "@utils/helpers/schemaTransformers";

/**
 * Sub-risorsa `PATCH /ticket-types/:id/price-tiers` (§3.2, nota 1 del §3.10).
 * `soldQuantity` è calcolato dal server e non è accettato dal client (§4.7).
 */
export const PriceTierUpdateSchema = withToBeDisconnected(
    PriceTierSchema.omit({
        ticketTypeId: true,
        soldQuantity: true,
        createdAt: true,
        updatedAt: true,
    }).extend({
        sortOrder: z.number().int().optional(),
    })
).array();

export type PriceTierUpdateDTO = z.infer<typeof PriceTierUpdateSchema>;
