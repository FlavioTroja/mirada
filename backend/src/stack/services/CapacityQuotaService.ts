import { Service } from "fastify-decorators";
import { CapacityQuota, DanceRole, Event, Prisma, QuotaScope } from "@prisma/client";
import httpErrors from "http-errors";
import { isBoolean } from "lodash";
import { Log } from "@utils/adapters/log";
import { getPrismaClient } from "@utils/adapters/prisma";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { CapacityQuotaRepository } from "@repositories/CapacityQuotaRepository";
import { EventRepository } from "@repositories/EventRepository";
import { SessionRepository } from "@repositories/SessionRepository";
import { TicketTypeRepository } from "@repositories/TicketTypeRepository";
import { EventServiceRepository } from "@repositories/EventServiceRepository";
import { VenueRepository } from "@repositories/VenueRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { CapacityQuotaCreateDTO } from "@DTOs/capacity_quota/CapacityQuotaCreateDTO";
import { CapacityQuotaUpdateDTO } from "@DTOs/capacity_quota/CapacityQuotaUpdateDTO";
import { CapacityQuotaQueryDTO } from "@DTOs/capacity_quota/CapacityQuotaQueryDTO";

/**
 * CRUD e regole di configurazione delle quote — backend-brief §4.8.
 *
 * Il **motore** (impegno, rilascio, disponibilità) vive in
 * `CapacityEngineService`: qui c'è soltanto ciò che governa come una quota nasce,
 * cambia e muore. La separazione non è estetica — l'algoritmo va collaudato senza
 * passare da permessi, scope e DTO, ed è la ragione per cui il §0.6 del brief
 * chiede di costruirlo e collaudarlo *prima di avere un'interfaccia*.
 *
 * `consumed` **non è mai scritto da qui**: è un campo calcolato dal server (§5) e
 * si muove solo attraverso il motore.
 */
@Service()
export class CapacityQuotaService {
    constructor(
        private readonly capacityQuotaRepository: CapacityQuotaRepository,
        private readonly eventRepository: EventRepository,
        private readonly sessionRepository: SessionRepository,
        private readonly ticketTypeRepository: TicketTypeRepository,
        private readonly eventServiceRepository: EventServiceRepository,
        private readonly venueRepository: VenueRepository,
        private readonly organizationScopeService: OrganizationScopeService,
    ) {}

    // ─────────────────────────────────────────────────────────────────────────
    // CRUD del dialetto (§3.2)
    // ─────────────────────────────────────────────────────────────────────────

    public async save(principalId: number, dto: CapacityQuotaCreateDTO): Promise<CapacityQuota> {
        await this.assertWritableEvent(principalId, dto.eventId);
        await this.assertScopeIsCoherent(dto.eventId, dto.scope, dto.scopeId ?? null, dto.role ?? null);

        const forced = this.forceHardConstraints(dto.scope, {
            limiting: dto.limiting,
            overbookAllowance: dto.overbookAllowance,
        });

        Log.info(
            `[CapacityQuota Service]: creating ${dto.scope}${dto.role ? `/${dto.role}` : ""} quota on event `
            + `(id ${dto.eventId}) with limit ${dto.limit}`,
        );

        const quota = await this.capacityQuotaRepository.save({
            ...(dto as any),
            ...forced,
            // Mai dal client: si muove solo attraverso il motore (§5).
            consumed: 0,
        });

        Log.info(`[CapacityQuota Service]: quota created (id ${quota.id})`);
        return quota;
    }

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<CapacityQuota | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.capacityQuotaRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async paginate(
        principalId: number,
        query: CapacityQuotaQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<CapacityQuota>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.capacityQuotaRepository.paginateInScope(scope, this.createQueryFromPayload(query), options);
    }

    /**
     * Modifica dei limiti da parte dell'organizzatore — `05` §9.
     *
     * | Operazione | Regola |
     * |---|---|
     * | Aumento del limite | sempre consentito |
     * | Riduzione a un valore ≥ `consumed` | consentita |
     * | Riduzione a un valore < `consumed` | **ammessa, con avviso**: la disponibilità va a zero e la vendita si chiude |
     * | Modifica della tolleranza | sempre consentita, senza effetti retroattivi |
     * | Da non limitante a limitante con `consumed > limit` | **rifiutata** |
     *
     * **Nessuna modifica di configurazione può espellere qualcuno che è già
     * dentro.** È l'invariante che protegge la fiducia dei partecipanti, e per
     * questo la riduzione sotto il consumato non invalida alcun biglietto: chiude
     * la vendita e basta.
     *
     * ⚠︎ CONTRADDIZIONE INTERNA A `05`, RISOLTA A FAVORE DEL §9. Il caso di test
     * T16 del §13 dichiara la riduzione sotto il consumato **«rifiutata, con
     * proposta di chiusura a 105»**, mentre la tabella normativa del §9 la
     * dichiara **«ammessa, con avviso»**. Le due cose non possono essere entrambe
     * vere. Vale il §9, che è la regola; T16 è la casistica. La divergenza è
     * segnalata al committente e la scelta è reversibile in un punto solo.
     */
    public async updateById(principalId: number, id: number, dto: CapacityQuotaUpdateDTO): Promise<CapacityQuota> {
        const quota = await this.findByIdOrThrow(principalId, id);
        await this.assertWritableEvent(principalId, quota.eventId);

        const nextLimiting = dto.limiting ?? quota.limiting;
        const nextLimit = dto.limit ?? quota.limit;
        const nextOverbook = dto.overbookAllowance ?? quota.overbookAllowance;

        // Sulla capienza della sala e sulle quote di ruolo di ambito EVENT lo
        // sforamento è FORZATO A 0 E NON MODIFICABILE, e `limiting` è forzato a
        // true: non è un limite commerciale, è un vincolo di sicurezza (`05` §5.1).
        if (quota.scope === QuotaScope.EVENT) {
            if (dto.overbookAllowance !== undefined && dto.overbookAllowance !== 0) {
                Log.warn(
                    `[CapacityQuota Service]: update refused for quota (id ${id}) — overbookAllowance is forced to 0 `
                    + `and not modifiable on EVENT-scope quotas`,
                );
                throw new httpErrors.BadRequest(
                    "La capienza della sala e le quote di ruolo dell'evento non ammettono sforamento: il valore è fissato a 0 e non è modificabile.",
                );
            }
            if (dto.limiting === false) {
                Log.warn(`[CapacityQuota Service]: update refused for quota (id ${id}) — EVENT-scope quotas are always limiting`);
                throw new httpErrors.BadRequest(
                    "La capienza della sala e le quote di ruolo dell'evento sono sempre limitanti: il vincolo non è disattivabile.",
                );
            }
        }

        if (!quota.limiting && nextLimiting && quota.consumed > nextLimit + nextOverbook) {
            Log.warn(
                `[CapacityQuota Service]: update refused for quota (id ${id}) — cannot turn a non-limiting quota into a `
                + `limiting one while consumed ${quota.consumed} exceeds limit ${nextLimit} (+${nextOverbook})`,
            );
            throw new httpErrors.BadRequest(
                `La quota conta già ${quota.consumed} posti, oltre il limite di ${nextLimit}: non può diventare limitante. `
                + `Alza il limite ad almeno ${quota.consumed} oppure chiudi la vendita.`,
            );
        }

        if (dto.limit !== undefined && dto.limit < quota.consumed) {
            // Ammessa, con avviso (`05` §9): nessun biglietto emesso è invalidato,
            // nessuno viene espulso; la disponibilità online va semplicemente a zero.
            Log.warn(
                `[CapacityQuota Service]: quota (id ${id}) reduced from ${quota.limit} to ${dto.limit} below its `
                + `consumed ${quota.consumed} — online availability drops to zero, no issued ticket is invalidated`,
            );
        }

        Log.info(`[CapacityQuota Service]: updating quota (id ${id})`);
        return this.capacityQuotaRepository.update({ id }, dto as any);
    }

    /**
     * `05` §9 — **l'eliminazione di una quota con `consumed > 0` è rifiutata**: si
     * può solo chiudere. Cancellarla farebbe sparire il vincolo *e* la traccia di
     * ciò che è già stato venduto sotto quel vincolo.
     */
    public async safeDeleteById(principalId: number, id: number): Promise<CapacityQuota> {
        const quota = await this.findByIdOrThrow(principalId, id);
        await this.assertWritableEvent(principalId, quota.eventId);

        if (quota.consumed > 0) {
            Log.warn(`[CapacityQuota Service]: delete refused for quota (id ${id}) — ${quota.consumed} seat(s) already consumed`);
            throw new httpErrors.BadRequest(
                `La quota ha già ${quota.consumed} posti impegnati e non può essere eliminata: si può solo chiudere la vendita abbassando il limite.`,
            );
        }

        Log.info(`[CapacityQuota Service]: soft deleting quota (id ${id})`);
        return this.capacityQuotaRepository.safeDeleteById(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Utilità di configurazione
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * §4.4 — la capienza della sala in anagrafica è **proposta** come default alla
     * creazione della quota, **non imposta**: assenza di quota significa assenza
     * di vincolo (`05` §4). Restituisce `null` quando non c'è nulla da proporre.
     */
    public async suggestRoomCapacity(principalId: number, eventId: number): Promise<number | null> {
        const event = await this.assertWritableEvent(principalId, eventId);
        const venue = await this.venueRepository.findOne({ id: event.venueId, deleted: false });
        Log.debug(
            `[CapacityQuota Service]: room capacity suggestion for event (id ${eventId}) — `
            + `venue (id ${event.venueId}) declares ${venue?.capacity ?? "no"} capacity`,
        );
        return venue?.capacity ?? null;
    }

    /**
     * `RF-EVT-16` — clonazione delle quote in una nuova edizione, **con
     * `consumed = 0`** (§4.5). Chiamata dentro la transazione di
     * `EventService.duplicate`.
     */
    public async cloneForEvent(
        sourceEventId: number,
        targetEventId: number,
        scopeIdMap: { sessions: Map<number, number>; ticketTypes: Map<number, number>; services: Map<number, number> },
        tx: Prisma.TransactionClient,
    ): Promise<number> {
        const quotas = await this.capacityQuotaRepository.findByEvent(sourceEventId, tx);
        let cloned = 0;

        for (const quota of quotas) {
            const scopeId = this.remapScopeId(quota, scopeIdMap);
            // Una quota il cui ambito non è stato clonato non ha più un referente:
            // clonarla con lo `scopeId` originale la aggancerebbe alla sessione di
            // un altro evento, che è peggio di non averla.
            if (quota.scope !== QuotaScope.EVENT && scopeId === null) {
                Log.warn(
                    `[CapacityQuota Service]: skipping quota (id ${quota.id}, ${quota.scope}) while duplicating event `
                    + `(id ${sourceEventId}) — its scope was not cloned`,
                );
                continue;
            }

            await this.capacityQuotaRepository.save(
                {
                    eventId: targetEventId,
                    scope: quota.scope,
                    scopeId,
                    role: quota.role,
                    limit: quota.limit,
                    consumed: 0,
                    limiting: quota.limiting,
                    reservedFor: quota.reservedFor,
                    imbalanceTolerance: quota.imbalanceTolerance,
                    overbookAllowance: quota.overbookAllowance,
                    publiclyVisible: quota.publiclyVisible,
                },
                tx,
            );
            cloned += 1;
        }

        Log.info(`[CapacityQuota Service]: cloned ${cloned} quota(s) from event (id ${sourceEventId}) to (id ${targetEventId}) with consumed = 0`);
        return cloned;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Validazioni (§4.8)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Sulla quota `(scope=EVENT, role=null)` — la capienza della sala —
     * `overbookAllowance` è **forzato a 0 e non modificabile** e `limiting` è
     * **forzato a true**. Stessa regola sulle quote di ruolo di ambito `EVENT`.
     */
    private forceHardConstraints(
        scope: QuotaScope,
        input: { limiting?: boolean | null; overbookAllowance?: number | null },
    ): { limiting: boolean; overbookAllowance: number } {
        if (scope === QuotaScope.EVENT) {
            if (input.overbookAllowance) {
                Log.warn(
                    `[CapacityQuota Service]: overbookAllowance ${input.overbookAllowance} ignored on an EVENT-scope quota — `
                    + `forced to 0 (safety constraint, not a commercial one)`,
                );
            }
            if (input.limiting === false) {
                Log.warn(`[CapacityQuota Service]: limiting = false ignored on an EVENT-scope quota — forced to true`);
            }
            return { limiting: true, overbookAllowance: 0 };
        }

        return {
            limiting: input.limiting ?? true,
            overbookAllowance: input.overbookAllowance ?? 0,
        };
    }

    /**
     * `scopeId` è un riferimento **polimorfo senza chiave esterna**: la coerenza
     * sta qui, non nel database (§4.8).
     *  - non nullo per ogni `scope ≠ EVENT`, e nullo su `EVENT`;
     *  - deve puntare a una riga **dello stesso evento**;
     *  - `role` valorizzabile solo su `scope ∈ {EVENT, SESSION}`.
     */
    private async assertScopeIsCoherent(
        eventId: number,
        scope: QuotaScope,
        scopeId: number | null,
        role: DanceRole | null,
    ): Promise<void> {
        if (scope === QuotaScope.EVENT && scopeId !== null) {
            throw new httpErrors.BadRequest("Una quota di ambito evento non porta un riferimento di ambito.");
        }
        if (scope !== QuotaScope.EVENT && scopeId === null) {
            throw new httpErrors.BadRequest("Una quota di ambito sessione, titolo o servizio richiede il riferimento all'oggetto.");
        }
        if (role && scope !== QuotaScope.EVENT && scope !== QuotaScope.SESSION) {
            Log.warn(`[CapacityQuota Service]: refused a ${scope} quota carrying role ${role}`);
            throw new httpErrors.BadRequest(
                "Le quote di titolo e di servizio sono per persona, indipendentemente dal ruolo di ballo: non ammettono un ruolo.",
            );
        }

        if (scopeId === null) {
            return;
        }

        const exists = await this.scopeTargetExists(eventId, scope, scopeId);
        if (!exists) {
            Log.warn(`[CapacityQuota Service]: refused a ${scope} quota — target (id ${scopeId}) does not belong to event (id ${eventId})`);
            throw new httpErrors.BadRequest("L'oggetto a cui la quota si riferisce non appartiene a questo evento.");
        }
    }

    private async scopeTargetExists(eventId: number, scope: QuotaScope, scopeId: number): Promise<boolean> {
        switch (scope) {
            case QuotaScope.SESSION:
                return !!(await this.sessionRepository.findOne({ id: scopeId, eventId, deleted: false }));
            case QuotaScope.TICKET_TYPE:
                return !!(await this.ticketTypeRepository.findOne({ id: scopeId, eventId, deleted: false }));
            case QuotaScope.SERVICE:
                return !!(await this.eventServiceRepository.findOne({ id: scopeId, eventId, deleted: false }));
            default:
                return true;
        }
    }

    private remapScopeId(
        quota: CapacityQuota,
        map: { sessions: Map<number, number>; ticketTypes: Map<number, number>; services: Map<number, number> },
    ): number | null {
        if (quota.scopeId === null) {
            return null;
        }
        switch (quota.scope) {
            case QuotaScope.SESSION:
                return map.sessions.get(quota.scopeId) ?? null;
            case QuotaScope.TICKET_TYPE:
                return map.ticketTypes.get(quota.scopeId) ?? null;
            case QuotaScope.SERVICE:
                return map.services.get(quota.scopeId) ?? null;
            default:
                return null;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    private async assertWritableEvent(principalId: number, eventId: number): Promise<Event> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const event = await this.eventRepository.findOneInScope(scope, { id: eventId, deleted: false });
        if (!event) {
            Log.warn(`[CapacityQuota Service]: event (id ${eventId}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Evento non trovato.");
        }
        this.organizationScopeService.assertWritable(scope, event.organizationId);
        return event;
    }

    private async findByIdOrThrow(principalId: number, id: number): Promise<CapacityQuota> {
        const quota = await this.findById(principalId, id);
        if (!quota) {
            Log.warn(`[CapacityQuota Service]: quota (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Quota di capienza non trovata.");
        }
        return quota;
    }

    private createQueryFromPayload(payload: CapacityQuotaQueryDTO): Prisma.CapacityQuotaWhereInput {
        const query: Prisma.CapacityQuotaWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(payload.eventId, { eventId: payload.eventId }),
            createObjectWithoutThrow(payload.scope, { scope: payload.scope }),
            createObjectWithoutThrow(payload.scopeId, { scopeId: payload.scopeId }),
            createObjectWithoutThrow(payload.role, { role: payload.role }),
            createObjectWithoutThrow(payload.reservedFor, { reservedFor: payload.reservedFor }),
            createObjectWithoutThrow(isBoolean(payload.limiting), { limiting: payload.limiting }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
