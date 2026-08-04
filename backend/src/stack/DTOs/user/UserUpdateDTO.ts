import { UserPartialSchema } from "@prisma-gen/zod";
import { z } from "zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

export const UserUpdateSchema = withoutMetadata(UserPartialSchema.omit({
    password: true,
    wsCode: true,
    logoFileId: true,
}));
export type UserUpdateDTO = z.infer<typeof UserUpdateSchema>;