import { RoleName } from "@prisma/client";
import { z } from "zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const UserQuerySchema = z.object({
    value: z.string().optional(),
    roles: z.array(z.enum(RoleName)).optional(),
});
export type UserQueryDTO = z.infer<typeof UserQuerySchema>;

export const UserPaginateBodyInputSchema = paginateSchema(UserQuerySchema);
export type UserPaginateDTO = z.infer<typeof UserPaginateBodyInputSchema>;