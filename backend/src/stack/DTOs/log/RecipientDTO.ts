import { z } from "zod";

export const RecipientSchema = z.object({
    userId: z.number(),
    isRead: z.boolean().default(false),
});

export type RecipientDTO = z.infer<typeof RecipientSchema>;
