import { z } from "zod";

/**
 * `registration/updated` — un'iscrizione gia esistente e cambiata.
 *
 * Destinatari: i membri dell'organizzazione proprietaria, uno per uno.
 *
 * ── Perche `change` e nel payload ───────────────────────────────────────────
 * Per la stessa ragione per cui c'e `reason` su `checkin/registered`: chi
 * ascolta deve poter decidere **senza rileggere** se quel frame lo riguarda. La
 * scheda di una persona rilegge su tutto; un elenco filtrato per «da confermare»
 * deve rileggere su `CONFIRMED` e `DECLINED` e puo ignorare una riassegnazione
 * di ruolo. Resta un discriminante, non un dato: nessun nome, nessuno stato
 * finale, nessun ruolo — quelli si rileggono via REST (§3.9).
 */
export const RegistrationChangeSchema = z.enum(["CONFIRMED", "DECLINED", "ROLE_REASSIGNED", "UPDATED", "DELETED"]);
export type RegistrationChange = z.infer<typeof RegistrationChangeSchema>;

export const RegistrationUpdatedPayloadSchema = z.object({
    eventId: z.number().int(),
    organizationId: z.number().int(),
    registrationId: z.number().int(),
    change: RegistrationChangeSchema,
});

export type RegistrationUpdatedPayloadDTO = z.infer<typeof RegistrationUpdatedPayloadSchema>;
