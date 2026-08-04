import { z } from "zod";

/** Payload of `Events.SYSTEM_WELCOME`, pushed right after a successful connection. */
export const WelcomePayloadSchema = z.object({
    message: z.string(),
    wsCode: z.string(),
});

export type WelcomePayloadDTO = z.infer<typeof WelcomePayloadSchema>;
