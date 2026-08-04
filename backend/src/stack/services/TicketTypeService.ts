import { Service } from "fastify-decorators";
import { Event, PriceTier, PriceTierKind, Prisma, SaleUnit, TicketType, TicketTypeVisibility } from "@prisma/client";
import httpErrors from "http-errors";
import { isBoolean } from "lodash";
import { Log } from "@utils/adapters/log";
import { getPrismaClient } from "@utils/adapters/prisma";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { splitLinkableEntities } from "@utils/helpers/mergeEntities";
import { selectActiveTier } from "@utils/helpers/priceTier";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { TicketTypeRepository, TicketTypeWithSessions } from "@repositories/TicketTypeRepository";
import { TicketTypeSessionRepository } from "@repositories/TicketTypeSessionRepository";
import { PriceTierRepository } from "@repositories/PriceTierRepository";
import { SessionRepository } from "@repositories/SessionRepository";
import { EventRepository } from "@repositories/EventRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { TicketIssuanceGuardService } from "@services/TicketIssuanceGuardService";
import { TicketTypeCreateDTO } from "@DTOs/ticket_type/TicketTypeCreateDTO";
import { TicketTypeUpdateDTO } from "@DTOs/ticket_type/TicketTypeUpdateDTO";
import { TicketTypeQueryDTO } from "@DTOs/ticket_type/TicketTypeQueryDTO";
import { TicketTypeSessionUpdateDTO } from "@DTOs/ticket_type/TicketTypeSessionUpdateDTO";
import { PriceTierUpdateDTO } from "@DTOs/ticket_type/PriceTierUpdateDTO";
import { PricePreviewRequestDTO, PricePreviewResponseDTO } from "@DTOs/ticket_type/PricePreviewDTO";

@Service()
export class TicketTypeService {
    constructor(
        private readonly ticketTypeRepository: TicketTypeRepository,
        private readonly ticketTypeSessionRepository: TicketTypeSessionRepository,
        private readonly priceTierRepository: PriceTierRepository,
        private readonly sessionRepository: SessionRepository,
        private readonly eventRepository: EventRepository,
        private readonly organizationScopeService: OrganizationScopeService,
        private readonly ticketIssuanceGuardService: TicketIssuanceGuardService,
    ) {}

    // ─────────────────────────────────────────────────────────────────────────
    // CRUD del dialetto (§3.2)
    // ─────────────────────────────────────────────────────────────────────────

    public async save(principalId: number, dto: TicketTypeCreateDTO): Promise<TicketType> {
        await this.assertWritableEvent(principalId, dto.eventId);
        this.assertConstraintsAreCoherent(dto.saleUnit, dto.roleConstraint, dto.consumesRoleQuota);
        this.assertVisibilityIsCoherent(dto.visibility, dto.accessCode);
        this.assertOrderBoundsAreCoherent(dto.minPerOrder, dto.maxPerOrder);

        Log.info(`[TicketType Service]: creating ticket type on event (id ${dto.eventId})`);
        const ticketType = await this.ticketTypeRepository.save(dto as any);
        Log.info(`[TicketType Service]: ticket type created (id ${ticketType.id})`);
        return ticketType;
    }

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<TicketType | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.ticketTypeRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async paginate(
        principalId: number,
        query: TicketTypeQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<TicketType>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.ticketTypeRepository.paginateInScope(scope, this.createQueryFromPayload(query), options);
    }

    public async updateById(principalId: number, id: number, dto: TicketTypeUpdateDTO): Promise<TicketType> {
        const ticketType = await this.findByIdOrThrow(principalId, id);
        await this.assertWritableEvent(principalId, ticketType.eventId);

        this.assertConstraintsAreCoherent(
            dto.saleUnit ?? ticketType.saleUnit,
            dto.roleConstraint === undefined ? ticketType.roleConstraint : dto.roleConstraint,
            dto.consumesRoleQuota ?? ticketType.consumesRoleQuota,
        );
        this.assertVisibilityIsCoherent(
            dto.visibility ?? ticketType.visibility,
            dto.accessCode === undefined ? ticketType.accessCode : dto.accessCode,
        );
        this.assertOrderBoundsAreCoherent(
            dto.minPerOrder ?? ticketType.minPerOrder,
            dto.maxPerOrder ?? ticketType.maxPerOrder,
        );

        Log.info(`[TicketType Service]: updating ticket type (id ${id})`);
        return this.ticketTypeRepository.update({ id }, dto as any);
    }

    public async safeDeleteById(principalId: number, id: number): Promise<TicketType> {
        const ticketType = await this.findByIdOrThrow(principalId, id);
        await this.assertWritableEvent(principalId, ticketType.eventId);

        if (await this.ticketIssuanceGuardService.hasIssuedTickets(id)) {
            Log.warn(`[TicketType Service]: delete refused for ticket type (id ${id}) — issued tickets exist`);
            throw new httpErrors.BadRequest("Il titolo ha biglietti emessi e non può essere eliminato.");
        }

        Log.info(`[TicketType Service]: soft deleting ticket type (id ${id})`);
        return this.ticketTypeRepository.safeDeleteById(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Sub-risorse — un solo PATCH per collezione, con l'array intero (§3.2, §3.10.1)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * `PATCH /ticket-types/:id/sessions` — sostituisce **l'elenco esplicito** delle
     * sessioni incluse (§4.7).
     *
     * **Rifiuta la rimozione** di una sessione quando esistono biglietti emessi per
     * il titolo: sui titoli venduti l'aggiunta è ammessa come miglioria, la
     * sottrazione mai (`RF-EVT-24`). Il conteggio dei biglietti emessi passa da
     * `TicketIssuanceGuardService`, che è l'unico punto da cambiare quando il
     * modello `Ticket` arriverà: finché non esiste, il servizio **non finge** di
     * aver verificato e lo dichiara nel log.
     */
    public async setSessions(
        principalId: number,
        ticketTypeId: number,
        items: TicketTypeSessionUpdateDTO,
    ): Promise<TicketTypeWithSessions | null> {
        const ticketType = await this.findByIdOrThrow(principalId, ticketTypeId);
        await this.assertWritableEvent(principalId, ticketType.eventId);

        const { toCreate, toUpdate, toDisconnect } = splitLinkableEntities(items);

        // Ogni sessione deve appartenere allo stesso evento del titolo.
        const referencedSessionIds = [...toCreate, ...toUpdate].map(item => item.sessionId);
        if (referencedSessionIds.length) {
            const sessions = await this.sessionRepository.findMany({
                id: { in: referencedSessionIds },
                eventId: ticketType.eventId,
                deleted: false,
            });
            if (sessions.length !== new Set(referencedSessionIds).size) {
                Log.warn(`[TicketType Service]: setSessions refused for ticket type (id ${ticketTypeId}) — one or more sessions do not belong to event (id ${ticketType.eventId})`);
                throw new httpErrors.BadRequest("Una o più sessioni non appartengono all'evento di questo titolo.");
            }
        }

        if (toDisconnect.length) {
            const issued = await this.ticketIssuanceGuardService.countIssuedTickets(ticketTypeId);
            if (issued > 0) {
                Log.warn(
                    `[TicketType Service]: setSessions refused for ticket type (id ${ticketTypeId}) — `
                    + `${issued} issued ticket(s) forbid removing ${toDisconnect.length} session(s)`,
                );
                throw new httpErrors.BadRequest(
                    "Il titolo ha biglietti emessi: una sessione già inclusa non può essere rimossa.",
                );
            }

            const owned = await this.ticketTypeSessionRepository.findMany({
                id: { in: toDisconnect.map(item => item.id) },
            });
            if (owned.some(link => link.ticketTypeId !== ticketTypeId)) {
                Log.warn(`[TicketType Service]: setSessions refused — one or more rows belong to another ticket type`);
                throw new httpErrors.BadRequest("Una o più righe appartengono a un altro titolo.");
            }
        }

        Log.info(
            `[TicketType Service]: replacing the explicit session list of ticket type (id ${ticketTypeId}) — `
            + `${toCreate.length} added, ${toUpdate.length} kept, ${toDisconnect.length} removed`,
        );

        return getPrismaClient().$transaction(async prisma => {
            for (const item of toCreate) {
                await this.ticketTypeSessionRepository.save({ ticketTypeId, sessionId: item.sessionId }, prisma);
            }

            for (const item of toDisconnect) {
                await this.ticketTypeSessionRepository.deleteById(item.id, prisma);
            }

            for (const item of toUpdate) {
                await this.ticketTypeSessionRepository.update(
                    { id: item.id },
                    { sessionId: item.sessionId },
                    undefined,
                    undefined,
                    prisma,
                );
            }

            const result = await this.ticketTypeRepository.findWithSessions(ticketTypeId, prisma);
            Log.info(`[TicketType Service]: session list of ticket type (id ${ticketTypeId}) replaced`);
            return result;
        });
    }

    /**
     * `PATCH /ticket-types/:id/price-tiers` — sostituisce gli scaglioni di prezzo.
     * `soldQuantity` è del server e non viene mai riscritto dal client; uno
     * scaglione con venduto non può essere rimosso, altrimenti il prezzo bloccato
     * degli ordini già emessi resterebbe senza riferimento.
     */
    public async setPriceTiers(
        principalId: number,
        ticketTypeId: number,
        items: PriceTierUpdateDTO,
    ): Promise<PriceTier[]> {
        const ticketType = await this.findByIdOrThrow(principalId, ticketTypeId);
        await this.assertWritableEvent(principalId, ticketType.eventId);

        const { toCreate, toUpdate, toDisconnect } = splitLinkableEntities(items);

        for (const item of [...toCreate, ...toUpdate]) {
            this.assertTierIsCoherent(item.kind, item.validUntil ?? null, item.maxQuantity ?? null, item.price);
        }

        const existingIds = [...toUpdate, ...toDisconnect].map(item => item.id);
        const existing = existingIds.length
            ? await this.priceTierRepository.findMany({ id: { in: existingIds } })
            : [];

        if (existing.some(tier => tier.ticketTypeId !== ticketTypeId)) {
            Log.warn(`[TicketType Service]: setPriceTiers refused — one or more tiers belong to another ticket type`);
            throw new httpErrors.BadRequest("Uno o più scaglioni appartengono a un altro titolo.");
        }

        for (const item of toDisconnect) {
            const tier = existing.find(t => t.id === item.id);
            if (tier && tier.soldQuantity > 0) {
                Log.warn(`[TicketType Service]: setPriceTiers refused — tier (id ${tier.id}) already sold ${tier.soldQuantity} unit(s)`);
                throw new httpErrors.BadRequest("Uno scaglione con biglietti già venduti non può essere rimosso.");
            }
        }

        Log.info(
            `[TicketType Service]: replacing the price tiers of ticket type (id ${ticketTypeId}) — `
            + `${toCreate.length} added, ${toUpdate.length} updated, ${toDisconnect.length} removed`,
        );

        return getPrismaClient().$transaction(async prisma => {
            for (const item of toCreate) {
                await this.priceTierRepository.save(
                    {
                        ticketTypeId,
                        kind: item.kind,
                        price: item.price,
                        validUntil: item.validUntil ?? null,
                        maxQuantity: item.maxQuantity ?? null,
                        sortOrder: item.sortOrder ?? 0,
                    },
                    prisma,
                );
            }

            for (const item of toDisconnect) {
                await this.priceTierRepository.deleteById(item.id, prisma);
            }

            for (const item of toUpdate) {
                await this.priceTierRepository.update(
                    { id: item.id },
                    {
                        kind: item.kind,
                        price: item.price,
                        validUntil: item.validUntil ?? null,
                        maxQuantity: item.maxQuantity ?? null,
                        ...(item.sortOrder !== undefined && { sortOrder: item.sortOrder }),
                    },
                    undefined,
                    undefined,
                    prisma,
                );
            }

            const tiers = await this.priceTierRepository.findByTicketType(ticketTypeId, prisma);
            Log.info(`[TicketType Service]: price tiers of ticket type (id ${ticketTypeId}) replaced — ${tiers.length} tier(s)`);
            return tiers;
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Prezzo — SEMPRE calcolato dal server (§4.7)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * `resolvePrice(ticketTypeId, at, soldQuantity)` — **mai fidarsi del client**.
     *
     * Valuta gli scaglioni nell'ordine dichiarato dall'organizzatore (`sortOrder`)
     * e restituisce il primo applicabile:
     *  - `BY_DATE`     → `validUntil` non ancora superato;
     *  - `BY_QUANTITY` → `maxQuantity` non ancora esaurito;
     *  - `COMBINED`    → la congiunzione delle due.
     *
     * Restituisce prezzo, **criterio di scadenza** e **residuo a quel prezzo**,
     * perché `RF-EVT-26` richiede scarsità dichiarata con dati reali. In assenza di
     * scaglioni applicabili vale `basePrice` con criterio `NONE`.
     *
     * `at` e `soldQuantity` sono facoltativi e servono a simulare uno scenario dal
     * back-office: in loro assenza valgono «adesso» e il venduto reale registrato
     * su ciascuno scaglione.
     */
    public async resolvePrice(
        ticketTypeId: number,
        request: PricePreviewRequestDTO = {},
        tx?: Prisma.TransactionClient,
    ): Promise<PricePreviewResponseDTO> {
        const ticketType = await this.ticketTypeRepository.findOne({ id: ticketTypeId, deleted: false }, undefined, tx);
        if (!ticketType) {
            Log.warn(`[TicketType Service]: price resolution requested for unknown ticket type (id ${ticketTypeId})`);
            throw new httpErrors.NotFound("Titolo non trovato.");
        }

        const at = request.at ?? new Date();
        const tiers = await this.priceTierRepository.findByTicketType(ticketTypeId, tx);

        // La selezione vive in `@utils/helpers/priceTier` perché la condivide
        // `POST /api/public/events/:id/availability`: il prezzo mostrato nella
        // disponibilità e quello bloccato in checkout non possono divergere.
        const active = selectActiveTier(tiers, ticketType.basePrice, at, request.soldQuantity);

        if (active.tier) {
            const response: PricePreviewResponseDTO = {
                ticketTypeId,
                price: active.price,
                basePrice: ticketType.basePrice,
                priceTierId: active.tier.id,
                kind: active.tier.kind,
                expiryCriterion: active.tier.kind,
                expiresAt: active.expiresAt,
                remainingAtThisPrice: active.remainingAtThisPrice,
            };

            Log.info(
                `[TicketType Service]: price resolved for ticket type (id ${ticketTypeId}) — `
                + `${response.price} cents from tier (id ${active.tier.id}, ${active.tier.kind}), `
                + `remaining at this price: ${response.remainingAtThisPrice ?? "unbounded"}`,
            );
            return response;
        }

        Log.info(`[TicketType Service]: price resolved for ticket type (id ${ticketTypeId}) — base price ${ticketType.basePrice} cents, no active tier`);
        return {
            ticketTypeId,
            price: ticketType.basePrice,
            basePrice: ticketType.basePrice,
            priceTierId: null,
            kind: null,
            expiryCriterion: "NONE",
            expiresAt: null,
            remainingAtThisPrice: null,
        };
    }

    /** `POST /ticket-types/:id/price-preview` — stessa risoluzione, dentro lo scope. */
    public async previewPrice(
        principalId: number,
        ticketTypeId: number,
        request: PricePreviewRequestDTO,
    ): Promise<PricePreviewResponseDTO> {
        await this.findByIdOrThrow(principalId, ticketTypeId);
        return this.resolvePrice(ticketTypeId, request);
    }

    /**
     * `POST /api/public/ticket-types/:id/unlock` (`RF-EVT-7`) — senza
     * autenticazione: sblocca un titolo `CODE_RESTRICTED` presentando il codice.
     * Il titolo si restituisce **solo** se il codice combacia; il confronto è
     * sull'identità esatta, e un titolo pubblico non ha nulla da sbloccare.
     */
    public async unlockByAccessCode(ticketTypeId: number, accessCode: string): Promise<TicketType> {
        const ticketType = await this.ticketTypeRepository.findOne({ id: ticketTypeId, deleted: false });

        if (!ticketType || ticketType.visibility !== TicketTypeVisibility.CODE_RESTRICTED) {
            Log.warn(`[TicketType Service]: unlock refused for ticket type (id ${ticketTypeId}) — not a code-restricted ticket type`);
            throw new httpErrors.NotFound("Titolo non trovato.");
        }

        if (!ticketType.accessCode || ticketType.accessCode !== accessCode) {
            Log.warn(`[TicketType Service]: unlock refused for ticket type (id ${ticketTypeId}) — wrong access code`);
            throw new httpErrors.Forbidden("Codice di accesso non valido.");
        }

        Log.info(`[TicketType Service]: ticket type (id ${ticketTypeId}) unlocked with a valid access code`);
        return ticketType;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Validazioni (§4.7)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * - `consumesRoleQuota = false` è **incompatibile** con `roleConstraint`
     *   valorizzato: un titolo che dichiara un ruolo e non ne consuma la quota
     *   sfonderebbe in silenzio l'equilibrio dei ruoli.
     * - `saleUnit = PER_COUPLE` non è acquistabile da solo (`T5`): la verifica
     *   sull'ordine appartiene al checkout (§4.11, fase C). Qui si rifiuta la sola
     *   configurazione contraddittoria — una coppia porta ruoli complementari,
     *   quindi non può essere vincolata a un ruolo unico.
     */
    private assertConstraintsAreCoherent(
        saleUnit?: SaleUnit | null,
        roleConstraint?: string | null,
        consumesRoleQuota?: boolean | null,
    ): void {
        if (roleConstraint && consumesRoleQuota === false) {
            Log.warn(`[TicketType Service]: incoherent ticket type — roleConstraint set while consumesRoleQuota is false`);
            throw new httpErrors.BadRequest(
                "Un titolo vincolato a un ruolo deve consumarne la quota: 'consumesRoleQuota' non può essere disattivato.",
            );
        }

        if (saleUnit === SaleUnit.PER_COUPLE && roleConstraint) {
            Log.warn(`[TicketType Service]: incoherent ticket type — PER_COUPLE with a single role constraint`);
            throw new httpErrors.BadRequest(
                "Un titolo a coppia porta ruoli complementari e non può essere vincolato a un solo ruolo.",
            );
        }
    }

    private assertVisibilityIsCoherent(visibility?: TicketTypeVisibility | null, accessCode?: string | null): void {
        if (visibility === TicketTypeVisibility.CODE_RESTRICTED && !accessCode) {
            Log.warn(`[TicketType Service]: incoherent ticket type — CODE_RESTRICTED without an access code`);
            throw new httpErrors.BadRequest("Un titolo a codice richiede un codice di accesso.");
        }
    }

    private assertOrderBoundsAreCoherent(minPerOrder?: number | null, maxPerOrder?: number | null): void {
        if (minPerOrder != null && maxPerOrder != null && maxPerOrder < minPerOrder) {
            Log.warn(`[TicketType Service]: incoherent order bounds — maxPerOrder ${maxPerOrder} below minPerOrder ${minPerOrder}`);
            throw new httpErrors.BadRequest("La quantità massima per ordine non può essere inferiore alla minima.");
        }
    }

    /** Ogni genere di scaglione richiede la propria soglia: senza, non è valutabile. */
    private assertTierIsCoherent(kind: PriceTierKind, validUntil: Date | null, maxQuantity: number | null, price: number): void {
        if (!Number.isInteger(price) || price < 0) {
            throw new httpErrors.BadRequest("Il prezzo di uno scaglione deve essere un importo in centesimi interi non negativo.");
        }

        const needsDate = kind === PriceTierKind.BY_DATE || kind === PriceTierKind.COMBINED;
        const needsQuantity = kind === PriceTierKind.BY_QUANTITY || kind === PriceTierKind.COMBINED;

        if (needsDate && !validUntil) {
            Log.warn(`[TicketType Service]: incoherent price tier — ${kind} without validUntil`);
            throw new httpErrors.BadRequest("Uno scaglione a data richiede la data di validità.");
        }

        if (needsQuantity && (maxQuantity === null || maxQuantity <= 0)) {
            Log.warn(`[TicketType Service]: incoherent price tier — ${kind} without a positive maxQuantity`);
            throw new httpErrors.BadRequest("Uno scaglione a quantità richiede una quantità massima positiva.");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    private async assertWritableEvent(principalId: number, eventId: number): Promise<Event> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const event = await this.eventRepository.findOneInScope(scope, { id: eventId, deleted: false });
        if (!event) {
            Log.warn(`[TicketType Service]: event (id ${eventId}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Evento non trovato.");
        }
        this.organizationScopeService.assertWritable(scope, event.organizationId);
        return event;
    }

    private async findByIdOrThrow(principalId: number, id: number): Promise<TicketType> {
        const ticketType = await this.findById(principalId, id);
        if (!ticketType) {
            Log.warn(`[TicketType Service]: ticket type (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Titolo non trovato.");
        }
        return ticketType;
    }

    private createQueryFromPayload(payload: TicketTypeQueryDTO): Prisma.TicketTypeWhereInput {
        const query: Prisma.TicketTypeWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(payload.eventId, { eventId: payload.eventId }),
            createObjectWithoutThrow(payload.visibility, { visibility: payload.visibility }),
            createObjectWithoutThrow(isBoolean(payload.highlighted), { highlighted: payload.highlighted }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
