import { z } from "zod";
import { LevelSchema } from "@prisma-gen/zod";

/**
 * Payload of `Events.LOG_NOTIFICATION`, pushed by `LogService.saveAndNotify`. The
 * catchall carries the caller-provided notice extras alongside the log level/message.
 */
export const LogNotificationPayloadSchema = z.object({
    level: LevelSchema,
    message: z.string().optional(),
}).catchall(z.unknown());

export type LogNotificationPayloadDTO = z.infer<typeof LogNotificationPayloadSchema>;
