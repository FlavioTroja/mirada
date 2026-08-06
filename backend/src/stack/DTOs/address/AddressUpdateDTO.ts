import { z } from "zod";
import { AddressPartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * Solo scalari della propria riga — regola 11 di `controllers.md`.
 *
 * **`region` è omessa**: si deriva dalla provincia, e il servizio la ricalcola a
 * ogni `update` che tocca `province` (§3.4). Un aggiornamento che spostasse la
 * provincia lasciando la vecchia regione produrrebbe una riga che mente sul
 * proprio territorio, ed è indicizzata: mentirebbe anche in ricerca.
 */
export const AddressUpdateSchema = withoutMetadata(AddressPartialSchema).omit({ region: true });
export type AddressUpdateDTO = z.infer<typeof AddressUpdateSchema>;
