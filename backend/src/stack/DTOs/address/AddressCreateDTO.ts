import { z } from "zod";
import { AddressOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * `POST /addresses/create` — backend-brief §3.4, «due eccezioni della foundation
 * da completare»: il template spediva il solo `GET /addresses/cities`, ma
 * `Venue.addressId` è **obbligatorio** e senza creazione una location non è
 * creabile dall'interfaccia.
 *
 * **`region` è omessa e non è una dimenticanza**: il §3.4 dice che «non si
 * digita». È un campo calcolato dal server (§5) e derivato dalla sigla di
 * provincia da `AddressService`; accettarla dal client riaprirebbe esattamente
 * il problema che la colonna esiste per chiudere — «Puglia», «PUGLIA» e «Apulia»
 * come tre regioni diverse nella faccettatura del filtro pubblico.
 */
export const AddressCreateSchema = withoutMetadata(AddressOptionalDefaultsSchema).omit({ region: true });
export type AddressCreateDTO = z.infer<typeof AddressCreateSchema>;
