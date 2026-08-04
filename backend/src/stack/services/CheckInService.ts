import { Service } from "fastify-decorators";
import { createHash } from "node:crypto";
import { CheckIn, CheckInKind, CheckInResult, Event, Prisma, RequirementBlocking } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { getPrismaClient } from "@utils/adapters/prisma";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { CheckInRepository } from "@repositories/CheckInRepository";
import { TicketRepository } from "@repositories/TicketRepository";
import { SessionRepository } from "@repositories/SessionRepository";
import { EventRepository } from "@repositories/EventRepository";
import { EventRequirementRepository } from "@repositories/EventRequirementRepository";
import { EventServiceRepository } from "@repositories/EventServiceRepository";
import { QuotaConsumptionRepository } from "@repositories/QuotaConsumptionRepository";
import { CapacityQuotaRepository } from "@repositories/CapacityQuotaRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { CheckInVerificationService } from "@services/CheckInVerificationService";
import { RequirementOutcomeService } from "@services/RequirementOutcomeService";
import { TicketQrService } from "@services/TicketQrService";
import { OrganizationAudienceService } from "@services/OrganizationAudienceService";
import { WsPublisherService } from "@websocket/publisher/WsPublisherService";
import { Events } from "@websocket/events/Events";
import { CheckInRegisteredPayloadDTO } from "@websocket/dtos/CheckInRegisteredPayloadDTO";
import { CheckInCreateDTO, CheckInSyncDTO, CheckInSyncEntryDTO } from "@DTOs/check_in/CheckInCreateDTO";
import { CheckInUpdateDTO } from "@DTOs/check_in/CheckInUpdateDTO";
import { CheckInQueryDTO } from "@DTOs/check_in/CheckInQueryDTO";
import {
    CheckInSyncAcceptedDTO,
    CheckInSyncConflictDTO,
    CheckInSyncRejectedDTO,
    CheckInSyncResultDTO,
} from "@DTOs/check_in/CheckInResponseDTO";
import {
    CheckInManifestDTO,
    CheckInManifestEntryDTO,
    CheckInManifestPayloadDTO,
} from "@DTOs/check_in/CheckInManifestDTO";
import { TicketVerifyDTO, TicketVerifyResponseDTO } from "@DTOs/ticket/TicketVerifyDTO";

/**
 * # `CheckIn` — backend-brief §4.13, `09-titoli-e-pass.md` §7
 *
 * ── Le tre regole che governano ogni riga di questo file ─────────────────────
 *
 * 1. **L'utilizzo non è uno stato del biglietto** (`09` §7). Un Full Pass viene
 *    scansionato dodici volte in tre giorni e resta `VALID`. Qui non si scrive
 *    mai su `Ticket`: l'ingresso è una riga sulla **coppia biglietto–sessione**,
 *    e per gli eventi senza sessioni si usa la **sessione implicita** creata in
 *    fase B (`AS-5`), così il check-in di una milonga singola gira sullo stesso
 *    codice di quello di un festival.
 * 2. **Il check-in non consuma capienza** (`RB19`). Le quote governano
 *    l'ammissione, il contatore presenze governa la sicurezza: due assi
 *    distinti, e questo servizio non conosce `CapacityEngineService`.
 * 3. **I doppi ingressi rilevati in sincronizzazione sono conflitti da
 *    risolvere, mai risolti in silenzio** (`RF-CHK-6`). La seconda riga viene
 *    **creata** con `conflictWithId` valorizzato e lasciata allo staff. Nessuna
 *    libreria lo fa di serie: è codice su misura, ed è deliberato.
 */
@Service()
export class CheckInService {
    constructor(
        private readonly checkInRepository: CheckInRepository,
        private readonly ticketRepository: TicketRepository,
        private readonly sessionRepository: SessionRepository,
        private readonly eventRepository: EventRepository,
        private readonly eventRequirementRepository: EventRequirementRepository,
        private readonly eventServiceRepository: EventServiceRepository,
        private readonly quotaConsumptionRepository: QuotaConsumptionRepository,
        private readonly capacityQuotaRepository: CapacityQuotaRepository,
        private readonly organizationScopeService: OrganizationScopeService,
        private readonly checkInVerificationService: CheckInVerificationService,
        private readonly requirementOutcomeService: RequirementOutcomeService,
        private readonly ticketQrService: TicketQrService,
        private readonly organizationAudienceService: OrganizationAudienceService,
        private readonly wsPublisher: WsPublisherService,
    ) {}

    // ─────────────────────────────────────────────────────────────────────────
    // `POST /tickets/verify` — verifica ONLINE, senza scrivere nulla
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * `RF-CHK-4` — restituisce **uno dei cinque esiti**, e non registra alcun
     * ingresso: la registrazione è `POST /check-ins/create`, dichiarata a parte
     * nel §3.7 e negli `api_endpoints` della pagina `/check-in`.
     *
     * La separazione non è formale: verificare deve essere **ripetibile**.
     * L'operatore riscansiona quando il telefono non ha vibrato, e una verifica
     * che scrivesse trasformerebbe la seconda scansione in un doppio ingresso.
     */
    public async verify(dto: TicketVerifyDTO): Promise<TicketVerifyResponseDTO> {
        Log.info(`[CheckIn Service]: verifying a ticket for session (id ${dto.sessionId})`);
        const outcome = await this.checkInVerificationService.evaluate({
            codeOrToken: dto.code,
            sessionId: dto.sessionId,
        });
        return this.checkInVerificationService.describe(outcome);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // `POST /check-ins/create` — l'ingresso registrato con rete
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Registra un ingresso **online**.
     *
     * Un secondo ingresso sulla stessa coppia biglietto–sessione è **rifiutato**
     * qui, con `409` e l'ora e la postazione del primo: con la rete l'operatore
     * vede subito l'esito e non deve insistere. La riga di conflitto è invece la
     * risposta corretta **in sincronizzazione**, dove i due ingressi sono già
     * avvenuti e nessuno può più impedirli — l'unica cosa che resta da fare è
     * consegnarli allo staff.
     */
    public async save(principalId: number, dto: CheckInCreateDTO): Promise<CheckIn> {
        const outcome = await this.checkInVerificationService.evaluate({
            ticketId: dto.ticketId,
            sessionId: dto.sessionId,
        });

        if (outcome.result === CheckInResult.ALREADY_USED && outcome.firstEntry) {
            Log.warn(
                `[CheckIn Service]: entry refused — ticket (id ${dto.ticketId}) already entered session `
                + `(id ${dto.sessionId}) at ${outcome.firstEntry.scannedAt.toISOString()}`,
            );
            throw new httpErrors.Conflict(
                `Ingresso già registrato il ${outcome.firstEntry.scannedAt.toISOString()} `
                + `alla postazione '${outcome.firstEntry.deviceId}'.`,
            );
        }
        if (outcome.result !== CheckInResult.VALID) {
            Log.warn(`[CheckIn Service]: entry refused — ${outcome.result}: ${outcome.message}`);
            throw new httpErrors.BadRequest(outcome.message);
        }

        const ticket = outcome.ticket!;
        const registrationId = dto.registrationId ?? ticket.registrationId;
        if (!registrationId) {
            // Un pass al portatore non ha iscrizione: l'ingresso non è
            // registrabile finché qualcuno non lo intesta. È il rovescio
            // dichiarato del pass senza nominativo (§4.12).
            Log.warn(`[CheckIn Service]: entry refused — ticket (id ${ticket.id}) is a bearer pass with no registration`);
            throw new httpErrors.BadRequest(
                "Il pass al portatore non è collegato ad alcuna iscrizione: registra prima l'ingresso della persona.",
            );
        }

        const checkIn = await this.checkInRepository.save({
            ticketId: ticket.id,
            sessionId: dto.sessionId,
            registrationId,
            operatorUserId: principalId,
            kind: dto.kind ?? CheckInKind.OPERATOR,
            scannedAt: dto.scannedAt ?? new Date(),
            deviceId: dto.deviceId,
            offline: dto.offline ?? false,
        });

        Log.info(
            `[CheckIn Service]: entry registered (id ${checkIn.id}) — ticket (id ${ticket.id}) into session `
            + `(id ${dto.sessionId}) by operator (id ${principalId}) at '${dto.deviceId}'`,
        );

        await this.publishRegistered(ticket.eventId, dto.sessionId);
        return checkIn;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // `POST /check-ins/sync` — la coda locale che torna a casa (`RF-CHK-6`)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Riceve la coda locale e restituisce `{ accepted[], conflicts[] }`.
     *
     * ── Perché i conflitti non si risolvono ──────────────────────────────────
     * Due operatori, due porte, nessuna rete: entrambi hanno fatto entrare la
     * stessa persona, e nessuna regola automatica può sapere quale dei due
     * ingressi sia quello buono — o se lo siano entrambi, perché il biglietto è
     * stato passato di mano nel cortile. Il sistema **crea la seconda riga con
     * `conflictWithId` valorizzato** e la consegna a `/check-in/conflicts`, dove
     * lo staff vede i due ingressi con ora e postazione e decide. Scartare il
     * secondo in silenzio significherebbe perdere il fatto che è avvenuto, che è
     * l'unica informazione che conta.
     *
     * ── Idempotenza ─────────────────────────────────────────────────────────
     * Una coda che rispedisce la stessa voce dopo un timeout non deve produrre un
     * conflitto con se stessa: stesso biglietto, stessa sessione, stessa
     * postazione e **stesso istante di scansione** sono la stessa riga, e
     * tornano in `accepted`.
     */
    public async sync(principalId: number, dto: CheckInSyncDTO): Promise<CheckInSyncResultDTO> {
        Log.info(`[CheckIn Service]: syncing ${dto.entries.length} queued entr(y|ies) from the offline queue`);

        const accepted: CheckInSyncAcceptedDTO[] = [];
        const conflicts: CheckInSyncConflictDTO[] = [];
        const rejected: CheckInSyncRejectedDTO[] = [];
        const touchedSessions = new Map<number, number>();

        for (const entry of dto.entries) {
            const result = await this.syncOne(principalId, entry);

            if (result.kind === "accepted") {
                accepted.push(result.value);
                touchedSessions.set(entry.sessionId, result.eventId);
            } else if (result.kind === "conflict") {
                conflicts.push(result.value);
                touchedSessions.set(entry.sessionId, result.eventId);
            } else {
                rejected.push(result.value);
            }
        }

        Log.info(
            `[CheckIn Service]: sync completed — ${accepted.length} accepted, ${conflicts.length} conflict(s) `
            + `left to the staff, ${rejected.length} rejected`,
        );

        for (const [sessionId, eventId] of touchedSessions) {
            await this.publishRegistered(eventId, sessionId);
        }

        return { accepted, conflicts, rejected };
    }

    private async syncOne(
        principalId: number,
        entry: CheckInSyncEntryDTO,
    ): Promise<
        | { kind: "accepted"; value: CheckInSyncAcceptedDTO; eventId: number }
        | { kind: "conflict"; value: CheckInSyncConflictDTO; eventId: number }
        | { kind: "rejected"; value: CheckInSyncRejectedDTO }
    > {
        const outcome = await this.checkInVerificationService.evaluate({
            codeOrToken: entry.code ?? null,
            ticketId: entry.ticketId ?? null,
            sessionId: entry.sessionId,
        });

        const reject = (reason: string, message: string) => ({
            kind: "rejected" as const,
            value: {
                localId: entry.localId ?? null,
                code: entry.code ?? null,
                ticketId: entry.ticketId ?? null,
                sessionId: entry.sessionId,
                reason,
                message,
            },
        });

        if (!outcome.ticket) {
            return reject(outcome.result, outcome.message);
        }
        const ticket = outcome.ticket;

        // Un requisito mancante scoperto solo ora non annulla un ingresso già
        // avvenuto: la persona è entrata, e il sistema deve dirlo. Si registra
        // l'ingresso e lo si segnala allo staff attraverso l'esito della verifica
        // successiva, non riscrivendo il passato.
        if (
            outcome.result === CheckInResult.WRONG_EVENT
            || outcome.result === CheckInResult.REFUNDED_OR_CANCELLED
        ) {
            return reject(outcome.result, outcome.message);
        }

        const registrationId = ticket.registrationId;
        if (!registrationId) {
            return reject(
                "BEARER_WITHOUT_REGISTRATION",
                "Il pass al portatore non è collegato ad alcuna iscrizione: l'ingresso non è registrabile.",
            );
        }

        // Idempotenza: la stessa scansione, non un secondo ingresso.
        const same = await this.checkInRepository.findSameScan({
            ticketId: ticket.id,
            sessionId: entry.sessionId,
            deviceId: entry.deviceId,
            scannedAt: entry.scannedAt,
        });
        if (same) {
            Log.info(
                `[CheckIn Service]: sync entry is a replay of check-in (id ${same.id}) — same ticket, session, `
                + `device and scan instant. No new row.`,
            );
            return {
                kind: "accepted",
                eventId: ticket.eventId,
                value: { localId: entry.localId ?? null, checkIn: same, duplicateOfSameScan: true },
            };
        }

        const firstEntry = outcome.firstEntry;

        const created = await this.checkInRepository.save({
            ticketId: ticket.id,
            sessionId: entry.sessionId,
            registrationId,
            operatorUserId: principalId,
            kind: entry.kind ?? CheckInKind.OPERATOR,
            scannedAt: entry.scannedAt,
            syncedAt: new Date(),
            deviceId: entry.deviceId,
            offline: true,
            // ── `RF-CHK-6` ───────────────────────────────────────────────────
            // La riga esiste comunque. Se un ingresso valido c'era già, questa
            // nasce **marcata come conflitto** e attende una decisione umana.
            conflictWithId: firstEntry?.id ?? null,
        });

        if (firstEntry) {
            Log.warn(
                `[CheckIn Service]: CONFLICT — queued entry for ticket (id ${ticket.id}) on session (id ${entry.sessionId}) `
                + `collides with check-in (id ${firstEntry.id}) of ${firstEntry.scannedAt.toISOString()} at `
                + `'${firstEntry.deviceId}'. Row (id ${created.id}) created and left to the staff, never resolved silently.`,
            );
            return {
                kind: "conflict",
                eventId: ticket.eventId,
                value: {
                    localId: entry.localId ?? null,
                    checkIn: created,
                    conflictsWith: firstEntry,
                    reason: "ALREADY_CHECKED_IN",
                },
            };
        }

        Log.info(
            `[CheckIn Service]: queued entry accepted (id ${created.id}) — ticket (id ${ticket.id}) into session `
            + `(id ${entry.sessionId}), scanned offline at ${entry.scannedAt.toISOString()}`,
        );
        return {
            kind: "accepted",
            eventId: ticket.eventId,
            value: { localId: entry.localId ?? null, checkIn: created, duplicateOfSameScan: false },
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // `POST /check-ins/:id/revoke` — annullamento di un ingresso errato
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * `RF-CHK-9`. Non cancella la riga: la **marca revocata**, così l'ingresso
     * resta leggibile come fatto avvenuto e corretto. Uscendo dall'indice
     * parziale, il biglietto può rientrare in quella sessione — che è
     * precisamente ciò che serve dopo una scansione sbagliata alla porta.
     *
     * È anche il modo in cui un conflitto si risolve: si revoca la riga che si
     * scarta, e restano la decisione e la sua traccia.
     */
    public async revoke(principalId: number, id: number): Promise<CheckIn> {
        const checkIn = await this.findByIdOrThrow(principalId, id);

        if (checkIn.revokedAt) {
            Log.warn(`[CheckIn Service]: revoke refused — check-in (id ${id}) is already revoked`);
            throw new httpErrors.BadRequest("Questo ingresso è già stato annullato.");
        }

        Log.info(`[CheckIn Service]: revoking check-in (id ${id}) by operator (id ${principalId})`);
        const revoked = await this.checkInRepository.update({ id }, { revokedAt: new Date() });

        const session = await this.sessionRepository.findOne({ id: checkIn.sessionId });
        if (session) {
            await this.publishRegistered(session.eventId, session.id);
        }
        return revoked;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // `GET /events/:id/checkin-manifest` — la lista firmata (`RF-CHK-2`, `RF-CHK-3`)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * La lista dell'evento in forma **firmata**, più la **chiave pubblica
     * Ed25519**, più le sessioni e i requisiti bloccanti in ingresso. È ciò che
     * l'operatore scarica prima dell'evento e conserva in IndexedDB.
     *
     * ── Perché la chiave viaggia con la lista ────────────────────────────────
     * Perché in sala non c'è rete, e la verifica del QR deve funzionare lo
     * stesso. Senza la chiave sul dispositivo, la firma Ed25519 sarebbe
     * verificabile solo online, cioè proprio quando non serve.
     *
     * ── `RB12`, minimizzazione ───────────────────────────────────────────────
     * Nominativo, ruolo, titolo, sessioni incluse, servizi. **Nessuna email**,
     * nessun contenuto di requisito, nessuna dieta. Dei requisiti bloccanti si
     * porta il nome e lo stato: quanto basta per dire «manca la liberatoria» alla
     * porta, e nulla di ciò che la liberatoria contiene.
     */
    public async manifest(principalId: number, eventId: number): Promise<CheckInManifestDTO> {
        const event = await this.findEventInScopeOrThrow(principalId, eventId);

        Log.info(`[CheckIn Service]: building the check-in manifest of event '${event.slug}' (id ${eventId})`);

        const sessions = await this.sessionRepository.findByEvent(eventId);
        const requirements = await this.eventRequirementRepository.findMany(
            { eventId, deleted: false, blocking: RequirementBlocking.ENTRY },
            { orderBy: { sortOrder: "asc" } },
        );
        const tickets = await this.ticketRepository.findLiveByEventWithContext(eventId);

        const registrationIds = tickets
            .map(ticket => ticket.registrationId)
            .filter((id): id is number => !!id);
        const blockingByRegistration = await this.requirementOutcomeService.listBlockingForEntry(
            [...new Set(registrationIds)],
            eventId,
        );
        const servicesByRegistration = await this.resolveServicesByRegistration([...new Set(registrationIds)]);

        const entries: CheckInManifestEntryDTO[] = tickets.map(ticket => ({
            ticketId: ticket.id,
            code: ticket.code,
            status: ticket.status,
            bearer: ticket.bearer,
            holderName: ticket.holderName,
            holderSurname: ticket.holderSurname,
            role: ticket.registration?.assignedRole ?? null,
            registrationId: ticket.registrationId ?? null,
            ticketTypeId: ticket.ticketTypeId,
            ticketTypeName: ticket.ticketType.name,
            sessionIds: ticket.ticketType.sessions.map(link => link.sessionId),
            services: ticket.registrationId ? servicesByRegistration.get(ticket.registrationId) ?? [] : [],
            blockingRequirements: ticket.registrationId
                ? (blockingByRegistration.get(ticket.registrationId) ?? []).map(item => ({
                    eventRequirementId: item.eventRequirementId,
                    label: item.label,
                    status: item.status,
                }))
                : [],
        }));

        const payload: CheckInManifestPayloadDTO = {
            eventId: event.id,
            eventSlug: event.slug,
            eventTitle: event.title,
            generatedAt: new Date(),
            sessions: sessions.map(session => ({
                id: session.id,
                name: session.name,
                startAt: session.startAt,
                endAt: session.endAt,
                room: session.room,
                isImplicit: session.isImplicit,
                cancelledAt: session.cancelledAt,
            })),
            blockingRequirements: requirements.map(requirement => ({
                id: requirement.id,
                label: requirement.label,
                mandatory: requirement.mandatory,
            })),
            entries,
        };

        // La lista è firmata a sua volta: una lista alterata sul dispositivo è una
        // lista che ammette chi non ha pagato.
        const signature = this.ticketQrService.sign({
            manifestOf: event.id,
            generatedAt: payload.generatedAt.toISOString(),
            entryCount: entries.length,
            digest: this.digest(payload),
        });

        Log.info(
            `[CheckIn Service]: manifest of event (id ${eventId}) signed with key '${signature.keyId}' — `
            + `${entries.length} entr(y|ies), ${sessions.length} session(s), ${requirements.length} entry-blocking requirement(s)`,
        );

        return {
            manifest: payload,
            signature: { algorithm: "Ed25519", keyId: signature.keyId, value: signature.value },
            publicKey: this.ticketQrService.publicKey(),
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CRUD del dialetto (§3.2)
    // ─────────────────────────────────────────────────────────────────────────

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<CheckIn | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.checkInRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async paginate(
        principalId: number,
        query: CheckInQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<CheckIn>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.checkInRepository.paginateInScope(scope, this.createQueryFromPayload(query), options);
    }

    public async updateById(principalId: number, id: number, dto: CheckInUpdateDTO): Promise<CheckIn> {
        await this.findByIdOrThrow(principalId, id);
        Log.info(`[CheckIn Service]: updating check-in (id ${id})`);
        return this.checkInRepository.update({ id }, dto as Prisma.CheckInUpdateInput);
    }

    public async safeDeleteById(principalId: number, id: number): Promise<CheckIn> {
        await this.findByIdOrThrow(principalId, id);
        Log.info(`[CheckIn Service]: soft deleting check-in (id ${id})`);
        return this.checkInRepository.safeDeleteById(id);
    }

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Vedi la nota di `CheckInVerificationService.resolveServices`: fino al
     * checkout della fase D2 i servizi acquistati si leggono dai consumi di quota
     * di ambito `SERVICE`, che sono dati reali. Mai inventati, mai desunti.
     */
    private async resolveServicesByRegistration(
        registrationIds: number[],
    ): Promise<Map<number, { id: number; name: unknown }[]>> {
        const result = new Map<number, { id: number; name: unknown }[]>();
        if (!registrationIds.length) {
            return result;
        }

        const consumptions = await this.quotaConsumptionRepository.findByRegistrations(registrationIds);
        if (!consumptions.length) {
            return result;
        }

        const quotas = await this.capacityQuotaRepository.findMany(
            { id: { in: consumptions.map(c => c.capacityQuotaId) }, scope: "SERVICE" },
            { orderBy: { id: "asc" } },
        );
        if (!quotas.length) {
            return result;
        }

        const quotaToService = new Map(quotas.map(quota => [quota.id, quota.scopeId]));
        const services = await this.eventServiceRepository.findMany(
            { id: { in: quotas.map(q => q.scopeId!).filter(Boolean) }, deleted: false },
            { orderBy: { sortOrder: "asc" } },
        );
        const byId = new Map(services.map(service => [service.id, service]));

        for (const consumption of consumptions) {
            const serviceId = quotaToService.get(consumption.capacityQuotaId);
            const service = serviceId ? byId.get(serviceId) : undefined;
            if (!service) continue;
            const list = result.get(consumption.registrationId) ?? [];
            list.push({ id: service.id, name: service.name });
            result.set(consumption.registrationId, list);
        }

        return result;
    }

    /** Digest stabile del manifest: chiavi ordinate, così la firma è riproducibile. */
    private digest(payload: CheckInManifestPayloadDTO): string {
        const canonical = JSON.stringify(payload, (_key, value) => {
            if (value && typeof value === "object" && !Array.isArray(value)) {
                return Object.keys(value as Record<string, unknown>)
                    .sort()
                    .reduce<Record<string, unknown>>((acc, key) => {
                        acc[key] = (value as Record<string, unknown>)[key];
                        return acc;
                    }, {});
            }
            return value;
        });
        return createHash("sha256").update(canonical).digest("base64");
    }

    /**
     * §3.9 — **immediato, non aggregato**: è il contatore presenze, e una cifra
     * di sicurezza in ritardo è una cifra sbagliata. Il publish avviene comunque
     * **dopo** la scrittura, mai dentro una transazione.
     */
    private async publishRegistered(eventId: number, sessionId: number): Promise<void> {
        try {
            const event = await this.eventRepository.findOne({ id: eventId });
            if (!event) {
                return;
            }
            const wsCodes = await this.organizationAudienceService.resolveMemberWsCodes(event.organizationId);
            if (!wsCodes.length) {
                return;
            }
            const payload: CheckInRegisteredPayloadDTO = {
                eventId,
                organizationId: event.organizationId,
                sessionId,
            };
            await this.wsPublisher.sendToUsers(wsCodes, Events.CHECKIN_REGISTERED, payload);
        } catch (err) {
            Log.error(`[CheckIn Service]: failed to publish 'checkin/registered' for event (id ${eventId}): ${(err as Error).message}`);
        }
    }

    private async findEventInScopeOrThrow(principalId: number, eventId: number): Promise<Event> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const event = await this.eventRepository.findOneInScope(scope, { id: eventId, deleted: false });
        if (!event) {
            Log.warn(`[CheckIn Service]: event (id ${eventId}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Evento non trovato.");
        }
        return event;
    }

    private async findByIdOrThrow(principalId: number, id: number): Promise<CheckIn> {
        const checkIn = await this.findById(principalId, id);
        if (!checkIn) {
            Log.warn(`[CheckIn Service]: check-in (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Ingresso non trovato.");
        }
        return checkIn;
    }

    private createQueryFromPayload(payload: CheckInQueryDTO): Prisma.CheckInWhereInput {
        const query: Prisma.CheckInWhereInput[] = [
            { deleted: false },
            payload.includeRevoked ? {} : { revokedAt: null },
            payload.conflictsOnly ? { conflictWithId: { not: null } } : {},
            createObjectWithoutThrow(payload.sessionId, { sessionId: payload.sessionId }),
            createObjectWithoutThrow(payload.ticketId, { ticketId: payload.ticketId }),
            createObjectWithoutThrow(payload.registrationId, { registrationId: payload.registrationId }),
            createObjectWithoutThrow(payload.operatorUserId, { operatorUserId: payload.operatorUserId }),
            createObjectWithoutThrow(payload.kind, { kind: payload.kind }),
            createObjectWithoutThrow(payload.eventId, { session: { eventId: payload.eventId } }),
            payload.offline === undefined ? {} : { offline: payload.offline },
            createObjectWithoutThrow(payload.value, {
                OR: [
                    { deviceId: { contains: payload.value ?? "", mode: "insensitive" as const } },
                    { ticket: { code: { contains: payload.value ?? "", mode: "insensitive" as const } } },
                    { ticket: { holderSurname: { contains: payload.value ?? "", mode: "insensitive" as const } } },
                ],
            }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
