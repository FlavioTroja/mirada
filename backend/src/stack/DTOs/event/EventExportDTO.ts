import { z } from "zod";

/**
 * `POST /events/:id/exports` — backend-brief §3.7 (`RF-BKO-3`, `RF-BKO-9`).
 *
 * `SALES_BY_SESSION` **non è una comodità**: è `RF-BKO-9`, una delle tre
 * condizioni che reggono il posizionamento fiscale della piattaforma. Un file
 * vuoto che sembra un dato è peggio di un errore, quindi i tipi che dipendono da
 * entità non ancora costruite **falliscono con un messaggio esplicito** anziché
 * restituire un `fileUrl` verso zero righe.
 */
export const ExportKindSchema = z.enum([
    "REGISTRATIONS",
    "ORDERS",
    "REVENUE",
    "ATTENDANCE",
    "SALES_BY_SESSION",
]);
export type ExportKind = z.infer<typeof ExportKindSchema>;

/**
 * Colonne esportabili per `REGISTRATIONS`, elenco chiuso.
 *
 * **Non contiene contatti oltre l'email del titolare, né alcun dato dei
 * requisiti, né diete o allergie** (`RB12`, §4.6): diete e allergie sono l'unico
 * dato riconducibile alla salute che resta in piattaforma e non entrano mai nelle
 * esportazioni generiche.
 */
export const RegistrationExportColumnSchema = z.enum([
    "id",
    "holderName",
    "holderSurname",
    "holderEmail",
    "declaredRole",
    "assignedRole",
    "channel",
    "status",
    "coupleId",
    "isMinor",
    "confirmedAt",
    "declinedAt",
    "createdAt",
]);
export type RegistrationExportColumn = z.infer<typeof RegistrationExportColumnSchema>;

/**
 * Colonne esportabili per `ATTENDANCE`, elenco chiuso.
 *
 * Le presenze sono righe di `CheckIn` sulla **coppia biglietto–sessione**
 * (`RB7`). Il tracciato porta la sessione, il biglietto, il nominativo, il
 * **ruolo di ballo**, l'ora e la **postazione** — e la traccia di revoca e
 * conflitto, perché un'esportazione che tacesse un doppio ingresso non ancora
 * dirimito mostrerebbe una presenza che nessuno ha confermato (`RF-CHK-6`).
 *
 * `RB12` — **nessun contatto**, nessun dato dei requisiti, nessuna dieta:
 * l'elenco è chiuso, e ciò che non compare qui non esce.
 */
export const AttendanceExportColumnSchema = z.enum([
    "checkInId",
    "sessionId",
    "sessionName",
    "ticketId",
    "ticketCode",
    "holderName",
    "holderSurname",
    "role",
    "kind",
    "scannedAt",
    "deviceId",
    "offline",
    "syncedAt",
    "revokedAt",
    "conflictWithId",
]);
export type AttendanceExportColumn = z.infer<typeof AttendanceExportColumnSchema>;

export const EventExportRequestSchema = z.object({
    kind: ExportKindSchema,
    /** Vuoto o assente = tutte le colonne disponibili per il `kind` richiesto. */
    columns: z.string().array().default([]),
});
export type EventExportRequestDTO = z.infer<typeof EventExportRequestSchema>;

export const EventExportResponseSchema = z.object({
    /** Il campo dichiarato dal §3.7. */
    fileUrl: z.string(),
    fileId: z.number().int(),
    kind: ExportKindSchema,
    columns: z.string().array(),
    rows: z.number().int(),
    generatedAt: z.date(),
    /** `RB21` — su quali entità le righe sono calcolate. */
    basedOn: z.string().array(),
});
export type EventExportResponseDTO = z.infer<typeof EventExportResponseSchema>;
