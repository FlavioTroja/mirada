import { z } from "zod";
import { AddressPartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/** Solo scalari della propria riga — regola 11 di `controllers.md`. */
export const AddressUpdateSchema = withoutMetadata(AddressPartialSchema);
export type AddressUpdateDTO = z.infer<typeof AddressUpdateSchema>;
