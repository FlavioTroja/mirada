import { z } from "zod";

/**
 * Che cosa ha mosso il contatore presenze.
 *
 * Esiste perché i tre punti che pubblicano `checkin/registered` sono **tre fatti
 * diversi**, e un frame che dice solo «qualcosa è cambiato» costringe chi lo
 * riceve a indovinare quale:
 *
 * - `SCANNED` — una scansione alla porta, **adesso**. È l'unico caso in cui il
 *   momento del frame coincide con il momento dell'ingresso.
 * - `SYNCED` — un dispositivo ha riversato la propria coda offline. Gli ingressi
 *   sono **già avvenuti**, anche mezz'ora fa, e arrivano tutti insieme: `count`
 *   dice quanti. Mostrarli come appena accaduti renderebbe falso il numero di
 *   persone in sala, che è precisamente il dato per cui quel contatore esiste.
 * - `REVOKED` — un ingresso è stato annullato (`RF-CHK-9`). Il contatore
 *   **scende**: un flusso che sapesse solo aggiungere mostrerebbe una persona
 *   che non c'è.
 */
export const CheckInReasonSchema = z.enum(["SCANNED", "SYNCED", "REVOKED"]);
export type CheckInReason = z.infer<typeof CheckInReasonSchema>;

/**
 * `checkin/registered` — backend-brief §3.9.
 *
 * Destinatari: i membri dell'organizzazione, uno per uno. **Immediato, non
 * aggregato**, e la differenza rispetto a `event/availability-changed` è
 * sostanziale: quello è disponibilità commerciale e sopporta una finestra di
 * 1,5 s, questo è il **contatore presenze**, cioè quante persone ci sono adesso
 * in sala. È un dato di sicurezza, e un dato di sicurezza in ritardo è un dato
 * sbagliato.
 *
 * ── Resta un trigger di refetch (§3.9) ──────────────────────────────────────
 * Ciò che si è aggiunto sono **identificativi e un discriminante**, non dati di
 * dominio: nessun nome, nessun orario, nessun contatore. Chi riceve continua a
 * rileggere via REST — il payload serve a decidere *se* ricaricare, *che cosa*, e
 * ora anche *come presentarlo*.
 */
export const CheckInRegisteredPayloadSchema = z.object({
    eventId: z.number().int(),
    organizationId: z.number().int(),
    sessionId: z.number().int(),

    reason: CheckInReasonSchema,

    /**
     * L'ingresso singolo a cui il frame si riferisce. Presente su `SCANNED` e
     * `REVOKED`, **assente su `SYNCED`**: là il frame parla di un lotto, e
     * nominarne uno solo farebbe sparire gli altri dalla vista di chi ascolta.
     */
    checkInId: z.number().int().optional(),

    /** Quanti ingressi ha portato la sincronizzazione. Solo su `SYNCED`. */
    count: z.number().int().optional(),
});

export type CheckInRegisteredPayloadDTO = z.infer<typeof CheckInRegisteredPayloadSchema>;
