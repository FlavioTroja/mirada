import { Service } from "fastify-decorators";
import {
    CheckIn,
    CheckInResult,
    DanceRole,
    Prisma,
    Session,
    TicketStatus,
} from "@prisma/client";
import { Log } from "@utils/adapters/log";
import { CheckInRepository } from "@repositories/CheckInRepository";
import { SessionRepository } from "@repositories/SessionRepository";
import { EventServiceRepository } from "@repositories/EventServiceRepository";
import { QuotaConsumptionRepository } from "@repositories/QuotaConsumptionRepository";
import { CapacityQuotaRepository } from "@repositories/CapacityQuotaRepository";
import { TicketRepository, TicketWithContext } from "@repositories/TicketRepository";
import { RequirementOutcomeService, BlockingRequirementSummary } from "@services/RequirementOutcomeService";
import { TicketQrService, QrVerification } from "@services/TicketQrService";
import { TicketVerifyResponseDTO } from "@DTOs/ticket/TicketVerifyDTO";

export type VerificationOutcome = {
    result: CheckInResult;
    message: string;
    ticket: TicketWithContext | null;
    session: Session | null;
    sessionId: number;
    firstEntry: CheckIn | null;
    blockingRequirement: BlockingRequirementSummary | null;
    signature: QrVerification | null;
};

/**
 * # La decisione alla porta — backend-brief §4.13, `RF-CHK-4`
 *
 * Un solo posto in cui si stabilisce se un biglietto entra in una sessione, e tre
 * consumatori: `POST /tickets/verify` (che **non scrive**),
 * `POST /check-ins/create` (l'ingresso online) e `POST /check-ins/sync` (la coda
 * offline). Averne uno solo è ciò che impedisce alle tre strade di dare risposte
 * diverse sullo stesso biglietto.
 *
 * ── I cinque esiti, e perché sono cinque ─────────────────────────────────────
 * `VALID` · `ALREADY_USED` · `WRONG_EVENT` · `REFUNDED_OR_CANCELLED` ·
 * `REQUIREMENT_BLOCKED`. Sono **distinti e inequivocabili** perché all'operatore
 * servono cinque comportamenti diversi: far entrare, chiamare il responsabile,
 * indicare l'altra porta, rimandare alla biglietteria, chiedere il documento che
 * manca. Un unico «non valido» li appiattirebbe tutti sul primo.
 *
 * ── Ciò che questo servizio NON fa ───────────────────────────────────────────
 * **Non consuma capienza** (`RB19`): le quote governano l'ammissione, il
 * contatore presenze governa la sicurezza. Sono due assi distinti.
 * **Non cambia lo stato del biglietto**: l'utilizzo non è uno stato del
 * biglietto, e un Full Pass resta `VALID` dopo dodici scansioni (`09` §7).
 *
 * ── `RB12`, minimizzazione ───────────────────────────────────────────────────
 * La risposta porta nominativo, ruolo di ballo, titolo, sessioni incluse e
 * servizi acquistati. **Mai contatti, mai il contenuto dei requisiti, mai diete
 * o allergie**: il `CHECKIN_OPERATOR` è il ruolo dei volontari e deve vedere il
 * minimo indispensabile.
 */
@Service()
export class CheckInVerificationService {
    constructor(
        private readonly ticketRepository: TicketRepository,
        private readonly checkInRepository: CheckInRepository,
        private readonly sessionRepository: SessionRepository,
        private readonly eventServiceRepository: EventServiceRepository,
        private readonly quotaConsumptionRepository: QuotaConsumptionRepository,
        private readonly capacityQuotaRepository: CapacityQuotaRepository,
        private readonly requirementOutcomeService: RequirementOutcomeService,
        private readonly ticketQrService: TicketQrService,
    ) {}

    /**
     * Valuta un ingresso. `codeOrToken` accetta il codice nudo **oppure** il JWS
     * letto dal QR: quando arriva il JWS **la firma è verificata anche qui**, non
     * solo sul telefono. Un QR manomesso o firmato con una chiave che non
     * conosciamo non entra da nessuna delle due porte.
     */
    public async evaluate(
        input: { codeOrToken?: string | null; ticketId?: number | null; sessionId: number },
        tx?: Prisma.TransactionClient,
    ): Promise<VerificationOutcome> {
        const base = {
            ticket: null,
            session: null,
            sessionId: input.sessionId,
            firstEntry: null,
            blockingRequirement: null,
            signature: null,
        };

        // ── 0. La firma, prima di ogni altra cosa ────────────────────────────
        let code: string | null = null;
        let signature: QrVerification | null = null;

        if (input.codeOrToken) {
            const resolved = this.ticketQrService.resolveCode(input.codeOrToken);
            code = resolved.code;
            signature = resolved.verification;
            if (!code) {
                Log.warn(`[CheckInVerification Service]: entry refused on session (id ${input.sessionId}) — QR signature rejected`);
                return {
                    ...base,
                    result: CheckInResult.WRONG_EVENT,
                    message: (signature && !signature.verified ? signature.message : "Codice non valido."),
                    signature,
                };
            }
        }

        const ticket = code
            ? await this.ticketRepository.findByCodeWithContext(code, tx)
            : input.ticketId
                ? await this.ticketRepository.findByIdWithContext(input.ticketId, tx)
                : null;

        const session = await this.sessionRepository.findOne({ id: input.sessionId, deleted: false }, undefined, tx);

        if (!ticket) {
            // Un codice che non corrisponde ad alcun biglietto è, dal punto di
            // vista dell'operatore, un biglietto di un altro evento o un codice
            // vecchio: è il caso del QR invalidato da un trasferimento.
            Log.warn(`[CheckInVerification Service]: entry refused on session (id ${input.sessionId}) — unknown ticket`);
            return {
                ...base,
                session,
                result: CheckInResult.WRONG_EVENT,
                message: "Codice non riconosciuto: il biglietto non risulta, oppure è stato sostituito da un trasferimento.",
                signature,
            };
        }

        if (!session) {
            return {
                ...base,
                ticket,
                result: CheckInResult.WRONG_EVENT,
                message: "Sessione non trovata.",
                signature,
            };
        }

        // ── 1. Evento sbagliato ──────────────────────────────────────────────
        if (session.eventId !== ticket.eventId) {
            Log.warn(
                `[CheckInVerification Service]: WRONG_EVENT — ticket (id ${ticket.id}) belongs to event `
                + `(id ${ticket.eventId}), session (id ${session.id}) to event (id ${session.eventId})`,
            );
            return {
                ...base,
                ticket,
                session,
                result: CheckInResult.WRONG_EVENT,
                message: "Questo biglietto è di un altro evento.",
                signature,
            };
        }

        // ── 2. Biglietto non più valido ──────────────────────────────────────
        if (
            ticket.status === TicketStatus.CANCELLED
            || ticket.status === TicketStatus.REFUNDED
            || ticket.qrRevokedAt
        ) {
            Log.warn(`[CheckInVerification Service]: REFUNDED_OR_CANCELLED — ticket (id ${ticket.id}) status ${ticket.status}`);
            return {
                ...base,
                ticket,
                session,
                result: CheckInResult.REFUNDED_OR_CANCELLED,
                message: ticket.status === TicketStatus.REFUNDED
                    ? "Biglietto rimborsato: non dà più accesso."
                    : "Biglietto annullato: non dà più accesso.",
                signature,
            };
        }

        // ── 3. Sessione non inclusa nel titolo ───────────────────────────────
        // L'elenco delle sessioni incluse è **esplicito** (`09` §3): niente
        // regole, niente inferenze. Se non c'è, non è compresa.
        const includedSessionIds = ticket.ticketType.sessions.map(link => link.sessionId);
        if (!includedSessionIds.includes(session.id)) {
            Log.warn(
                `[CheckInVerification Service]: WRONG_EVENT — session (id ${session.id}) is not included in ticket type `
                + `(id ${ticket.ticketTypeId}) of ticket (id ${ticket.id})`,
            );
            return {
                ...base,
                ticket,
                session,
                result: CheckInResult.WRONG_EVENT,
                message: "Questa sessione non è compresa nel titolo d'ingresso.",
                signature,
            };
        }

        // ── 4. `RB7` — un QR vale una sola volta per sessione ────────────────
        // Su `ALREADY_USED` si restituiscono **ora e postazione del primo
        // ingresso** (`RF-CHK-4`): senza, l'operatore non ha nulla con cui
        // decidere se sta guardando un doppione o un errore della porta accanto.
        const firstEntry = await this.checkInRepository.findActive(ticket.id, session.id, tx);
        if (firstEntry) {
            Log.warn(
                `[CheckInVerification Service]: ALREADY_USED — ticket (id ${ticket.id}) already entered session `
                + `(id ${session.id}) at ${firstEntry.scannedAt.toISOString()} on device '${firstEntry.deviceId}'`,
            );
            return {
                ...base,
                ticket,
                session,
                firstEntry,
                result: CheckInResult.ALREADY_USED,
                message: `Ingresso già registrato il ${firstEntry.scannedAt.toISOString()} alla postazione '${firstEntry.deviceId}'.`,
                signature,
            };
        }

        // ── 5. Requisiti bloccanti in ingresso ───────────────────────────────
        // `status = TO_CONFIRM` **non blocca mai l'ingresso** (`RF-CPL-13`): non
        // compare fra i controlli, ed è deliberato.
        const blocking = await this.requirementOutcomeService.findBlockingForEntry(
            ticket.registrationId ?? null,
            ticket.eventId,
            tx,
        );
        if (blocking) {
            Log.warn(
                `[CheckInVerification Service]: REQUIREMENT_BLOCKED — ticket (id ${ticket.id}) is missing requirement `
                + `(id ${blocking.eventRequirementId})`,
            );
            return {
                ...base,
                ticket,
                session,
                result: CheckInResult.REQUIREMENT_BLOCKED,
                blockingRequirement: blocking,
                message: "Manca un requisito obbligatorio per l'ingresso.",
                signature,
            };
        }

        Log.info(
            `[CheckInVerification Service]: VALID — ticket (id ${ticket.id}, code ${ticket.code}) may enter session (id ${session.id})`,
        );
        return {
            ...base,
            ticket,
            session,
            result: CheckInResult.VALID,
            message: "Ingresso consentito.",
            signature,
        };
    }

    /**
     * La risposta di `POST /tickets/verify`, **minimizzata** (`RB12`).
     *
     * Nominativo, ruolo di ballo, titolo, sessioni incluse, servizi acquistati.
     * Del requisito bloccante solo il **nome**. Nessun contatto, nessun contenuto
     * di requisito, nessuna dieta: sono i dati che il volontario alla porta non
     * deve vedere, e la sola strada per non mostrarli è non spedirli.
     */
    public async describe(outcome: VerificationOutcome, tx?: Prisma.TransactionClient): Promise<TicketVerifyResponseDTO> {
        const ticket = outcome.ticket;

        if (!ticket) {
            return {
                result: outcome.result,
                ticketId: null,
                eventId: null,
                sessionId: outcome.sessionId,
                message: outcome.message,
                holder: null,
                registration: null,
                ticketType: null,
                sessions: [],
                services: [],
                blockingRequirement: this.describeBlocking(outcome.blockingRequirement),
                firstEntry: null,
                signature: this.describeSignature(outcome),
            };
        }

        const includedSessionIds = ticket.ticketType.sessions.map(link => link.sessionId);
        const sessions = includedSessionIds.length
            ? await this.sessionRepository.findMany(
                { id: { in: includedSessionIds }, deleted: false },
                { orderBy: { startAt: "asc" } },
                tx,
            )
            : [];

        const usedSessionIds = new Set(
            (await this.checkInRepository.findByTicket(ticket.id, tx))
                .filter(entry => !entry.revokedAt && !entry.conflictWithId)
                .map(entry => entry.sessionId),
        );

        const services = await this.resolveServices(ticket.registrationId ?? null, tx);

        return {
            result: outcome.result,
            ticketId: ticket.id,
            eventId: ticket.eventId,
            sessionId: outcome.sessionId,
            message: outcome.message,
            holder: {
                registrationId: ticket.registrationId ?? null,
                name: ticket.holderName,
                surname: ticket.holderSurname,
                // Il **ruolo di ballo** è l'unico attributo della persona che la
                // vista di check-in mostra oltre al nome (§4.13).
                role: (ticket.registration?.assignedRole ?? null) as DanceRole | null,
                bearer: ticket.bearer,
            },
            registration: ticket.registration
                ? {
                    id: ticket.registration.id,
                    holderName: ticket.registration.holderName,
                    holderSurname: ticket.registration.holderSurname,
                    assignedRole: ticket.registration.assignedRole,
                    status: ticket.registration.status,
                    channel: ticket.registration.channel,
                }
                : null,
            ticketType: {
                id: ticket.ticketType.id,
                name: ticket.ticketType.name,
                roleConstraint: ticket.ticketType.roleConstraint,
            },
            sessions: sessions.map(session => ({
                id: session.id,
                name: session.name,
                startAt: session.startAt,
                endAt: session.endAt,
                requested: session.id === outcome.sessionId,
                alreadyUsed: usedSessionIds.has(session.id),
            })),
            services,
            blockingRequirement: this.describeBlocking(outcome.blockingRequirement),
            firstEntry: outcome.firstEntry
                ? {
                    checkInId: outcome.firstEntry.id,
                    scannedAt: outcome.firstEntry.scannedAt,
                    deviceId: outcome.firstEntry.deviceId,
                    kind: outcome.firstEntry.kind,
                }
                : null,
            signature: this.describeSignature(outcome),
        };
    }

    /**
     * I servizi accessori acquistati dall'iscrizione.
     *
     * SCOSTAMENTO DICHIARATO — la sorgente autorevole sarà `OrderLine`
     * (`eventServiceId`), che appartiene al checkout della fase D2 e nel perimetro
     * costruito **non ha ancora né dati né repository**. Fino ad allora i servizi
     * si leggono dai `QuotaConsumption` di ambito `SERVICE`, che sono dati reali e
     * già scritti dal motore di capienza: se l'organizzatore ha configurato una
     * quota per la cena, chi l'ha comprata risulta. Dove la quota non esiste
     * l'elenco è vuoto — mai inventato.
     */
    private async resolveServices(
        registrationId: number | null,
        tx?: Prisma.TransactionClient,
    ): Promise<{ id: number; name: unknown }[]> {
        if (!registrationId) {
            return [];
        }

        const consumptions = await this.quotaConsumptionRepository.findByRegistration(registrationId, tx);
        if (!consumptions.length) {
            return [];
        }

        const quotas = await this.capacityQuotaRepository.findMany(
            { id: { in: consumptions.map(c => c.capacityQuotaId) }, scope: "SERVICE" },
            { orderBy: { id: "asc" } },
            tx,
        );
        const serviceIds = quotas.map(quota => quota.scopeId).filter((id): id is number => !!id);
        if (!serviceIds.length) {
            return [];
        }

        const services = await this.eventServiceRepository.findMany(
            { id: { in: serviceIds }, deleted: false },
            { orderBy: { sortOrder: "asc" } },
            tx,
        );

        // Nome e nulla più: gli `attributesConfig` possono contenere diete e
        // allergie, che non escono mai verso la vista di check-in (`RB12`).
        return services.map(service => ({ id: service.id, name: service.name }));
    }

    private describeBlocking(blocking: BlockingRequirementSummary | null) {
        return blocking
            ? {
                eventRequirementId: blocking.eventRequirementId,
                label: blocking.label,
                status: blocking.status,
            }
            : null;
    }

    private describeSignature(outcome: VerificationOutcome) {
        if (!outcome.signature) {
            return null;
        }
        return outcome.signature.verified
            ? { verified: true, keyId: outcome.signature.keyId, reason: null }
            : { verified: false, keyId: outcome.signature.keyId, reason: outcome.signature.reason };
    }
}
