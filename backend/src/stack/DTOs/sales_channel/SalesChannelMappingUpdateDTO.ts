import { z } from "zod";
import { SalesChannelMappingSchema } from "@prisma-gen/zod";
import { withToBeDisconnected } from "@utils/helpers/schemaTransformers";

/**
 * Le associazioni prodotto → titolo di un canale, **tutte insieme** — regola 12
 * di `controllers.md`. Un solo `PUT` che porta lo stato desiderato dell'intera
 * collezione: `id: -1` per le righe nuove, `toBeDisconnected` per quelle da
 * togliere.
 *
 * `ticketTypeId` nullo è un valore, non un'assenza: significa «questo articolo
 * non è un biglietto, ignoralo». È ciò che distingue l'ordine misto — pass più
 * maglietta, il caso normale — dall'ordine che non si sa tradurre.
 */
export const SalesChannelMappingUpdateSchema = withToBeDisconnected(
    SalesChannelMappingSchema.omit({
        salesChannelId: true,
        createdAt: true,
        updatedAt: true,
        deleted: true,
    })
).array();

export type SalesChannelMappingUpdateDTO = z.infer<typeof SalesChannelMappingUpdateSchema>;
