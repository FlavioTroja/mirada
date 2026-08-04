import { z } from "zod";

export const LoginRequestSchema = z.object({
    usernameOrEmail: z.string(),
    password: z.string(),
});

export type LoginRequestDTO = z.infer<typeof LoginRequestSchema>;