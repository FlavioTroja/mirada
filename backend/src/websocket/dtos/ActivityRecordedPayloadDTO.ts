import { z } from "zod";

/**
 * Payload of `Events.ACTIVITY_RECORDED` (`21-dashboard.md` §4). Invito a
 * rileggere: dice di che tipo è la riga nuova, non che cosa dice.
 */
export const ActivityRecordedPayloadSchema = z.object({
    organizationId: z.number().int(),
    kind: z.enum(["CHECK_IN", "REGISTRATION", "PAYMENT", "CALENDAR", "PROSPECT"]),
    severity: z.enum(["INFO", "WARNING", "CRITICAL"]),
});

export type ActivityRecordedPayloadDTO = z.infer<typeof ActivityRecordedPayloadSchema>;
