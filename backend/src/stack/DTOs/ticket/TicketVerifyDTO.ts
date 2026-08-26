import { z } from "zod";
import { CheckInResultSchema, DanceRoleSchema } from "@prisma-gen/zod";

/**
 * `POST /tickets/verify` body `{ code, sessionId }` (§3.7).
 *
 * `code` accetta **sia** il codice nudo **sia** il JWS compatto letto dal QR: il
 * dispositivo non deve estrarre nulla per interrogare il server, e quando arriva
 * il JWS **la firma è verificata anche qui**, non solo sul telefono. Un QR
 * manomesso o firmato con una chiave che non conosciamo è rifiutato da entrambe
 * le parti.
 */
export const TicketVerifySchema = z.object({
    code: z.string().min(1),
    sessionId: z.number().int(),
});
export type TicketVerifyDTO = z.infer<typeof TicketVerifySchema>;

/**
 * ── `RB12`, minimizzazione — la ragione per cui questa forma è quella che è ───
 *
 * La risposta porta **nominativo, ruolo di ballo, titolo, sessioni incluse e
 * servizi acquistati**. Non porta contatti, non porta il contenuto dei
 * requisiti, non porta diete né allergie: il `CHECKIN_OPERATOR` è il ruolo dei
 * volontari e deve vedere il minimo indispensabile.
 *
 * Del requisito bloccante si restituisce **il nome, non il contenuto**
 * (`RF-CHK-4`, `RF-REQ-7`): l'operatore deve poter dire *«manca la liberatoria»*,
 * non leggere che cosa la persona vi ha scritto dentro.
 */
export const VerifiedHolderSchema = z.object({
    registrationId: z.number().int().nullish(),
    name: z.string(),
    surname: z.string(),
    /** Ruolo di ballo assegnato. `null` sugli eventi senza quote di ruolo. */
    role: DanceRoleSchema.nullish(),
    /** Pass al portatore: nessun nominativo da confrontare. */
    bearer: z.boolean(),
});

export const VerifiedSessionSchema = z.object({
    id: z.number().int(),
    name: z.unknown(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    /** True per la sessione su cui la verifica è stata richiesta. */
    requested: z.boolean(),
    /** True quando quella sessione risulta già usata da questo biglietto. */
    alreadyUsed: z.boolean(),
});

export const VerifiedServiceSchema = z.object({
    id: z.number().int(),
    name: z.unknown(),
});

/** Ora e postazione del **primo** ingresso, richieste da `RF-CHK-4` su `ALREADY_USED`. */
export const FirstEntrySchema = z.object({
    checkInId: z.number().int(),
    scannedAt: z.coerce.date(),
    deviceId: z.string(),
    kind: z.string(),
});

export const BlockingRequirementSchema = z.object({
    eventRequirementId: z.number().int(),
    /** I18nText — il NOME del requisito. Mai il suo contenuto (`RB12`). */
    label: z.unknown(),
    status: z.string().nullish(),
});

/**
 * L'avviso del saldo alla porta — `14` §7, `RB25` e `RB27`.
 *
 * ── Due campi, e la differenza fra loro è tutta la regola ───────────────────
 * `open` dice **che** un saldo esiste, e lo vede chiunque stia scansionando.
 * `amount` dice **quanto**, ed è `null` per chi non tiene la cassa — non
 * nascosto dalla schermata, proprio assente dalla risposta: la sola strada per
 * non mostrare un dato è non spedirlo, ed è la stessa disciplina di `RB12` sui
 * requisiti.
 *
 * ── L'esito resta `VALID`: un residuo non blocca mai l'ingresso (`RB25`) ────
 * I cinque esiti non diventano sei. La vendita è avvenuta, il denaro si è mosso,
 * e Mirada non fa il buttafuori per conto dell'organizzatore: si registra, si
 * avvisa, si procede. L'operatore fa entrare comunque anche se la persona non
 * paga o discute la cifra — il residuo resta aperto e la questione si risolve
 * fra umani, che è dove va risolta.
 *
 * `null` quando quella persona non deve nulla, che è il caso normale.
 */
export const BalanceNoticeSchema = z.object({
    registrationId: z.number().int(),
    /** C'è ancora qualcosa da versare. È il flag che il volontario vede. */
    open: z.boolean(),
    /** Centesimi ancora aperti. **`null` senza il permesso di cassa** (`RB27`). */
    amount: z.number().int().nullable(),
});

export const TicketVerifyResponseSchema = z.object({
    result: CheckInResultSchema,
    ticketId: z.number().int().nullish(),
    eventId: z.number().int().nullish(),
    sessionId: z.number().int(),
    /** Motivo leggibile dell'esito, in italiano, già pronto per la schermata. */
    message: z.string(),
    holder: VerifiedHolderSchema.nullish(),
    registration: z.unknown().nullish(),
    ticketType: z.unknown().nullish(),
    sessions: VerifiedSessionSchema.array(),
    services: VerifiedServiceSchema.array(),
    blockingRequirement: BlockingRequirementSchema.nullish(),
    firstEntry: FirstEntrySchema.nullish(),
    /**
     * Il saldo ancora da versare, quando c'è (`14` §7.3).
     *
     * Compare a **ogni** scansione finché il residuo è aperto, non solo alla
     * prima: legarlo al primo ingresso avrebbe l'effetto perverso di non
     * intercettare mai più chi non è stato intercettato la prima sera — perché
     * c'era coda, perché la cassa era chiusa, perché il volontario ha lasciato
     * correre.
     */
    balance: BalanceNoticeSchema.nullish(),
    /** Esito della verifica crittografica del QR, quando il codice era un JWS. */
    signature: z
        .object({
            verified: z.boolean(),
            keyId: z.string().nullish(),
            reason: z.string().nullish(),
        })
        .nullish(),
});
export type TicketVerifyResponseDTO = z.infer<typeof TicketVerifyResponseSchema>;
