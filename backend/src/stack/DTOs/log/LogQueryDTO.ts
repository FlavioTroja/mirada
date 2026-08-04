import { z } from "zod";
import { Level, RoleName } from "@prisma/client";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const LogQuerySchema = z.object({
    value: z.string().optional(),
    level: z.enum(Level).array().optional(),
    isNotification: z.boolean().optional(),
    toRoles: z.enum(RoleName).array().optional(),
    causedByCreatedAt: z.coerce.date().optional(),
    isRead: z.boolean().optional(),
});
export type LogQueryDTO = z.infer<typeof LogQuerySchema>;

export const LogPaginateBodyInputSchema = paginateSchema(LogQuerySchema);
export type LogPaginateDTO = z.infer<typeof LogPaginateBodyInputSchema>;