import { Service } from "fastify-decorators";
import {
    Event,
    EventStatus,
    FiscalDeclarationKind,
    OrganizationStatus,
    PayoutStatus,
    Prisma,
} from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { getPrismaClient } from "@utils/adapters/prisma";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { domainError } from "@utils/helpers/domainError";
import { DomainErrorCode } from "@enums/DomainErrorCode";
import { ALLOCATION_WEIGHT_TOTAL } from "@utils/helpers/allocationWeight";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { EventRepository } from "@repositories/EventRepository";
import { EventTypeRepository } from "@repositories/EventTypeRepository";
import { OrganizationRepository } from "@repositories/OrganizationRepository";
import { SessionRepository } from "@repositories/SessionRepository";
import { EventCastRepository } from "@repositories/EventCastRepository";
import { EventRequirementRepository } from "@repositories/EventRequirementRepository";
import { EventServiceRepository } from "@repositories/EventServiceRepository";
import { TicketTypeRepository } from "@repositories/TicketTypeRepository";
import { TicketTypeSessionRepository } from "@repositories/TicketTypeSessionRepository";
import { PriceTierRepository } from "@repositories/PriceTierRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { CapacityEngineService } from "@services/CapacityEngineService";
import { CapacityQuotaService } from "@services/CapacityQuotaService";
import { TicketIssuanceGuardService } from "@services/TicketIssuanceGuardService";
import {
    EVENT_ATTESTATION_STATEMENT,
    FiscalDeclarationService,
    FiscalDeclarationServerContext,
} from "@services/FiscalDeclarationService";
import { EventCreateDTO } from "@DTOs/event/EventCreateDTO";
import { EventUpdateDTO } from "@DTOs/event/EventUpdateDTO";
import { EventQueryDTO } from "@DTOs/event/EventQueryDTO";
import { EventCancelDTO, OrphanSessionsResolutionDTO, OrphanSessionsResolveDTO } from "@DTOs/event/EventLifecycleDTO";
import { I18nText } from "@utils/helpers/i18nText";

/** Nome della sessione implicita creata su un evento non multi-sessione (§4.6). */
const IMPLICIT_SESSION_NAME: I18nText = { it: "Evento", en: "Event" };

@Service()
export class EventService {
    constructor(
        private readonly eventRepository: EventRepository,
        private readonly eventTypeRepository: EventTypeRepository,
        private readonly organizationRepository: OrganizationRepository,
        private readonly sessionRepository: SessionRepository,
        private readonly eventCastRepository: EventCastRepository,
        private readonly eventRequirementRepository: EventRequirementRepository,
        private readonly eventServiceRepository: EventServiceRepository,
        private readonly ticketTypeRepository: TicketTypeRepository,
        private readonly ticketTypeSessionRepository: TicketTypeSessionRepository,
        private readonly priceTierRepository: PriceTierRepository,
        private readonly organizationScopeService: OrganizationScopeService,
        private readonly fiscalDeclarationService: FiscalDeclarationService,
        private readonly ticketIssuanceGuardService: TicketIssuanceGuardService,
        private readonly capacityEngineService: CapacityEngineService,
        private readonly capacityQuotaService: CapacityQuotaService,
    ) {}

    // ─────────────────────────────────────────────────────────────────────────
    // CRUD del dialetto (§3.2)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Creazione dell'evento. Quando l'`EventType` non ha `capMultiSession` il
     * servizio crea **una sessione implicita reale** (§4.6): il check-in di una
     * milonga singola gira sullo stesso codice di quello di un festival. Sono due
     * scritture, quindi una `$transaction` (regola 1 di transactions.md).
     */
    public async save(principalId: number, dto: EventCreateDTO): Promise<Event> {
        const scope = await this.organizationScopeService.resolve(principalId);
        this.organizationScopeService.assertWritable(scope, dto.organizationId);

        await this.assertSlugIsFree(dto.slug);
        this.assertDatesAreCoherent(dto.startAt, dto.endAt);

        const eventType = await this.eventTypeRepository.findOne({ id: dto.eventTypeId, deleted: false });
        if (!eventType) {
            Log.warn(`[Event Service]: event type (id ${dto.eventTypeId}) not found`);
            throw new httpErrors.BadRequest("Tipo di evento non trovato.");
        }

        Log.info(`[Event Service]: creating event '${dto.slug}' for organization (id ${dto.organizationId})`);

        return getPrismaClient().$transaction(async prisma => {
            const event = await this.eventRepository.save(dto as any, prisma);

            if (!eventType.capMultiSession) {
                const session = await this.sessionRepository.save(
                    {
                        eventId: event.id,
                        name: IMPLICIT_SESSION_NAME,
                        startAt: event.startAt,
                        endAt: event.endAt,
                        allocationWeight: ALLOCATION_WEIGHT_TOTAL,
                        isImplicit: true,
                        sortOrder: 0,
                    },
                    prisma,
                );
                Log.info(
                    `[Event Service]: implicit session created (id ${session.id}) for event (id ${event.id}) — `
                    + `event type '${eventType.slug}' has capMultiSession = false`,
                );
            }

            Log.info(`[Event Service]: event created '${event.slug}' (id ${event.id})`);
            return event;
        });
    }

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<Event | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.eventRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async paginate(principalId: number, query: EventQueryDTO, options: PaginateOptions): Promise<PaginateDatasourceDTO<Event>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.eventRepository.paginateInScope(scope, this.createQueryFromPayload(query), options);
    }

    public async updateById(principalId: number, id: number, dto: EventUpdateDTO): Promise<Event> {
        const event = await this.findByIdOrThrow(principalId, id);
        const scope = await this.organizationScopeService.resolve(principalId);
        this.organizationScopeService.assertWritable(scope, dto.organizationId ?? event.organizationId);

        if (dto.slug && dto.slug !== event.slug) {
            await this.assertSlugIsFree(dto.slug);
        }
        this.assertDatesAreCoherent(dto.startAt ?? event.startAt, dto.endAt ?? event.endAt);

        Log.info(`[Event Service]: updating event (id ${id})`);
        return this.eventRepository.update({ id }, dto as any);
    }

    public async safeDeleteById(principalId: number, id: number): Promise<Event> {
        const event = await this.findByIdOrThrow(principalId, id);
        const scope = await this.organizationScopeService.resolve(principalId);
        this.organizationScopeService.assertWritable(scope, event.organizationId);

        Log.info(`[Event Service]: soft deleting event (id ${id})`);
        return this.eventRepository.safeDeleteById(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Lettura pubblica (§3.7) — senza autenticazione, senza scope di tenancy
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * `GET /api/public/events/:slug` — restituisce **solo** eventi `PUBLISHED` o
     * `SALES_CLOSED` (§4.5). Nessun principale, nessuno scope: la restrizione è
     * nello stato, e i titoli `CODE_RESTRICTED` restano fuori dalla scheda.
     */
    public async findPublicBySlug(slug: string) {
        const event = await this.eventRepository.findPublicCardBySlug(slug);
        if (!event) {
            Log.warn(`[Event Service]: public event card requested for unknown or unpublished slug '${slug}'`);
            throw new httpErrors.NotFound("Evento non trovato.");
        }
        Log.info(`[Event Service]: public event card served for '${slug}' (id ${event.id})`);
        return event;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Ciclo di vita (§3.7 · §4.5)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * `RB13` — si pubblica solo se l'organizzazione è **approvata** *e* **abilitata
     * all'incasso**. I due casi hanno messaggi distinti perché all'organizzatore
     * servono due azioni diverse; il codice è `PAYOUT_NOT_ENABLED` in entrambi,
     * come prescrive il §4.5.
     *
     * La pubblicazione crea **contestualmente** la `FiscalDeclaration` di tipo
     * `EVENT_ATTESTATION` a nome di chi compie l'atto (`RF-ORG-8`): stessa
     * transazione, o valgono entrambe o nessuna delle due.
     */
    public async publish(principalId: number, id: number, context: FiscalDeclarationServerContext): Promise<Event> {
        const event = await this.findByIdOrThrow(principalId, id);
        const scope = await this.organizationScopeService.resolve(principalId);
        this.organizationScopeService.assertWritable(scope, event.organizationId);

        if (event.status !== EventStatus.DRAFT) {
            Log.warn(`[Event Service]: publish refused for event (id ${id}) — current status is ${event.status}`);
            throw new httpErrors.BadRequest("Solo un evento in bozza può essere pubblicato.");
        }

        const organization = await this.organizationRepository.findOne({ id: event.organizationId, deleted: false });
        if (!organization) {
            Log.error(`[Event Service]: publish failed for event (id ${id}) — organization (id ${event.organizationId}) not found`);
            throw new httpErrors.NotFound("Organizzazione non trovata.");
        }

        // ── I dati fiscali, rimandati fin qui ────────────────────────────
        //
        // Ragione sociale e forma giuridica sono facoltative all'apertura, da
        // quando un organizzatore può aprirsi l'organizzazione da solo: chi
        // prova la piattaforma la sera non ha sottomano la visura, e un modulo
        // che la pretende al primo passo è un modulo che nessuno finisce.
        //
        // Il conto però si paga qui, ed è il posto giusto: pubblicare significa
        // cominciare a vendere, e da una vendita nasce un documento fiscale
        // intestato a qualcuno. Senza questi campi quel qualcuno non esiste.
        const mancanti: string[] = [];
        if (!organization.legalName?.trim()) mancanti.push("la ragione sociale");
        if (!organization.legalForm?.trim()) mancanti.push("la forma giuridica");
        if (!organization.vatNumber?.trim() && !organization.taxCode?.trim()) {
            // O l'una o l'altro: un'associazione senza partita IVA ha comunque
            // un codice fiscale, e pretenderle entrambe escluderebbe metà degli
            // organizzatori di tango che esistono.
            mancanti.push("la partita IVA o il codice fiscale");
        }
        if (mancanti.length) {
            Log.warn(
                `[Event Service]: publish refused for event (id ${id}) — organization (id ${organization.id}) `
                + `is missing ${mancanti.join(", ")}`,
            );
            throw new httpErrors.BadRequest(
                `Prima di pubblicare completa i dati dell'organizzazione: manca ${mancanti.join(", ")}.`,
            );
        }

        if (organization.status !== OrganizationStatus.APPROVED) {
            Log.warn(
                `[Event Service]: publish refused for event (id ${id}) — organization (id ${organization.id}) `
                + `status is ${organization.status}, not APPROVED`,
            );
            throw domainError(
                DomainErrorCode.PAYOUT_NOT_ENABLED,
                "L'organizzazione non è ancora approvata dalla piattaforma: non è possibile pubblicare l'evento.",
            );
        }

        if (organization.payoutStatus !== PayoutStatus.ENABLED) {
            Log.warn(
                `[Event Service]: publish refused for event (id ${id}) — organization (id ${organization.id}) `
                + `payoutStatus is ${organization.payoutStatus}, not ENABLED`,
            );
            throw domainError(
                DomainErrorCode.PAYOUT_NOT_ENABLED,
                "L'organizzazione non è abilitata all'incasso: completa la configurazione dell'account di pagamento prima di pubblicare.",
            );
        }

        const framework = await this.fiscalDeclarationService.findLatestFramework(organization.id);
        if (!framework) {
            Log.warn(
                `[Event Service]: publish refused for event (id ${id}) — organization (id ${organization.id}) `
                + `has no ORGANIZATION_FRAMEWORK declaration to attest against`,
            );
            throw new httpErrors.BadRequest(
                "L'organizzazione non ha ancora dichiarato il proprio inquadramento fiscale: "
                + "l'attestazione richiesta dalla pubblicazione non può essere registrata.",
            );
        }

        Log.info(`[Event Service]: publishing event (id ${id}) by user (id ${context.declaredByUserId})`);

        return getPrismaClient().$transaction(async prisma => {
            const published = await this.eventRepository.update(
                { id },
                { status: EventStatus.PUBLISHED, publishedAt: new Date() },
                undefined,
                undefined,
                prisma,
            );

            const declaration = await this.fiscalDeclarationService.create(
                {
                    organizationId: organization.id,
                    eventId: id,
                    kind: FiscalDeclarationKind.EVENT_ATTESTATION,
                    frameworkLabel: framework.frameworkLabel,
                    statementText: EVENT_ATTESTATION_STATEMENT,
                },
                context,
                prisma,
            );

            Log.info(
                `[Event Service]: event published (id ${id}) with fiscal declaration (id ${declaration.id}) `
                + `version ${declaration.version}`,
            );
            return published;
        });
    }

    /**
     * `RF-EVT-40` — chiude la **sola vendita online**: l'emissione manuale di pass
     * e le vendite esterne restano possibili (`RB20`). `salesCloseAt` non viene
     * toccato: è la data *configurata* di chiusura, non il momento in cui è
     * avvenuta, che resta nel `Log`.
     */
    public async closeSales(principalId: number, id: number): Promise<Event> {
        const event = await this.assertWritableEvent(principalId, id);

        if (event.status !== EventStatus.PUBLISHED) {
            Log.warn(`[Event Service]: close-sales refused for event (id ${id}) — current status is ${event.status}`);
            throw new httpErrors.BadRequest("Solo un evento pubblicato può chiudere le vendite.");
        }

        Log.info(`[Event Service]: closing online sales for event (id ${id})`);
        return this.eventRepository.update({ id }, { status: EventStatus.SALES_CLOSED });
    }

    /**
     * `RF-EVT-40` — la riapertura è possibile finché l'evento non è iniziato.
     *
     * NOTA DI FASE — «e la capienza lo consente» richiede il motore di capienza
     * (§4.8, passo 13 del §2), che non esiste ancora: qui è verificata la sola
     * condizione temporale. Il controllo di capienza si aggiunge in fase C.
     */
    public async reopenSales(principalId: number, id: number): Promise<Event> {
        const event = await this.assertWritableEvent(principalId, id);

        if (event.status !== EventStatus.SALES_CLOSED) {
            Log.warn(`[Event Service]: reopen-sales refused for event (id ${id}) — current status is ${event.status}`);
            throw domainError(
                DomainErrorCode.SALES_CLOSED,
                "Solo un evento con le vendite chiuse può riaprirle.",
            );
        }

        if (event.startAt.getTime() <= Date.now()) {
            Log.warn(`[Event Service]: reopen-sales refused for event (id ${id}) — the event has already started`);
            throw new httpErrors.BadRequest("L'evento è già iniziato: le vendite online non possono essere riaperte.");
        }

        Log.info(`[Event Service]: reopening online sales for event (id ${id})`);
        return this.eventRepository.update({ id }, { status: EventStatus.PUBLISHED });
    }

    /**
     * `RF-EVT-41` — annullamento dell'evento.
     *
     * NOTA DI FASE — il §4.5 prescrive il rilascio di **tutti** i
     * `QuotaConsumption` dell'evento. `CapacityQuota`/`QuotaConsumption` sono i
     * passi 13 e 16 del §2 e non esistono ancora: il rilascio si innesta qui in
     * fase C, dentro questa stessa transazione.
     */
    public async cancel(principalId: number, id: number, dto: EventCancelDTO): Promise<Event> {
        const event = await this.assertWritableEvent(principalId, id);

        if (event.status === EventStatus.CANCELLED) {
            Log.warn(`[Event Service]: cancel refused for event (id ${id}) — already cancelled`);
            throw new httpErrors.BadRequest("L'evento è già annullato.");
        }

        Log.info(`[Event Service]: cancelling event (id ${id}) — reason: ${dto.reason}`);

        // §4.5 — l'annullamento rilascia TUTTI i `QuotaConsumption` dell'evento, e
        // lo fa nella stessa transazione dello stato: un evento annullato che
        // continuasse a tenere impegnati i posti bloccherebbe una sala che non
        // ospita più nulla.
        return getPrismaClient().$transaction(async prisma => {
            const released = await this.capacityEngineService.releaseEvent(id, prisma);

            const cancelled = await this.eventRepository.update(
                { id },
                {
                    status: EventStatus.CANCELLED,
                    cancelledAt: new Date(),
                    cancellationReason: dto.reason,
                },
                undefined,
                undefined,
                prisma,
            );

            Log.info(
                `[Event Service]: event (id ${id}) cancelled — released ${released.releasedQuantity} unit(s) `
                + `across ${released.releasedQuotaIds.length} quota(s)`,
            );
            return cancelled;
        });
    }

    /**
     * `RF-EVT-16` — nuova edizione con **vendite e iscrizioni azzerate**. Clona
     * evento, sessioni, cast, requisiti, servizi, titoli con il loro elenco
     * esplicito di sessioni (rimappato sulle nuove) e gli scaglioni con
     * `soldQuantity = 0`. Il nuovo evento nasce in `DRAFT`.
     *
     * NOTA DI FASE — le quote di capienza (con `consumed = 0`) fanno parte della
     * clonazione prescritta dal §4.5 ma appartengono al passo 13: si aggiungono
     * in fase C dentro questa stessa transazione.
     */
    public async duplicate(principalId: number, id: number): Promise<Event> {
        const source = await this.assertWritableEvent(principalId, id);
        const slug = await this.buildDuplicateSlug(source.slug);

        Log.info(`[Event Service]: duplicating event (id ${id}) into slug '${slug}'`);

        return getPrismaClient().$transaction(async prisma => {
            const {
                id: _id,
                createdAt: _createdAt,
                updatedAt: _updatedAt,
                slug: _slug,
                status: _status,
                publishedAt: _publishedAt,
                cancelledAt: _cancelledAt,
                cancellationReason: _cancellationReason,
                ...scalars
            } = source;

            const clone = await this.eventRepository.save(
                {
                    ...(scalars as any),
                    slug,
                    status: EventStatus.DRAFT,
                    publishedAt: null,
                    cancelledAt: null,
                    cancellationReason: null,
                },
                prisma,
            );

            // Sessioni: la mappa vecchio → nuovo id regge il rimappaggio dei titoli.
            const sessionIdMap = new Map<number, number>();
            const sessions = await this.sessionRepository.findByEvent(id, undefined, prisma);
            for (const session of sessions) {
                const created = await this.sessionRepository.save(
                    {
                        eventId: clone.id,
                        name: session.name as Prisma.InputJsonValue,
                        startAt: session.startAt,
                        endAt: session.endAt,
                        room: session.room,
                        level: session.level,
                        allocationWeight: session.allocationWeight,
                        isImplicit: session.isImplicit,
                        sortOrder: session.sortOrder,
                    },
                    prisma,
                );
                sessionIdMap.set(session.id, created.id);
            }

            const casts = await this.eventCastRepository.findByEvent(id, undefined, prisma);
            for (const cast of casts) {
                await this.eventCastRepository.save(
                    { eventId: clone.id, artistId: cast.artistId, kind: cast.kind, sortOrder: cast.sortOrder },
                    prisma,
                );
            }

            const requirements = await this.eventRequirementRepository.findByEvent(id, undefined, prisma);
            for (const requirement of requirements) {
                await this.eventRequirementRepository.save(
                    {
                        eventId: clone.id,
                        requirementTypeId: requirement.requirementTypeId,
                        label: requirement.label as Prisma.InputJsonValue,
                        text: requirement.text as Prisma.InputJsonValue,
                        mandatory: requirement.mandatory,
                        blocking: requirement.blocking,
                        verification: requirement.verification,
                        dueAt: requirement.dueAt,
                        config: requirement.config as Prisma.InputJsonValue,
                        sortOrder: requirement.sortOrder,
                    },
                    prisma,
                );
            }

            const serviceIdMap = new Map<number, number>();
            const services = await this.eventServiceRepository.findByEvent(id, undefined, prisma);
            for (const service of services) {
                const clonedService = await this.eventServiceRepository.save(
                    {
                        eventId: clone.id,
                        serviceTypeId: service.serviceTypeId,
                        name: service.name as Prisma.InputJsonValue,
                        description: service.description as Prisma.InputJsonValue,
                        price: service.price,
                        refundCutoffAt: service.refundCutoffAt,
                        attributesConfig: service.attributesConfig as Prisma.InputJsonValue,
                        sortOrder: service.sortOrder,
                    },
                    prisma,
                );
                serviceIdMap.set(service.id, clonedService.id);
            }

            const ticketTypeIdMap = new Map<number, number>();
            const ticketTypes = await this.ticketTypeRepository.findByEvent(id, undefined, prisma);
            for (const ticketType of ticketTypes) {
                const clonedTicketType = await this.ticketTypeRepository.save(
                    {
                        eventId: clone.id,
                        name: ticketType.name as Prisma.InputJsonValue,
                        description: ticketType.description as Prisma.InputJsonValue,
                        basePrice: ticketType.basePrice,
                        saleUnit: ticketType.saleUnit,
                        roleConstraint: ticketType.roleConstraint,
                        consumesRoleQuota: ticketType.consumesRoleQuota,
                        saleOpensAt: ticketType.saleOpensAt,
                        saleClosesAt: ticketType.saleClosesAt,
                        visibility: ticketType.visibility,
                        accessCode: ticketType.accessCode,
                        minPerOrder: ticketType.minPerOrder,
                        maxPerOrder: ticketType.maxPerOrder,
                        indicatedLevel: ticketType.indicatedLevel,
                        highlighted: ticketType.highlighted,
                        sortOrder: ticketType.sortOrder,
                    },
                    prisma,
                );
                ticketTypeIdMap.set(ticketType.id, clonedTicketType.id);

                const links = await this.ticketTypeSessionRepository.findByTicketType(ticketType.id, prisma);
                for (const link of links) {
                    const clonedSessionId = sessionIdMap.get(link.sessionId);
                    if (!clonedSessionId) {
                        continue;
                    }
                    await this.ticketTypeSessionRepository.save(
                        { ticketTypeId: clonedTicketType.id, sessionId: clonedSessionId },
                        prisma,
                    );
                }

                const tiers = await this.priceTierRepository.findByTicketType(ticketType.id, prisma);
                for (const tier of tiers) {
                    await this.priceTierRepository.save(
                        {
                            ticketTypeId: clonedTicketType.id,
                            kind: tier.kind,
                            price: tier.price,
                            validUntil: tier.validUntil,
                            maxQuantity: tier.maxQuantity,
                            soldQuantity: 0,
                            sortOrder: tier.sortOrder,
                        },
                        prisma,
                    );
                }
            }

            // §4.5 — le quote si clonano CON `consumed = 0`: la nuova edizione
            // nasce con la stessa configurazione di capienza e nessuna vendita.
            const clonedQuotas = await this.capacityQuotaService.cloneForEvent(id, clone.id, {
                sessions: sessionIdMap,
                ticketTypes: ticketTypeIdMap,
                services: serviceIdMap,
            }, prisma);

            Log.info(
                `[Event Service]: event (id ${id}) duplicated into event (id ${clone.id}) slug '${clone.slug}' `
                + `— ${clonedQuotas} capacity quota(s) cloned with consumed = 0`,
            );
            return clone;
        });
    }

    /**
     * `RF-EVT-24` — sessione aggiunta a un evento pubblicato: restituisce i titoli
     * che **non** la includono, distinguendo i venduti dagli invenduti. Sui
     * venduti l'aggiunta è ammessa **solo come miglioria**; la rimozione di una
     * sessione da un titolo con biglietti emessi è sempre rifiutata da
     * `TicketTypeService.setSessions`.
     */
    public async resolveOrphanSessions(
        principalId: number,
        id: number,
        dto: OrphanSessionsResolveDTO,
    ): Promise<OrphanSessionsResolutionDTO> {
        await this.assertWritableEvent(principalId, id);

        const session = await this.sessionRepository.findOne({ id: dto.sessionId, eventId: id, deleted: false });
        if (!session) {
            Log.warn(`[Event Service]: orphan-sessions resolve refused — session (id ${dto.sessionId}) does not belong to event (id ${id})`);
            throw new httpErrors.BadRequest("La sessione indicata non appartiene a questo evento.");
        }

        const ticketTypes = await this.ticketTypeRepository.findNotIncludingSession(id, dto.sessionId);
        const resolution: OrphanSessionsResolutionDTO = {
            sessionId: dto.sessionId,
            ticketTypesWithoutSession: [],
        };

        for (const ticketType of ticketTypes) {
            const issuedTicketCount = await this.ticketIssuanceGuardService.countIssuedTickets(ticketType.id);
            resolution.ticketTypesWithoutSession.push({
                id: ticketType.id,
                name: ticketType.name,
                issuedTicketCount,
                sold: issuedTicketCount > 0,
                // L'aggiunta è sempre una miglioria: aumenta ciò che il titolo include.
                canAddSession: true,
            });
        }

        Log.info(
            `[Event Service]: orphan-sessions resolved for event (id ${id}) session (id ${dto.sessionId}) — `
            + `${resolution.ticketTypesWithoutSession.length} ticket type(s) do not include it`,
        );
        return resolution;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Interni
    // ─────────────────────────────────────────────────────────────────────────

    /** Carica l'evento nello scope del chiamante e verifica che possa scriverlo. */
    private async assertWritableEvent(principalId: number, id: number): Promise<Event> {
        const event = await this.findByIdOrThrow(principalId, id);
        const scope = await this.organizationScopeService.resolve(principalId);
        this.organizationScopeService.assertWritable(scope, event.organizationId);
        return event;
    }

    private async findByIdOrThrow(principalId: number, id: number): Promise<Event> {
        const event = await this.findById(principalId, id);
        if (!event) {
            Log.warn(`[Event Service]: event (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Evento non trovato.");
        }
        return event;
    }

    /** Lo slug è unico globale: è la chiave dell'endpoint pubblico (§4.5). */
    private async assertSlugIsFree(slug: string): Promise<void> {
        const existing = await this.eventRepository.findOne({ slug });
        if (existing) {
            Log.warn(`[Event Service]: slug '${slug}' already in use (id ${existing.id})`);
            throw new httpErrors.BadRequest("Esiste già un evento con questo slug.");
        }
    }

    private assertDatesAreCoherent(startAt: Date, endAt: Date): void {
        if (endAt.getTime() < startAt.getTime()) {
            Log.warn(`[Event Service]: incoherent event dates — endAt ${endAt.toISOString()} precedes startAt ${startAt.toISOString()}`);
            throw new httpErrors.BadRequest("La data di fine non può precedere la data di inizio.");
        }
    }

    private async buildDuplicateSlug(slug: string): Promise<string> {
        const base = `${slug}-copia`;
        let candidate = base;
        let attempt = 1;

        while (await this.eventRepository.findOne({ slug: candidate })) {
            attempt += 1;
            candidate = `${base}-${attempt}`;
        }

        return candidate;
    }

    private createQueryFromPayload(payload: EventQueryDTO): Prisma.EventWhereInput {
        const valueQuery: Prisma.EventWhereInput[] = [
            createObjectWithoutThrow(payload.value, { slug: { contains: payload.value, mode: "insensitive" } }),
        ].filter(o => Object.values(o).length > 0);

        const query: Prisma.EventWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(valueQuery.length, { OR: valueQuery }),
            createObjectWithoutThrow(payload.status?.length, { status: { in: payload.status } }),
            createObjectWithoutThrow(payload.organizationId, { organizationId: payload.organizationId }),
            createObjectWithoutThrow(payload.eventTypeId, { eventTypeId: payload.eventTypeId }),
            createObjectWithoutThrow(payload.eventTypeFamily, { eventType: { family: payload.eventTypeFamily } }),
            createObjectWithoutThrow(payload.venueId, { venueId: payload.venueId }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
