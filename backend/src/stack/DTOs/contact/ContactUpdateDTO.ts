import { z } from "zod";
import { ContactPartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

export const ContactUpdateSchema = withoutMetadata(ContactPartialSchema)

export type ContactUpdateDTO = z.infer<typeof ContactUpdateSchema>;