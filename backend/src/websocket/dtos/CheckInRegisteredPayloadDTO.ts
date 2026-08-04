import { z } from "zod";

/**
 * `checkin/registered` — backend-brief §3.9.
 *
 * Destinatari: i membri dell'organizzazione, uno per uno. **Immediato, non
 * aggregato**, e la differenza rispetto a `event/availability-changed` è
 * sostanziale: quello è disponibilità commerciale e sopporta una finestra di
 * 1,5 s, questo è il **contatore presenze**, cioè quante persone ci sono adesso
 * in sala. È un dato di sicurezza, e un dato di sicurezza in ritardo è un dato
 * sbagliato.
 */
export const CheckInRegisteredPayloadSchema = z.object({
    eventId: z.number().int(),
    organizationId: z.number().int(),
    sessionId: z.number().int(),
});

export type CheckInRegisteredPayloadDTO = z.infer<typeof CheckInRegisteredPayloadSchema>;
