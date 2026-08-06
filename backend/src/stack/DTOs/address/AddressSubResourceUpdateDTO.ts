import { withToBeDisconnected } from "@utils/helpers/schemaTransformers";
import { AddressSchema } from "@prisma-gen/zod";
import { z } from "zod";

/**
 * Sub-risorsa `PATCH /people/:id/addresses` — **l'array intero** degli indirizzi
 * di una persona (§3.2, regola 12 di `controllers.md`): `id: -1` = riga nuova,
 * `toBeDisconnected: true` = riga da rimuovere.
 *
 * Non confonderla con `AddressUpdateSchema`, che è l'aggiornamento parziale
 * scalare della **base REST** `/addresses` (§3.4).
 */
export const AddressSubResourceUpdateSchema = withToBeDisconnected(
    // `region` fuori anche qui: è derivata dalla provincia dal servizio, non
    // scritta dal client (§3.4).
    AddressSchema.omit({ updatedAt: true, createdAt: true, personId: true, region: true })
).array();
export type AddressSubResourceUpdateDTO = z.infer<typeof AddressSubResourceUpdateSchema>;
