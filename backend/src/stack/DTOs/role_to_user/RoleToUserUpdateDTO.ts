import { RoleToUserSchema } from "@prisma-gen/zod";
import { z } from "zod";
import { withToBeDisconnected } from "@utils/helpers/schemaTransformers";

export const RoleToUserUpdateSchema = withToBeDisconnected(
    RoleToUserSchema.omit({ userId: true, createdAt: true, updatedAt: true })
).array();
export type RoleToUserUpdateDTO = z.infer<typeof RoleToUserUpdateSchema>;