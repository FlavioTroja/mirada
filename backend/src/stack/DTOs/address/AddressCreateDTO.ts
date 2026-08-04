import { z } from "zod";
import { AddressOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * `POST /addresses/create` — backend-brief §3.4, «due eccezioni della foundation
 * da completare»: il template spediva il solo `GET /addresses/cities`, ma
 * `Venue.addressId` è **obbligatorio** e senza creazione una location non è
 * creabile dall'interfaccia.
 */
export const AddressCreateSchema = withoutMetadata(AddressOptionalDefaultsSchema);
export type AddressCreateDTO = z.infer<typeof AddressCreateSchema>;
