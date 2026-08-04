import { z } from "zod";

/**
 * Payload of `Events.REGISTRATION_CREATED` (backend-brief §3.9, §4.10).
 *
 * Sent with `sendToUser` to the members of the organization that owns the event.
 * Like every keijo push it is a **refetch trigger**: no personal data of the
 * registrant travels on the wire, only the ids needed to reload the right list.
 */
export const RegistrationCreatedPayloadSchema = z.object({
    eventId: z.number().int(),
    organizationId: z.number().int(),
    registrationId: z.number().int(),
});

export type RegistrationCreatedPayloadDTO = z.infer<typeof RegistrationCreatedPayloadSchema>;
