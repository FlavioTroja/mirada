import { PersonPartialSchema } from "@prisma-gen/zod";
import { z } from "zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

export const PersonUpdateSchema = withoutMetadata(
    PersonPartialSchema.omit({
        deleted: true,
    })
);
export type PersonUpdateDTO = z.infer<typeof PersonUpdateSchema>;