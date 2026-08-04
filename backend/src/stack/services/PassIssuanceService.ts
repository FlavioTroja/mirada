import { Service } from "fastify-decorators";
import {
    DanceRole,
    DeclaredDanceRole,
    Event,
    PassIssuance,
    PassIssuanceReason,
    Prisma,
    RegistrationChannel,
    RegistrationStatus,
    Ticket,
} from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { getPrismaClient } from "@utils/adapters/prisma";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { PassIssuanceRepository } from "@repositories/PassIssuanceRepository";
import { TicketTypeRepository } from "@repositories/TicketTypeRepository";
import { RegistrationRepository } from "@repositories/RegistrationRepository";
import { EventRepository } from "@repositories/EventRepository";
import { CapacityQuotaRepository } from "@repositories/CapacityQuotaRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { CapacityEngineService, CommitItem } from "@services/CapacityEngineService";
import { TicketService } from "@services/TicketService";
import {
    PassIssuanceBulkDTO,
    PassIssuanceCreateDTO,
} from "@DTOs/pass_issuance/PassIssuanceCreateDTO";
import { PassIssuanceUpdateDTO } from "@DTOs/pass_issuance/PassIssuanceUpdateDTO";
import { PassIssuanceQueryDTO } from "@DTOs/pass_issuance/PassIssuanceQueryDTO";
import { PassIssuanceBulkResultDTO } from "@DTOs/pass_issuance/PassIssuanceResponseDTO";

/** Causali che non sono una vendita: consumano il contingente accrediti (§4.8). */
const COMPLIMENTARY_REASONS: PassIssuanceReason[] = [
    PassIssuanceReason.COMPLIMENTARY,
    PassIssuanceReason.GIFT,
    PassIssuanceReason.COURTESY,
];

/**
 * # `PassIssuance` — backend-brief §4.12, `RF-TCK-14`, `RB20`
 *
 * L'emissione manuale di pass: accrediti, vendite esterne, omaggi, cortesie.
 *
 * ── `RB20`, la regola che definisce questo servizio ──────────────────────────
 * **L'emissione manuale non è mai bloccata dalle quote.** Si registra il
 * consumo, si restituisce un **avviso** se si supera la capienza della sala, e
 * **si procede**. Non è una scorciatoia: è la traduzione di un fatto reale. La
 * responsabilità della sala è dell'organizzatore, che sta emettendo un accredito
 * conoscendo la propria porta e la propria capienza dichiarata; un rifiuto qui
 * trasformerebbe uno strumento di servizio in un ostacolo la sera dell'evento,
 * e la conseguenza pratica sarebbe far entrare quella persona **fuori dal
 * sistema** — cioè perdere il dato, che è l'unica cosa che il sistema poteva
 * ancora dare.
 *
 * ── `RF-TCK-15`, il ruolo obbligatorio ───────────────────────────────────────
 * Se l'evento usa quote per ruolo, il **ruolo di ballo è obbligatorio**. Senza,
 * l'equilibrio leader/follower mostrato all'organizzatore diventa falso proprio
 * dove serve: su un encuentro con tolleranza è la differenza fra una serata
 * equilibrata e una sala con venti leader in più.
 *
 * ── I pass al portatore ──────────────────────────────────────────────────────
 * I pass emessi in blocco senza nominativo sono **al portatore**: `bearer =
 * true`, **non trasferibili** — non c'è un titolare da cui trasferirli.
 */
@Service()
export class PassIssuanceService {
    constructor(
        private readonly passIssuanceRepository: PassIssuanceRepository,
        private readonly ticketTypeRepository: TicketTypeRepository,
        private readonly registrationRepository: RegistrationRepository,
        private readonly eventRepository: EventRepository,
        private readonly capacityQuotaRepository: CapacityQuotaRepository,
        private readonly organizationScopeService: OrganizationScopeService,
        private readonly capacityEngineService: CapacityEngineService,
        private readonly ticketService: TicketService,
    ) {}

    // ─────────────────────────────────────────────────────────────────────────
    // `POST /events/:id/pass-issuances/bulk` — l'emissione (§3.7)
    // ─────────────────────────────────────────────────────────────────────────

    public async issueBulk(
        principalId: number,
        eventId: number,
        dto: PassIssuanceBulkDTO,
    ): Promise<PassIssuanceBulkResultDTO> {
        const event = await this.assertWritableEvent(principalId, eventId);

        const ticketType = await this.ticketTypeRepository.findWithSessions(dto.ticketTypeId);
        if (!ticketType || ticketType.eventId !== eventId) {
            Log.warn(`[PassIssuance Service]: issuance refused — ticket type (id ${dto.ticketTypeId}) is not of event (id ${eventId})`);
            throw new httpErrors.BadRequest("Il titolo d'ingresso non appartiene a questo evento.");
        }

        // `RF-TCK-15` — il ruolo è obbligatorio quando l'evento usa quote per ruolo.
        const roleQuotas = await this.capacityQuotaRepository.findMany(
            { eventId, deleted: false, role: { not: null } },
            { orderBy: { id: "asc" } },
        );
        if (roleQuotas.length && !dto.role) {
            Log.warn(
                `[PassIssuance Service]: issuance refused on event (id ${eventId}) — the event has ${roleQuotas.length} `
                + "role quota(s) and no dance role was given (RF-TCK-15)",
            );
            throw new httpErrors.BadRequest(
                "Questo evento usa quote per ruolo: il ruolo di ballo è obbligatorio, altrimenti l'equilibrio "
                + "leader/follower mostrato nel cruscotto diventa falso.",
            );
        }

        if (dto.nominal) {
            if (!dto.holders?.length || dto.holders.length !== dto.quantity) {
                Log.warn(`[PassIssuance Service]: issuance refused — ${dto.holders?.length ?? 0} holder(s) for ${dto.quantity} nominal pass(es)`);
                throw new httpErrors.BadRequest(
                    "L'emissione nominale richiede un nominativo per ogni pass emesso.",
                );
            }
        }

        const channel = COMPLIMENTARY_REASONS.includes(dto.reason)
            ? RegistrationChannel.COMPLIMENTARY
            : RegistrationChannel.EXTERNAL_CHANNEL;

        Log.info(
            `[PassIssuance Service]: issuing ${dto.quantity} ${dto.nominal ? "nominal" : "BEARER"} pass(es) on event `
            + `(id ${eventId}) — reason ${dto.reason}, channel ${channel}, role ${dto.role ?? "none"}`,
        );

        const outcome = await getPrismaClient().$transaction(async prisma => {
            const issuance = await this.passIssuanceRepository.save(
                {
                    eventId,
                    ticketTypeId: dto.ticketTypeId,
                    issuedByUserId: principalId,
                    quantity: dto.quantity,
                    reason: dto.reason,
                    role: dto.role ?? null,
                    nominal: dto.nominal,
                    note: dto.note ?? null,
                    issuedAt: new Date(),
                },
                prisma,
            );

            const registrationIds: number[] = [];
            const tickets: Ticket[] = [];

            for (let index = 0; index < dto.quantity; index += 1) {
                const holder = dto.nominal
                    ? dto.holders![index]!
                    : { name: "Pass", surname: `al portatore #${index + 1}`, email: null };

                // Una **iscrizione per pass**: è la persona nell'evento, ed è
                // ciò a cui i consumi di capienza si agganciano. Senza, il pass
                // non comparirebbe in alcun contatore e `RB20` non avrebbe nulla
                // da avvisare.
                const registration = await this.registrationRepository.save(
                    {
                        eventId,
                        holderName: holder.name,
                        holderSurname: holder.surname,
                        holderEmail: holder.email ?? `pass-${issuance.id}-${index + 1}@non-nominale.local`,
                        declaredRole: this.declaredRoleOf(dto.role ?? null),
                        assignedRole: dto.role ?? null,
                        channel,
                        status: RegistrationStatus.CONFIRMED,
                        confirmedAt: new Date(),
                    },
                    prisma,
                );
                registrationIds.push(registration.id);

                const ticket = await this.ticketService.issue(
                    {
                        eventId,
                        ticketTypeId: dto.ticketTypeId,
                        registrationId: registration.id,
                        passIssuanceId: issuance.id,
                        holderName: holder.name,
                        holderSurname: holder.surname,
                        holderEmail: holder.email ?? null,
                        // Senza nominativo il pass è **al portatore**, e quindi
                        // non trasferibile.
                        bearer: !dto.nominal,
                    },
                    prisma,
                );
                tickets.push(ticket);
            }

            // `RB20` — impegno **non bloccante**: si registra e si avvisa.
            const items: CommitItem[] = registrationIds.map(registrationId => ({
                registrationId,
                ticketTypeId: dto.ticketTypeId,
                quantity: 1,
                roleOverride: dto.role ?? null,
            }));
            const capacity = await this.capacityEngineService.commitWithoutBlocking(eventId, items, prisma);

            return { issuance, tickets, registrationIds, warnings: capacity.warnings };
        });

        Log.info(
            `[PassIssuance Service]: issuance (id ${outcome.issuance.id}) completed on event (id ${eventId}) — `
            + `${outcome.tickets.length} ticket(s), ${outcome.warnings.length} capacity warning(s), nothing blocked (RB20)`,
        );

        return {
            passIssuance: outcome.issuance,
            tickets: outcome.tickets,
            registrationIds: outcome.registrationIds,
            warnings: outcome.warnings.map(warning => ({
                quotaId: warning.quotaId,
                scope: warning.scope,
                scopeId: warning.scopeId,
                scopeLabel: warning.scopeLabel,
                role: warning.role,
                limit: warning.limit,
                consumed: warning.consumed,
                exceededBy: warning.exceededBy,
            })),
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CRUD del dialetto (§3.2)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * La creazione «nuda» registra l'atto senza emettere biglietti: è la strada
     * per riconciliare a posteriori un'emissione avvenuta altrove. L'emissione
     * vera passa da `POST /events/:id/pass-issuances/bulk`, che è ciò che il §3.7
     * dichiara e ciò che il form `/tickets/issue` chiama.
     */
    public async save(principalId: number, dto: PassIssuanceCreateDTO): Promise<PassIssuance> {
        await this.assertWritableEvent(principalId, dto.eventId);

        Log.info(`[PassIssuance Service]: recording a pass issuance on event (id ${dto.eventId}) without emitting tickets`);
        return this.passIssuanceRepository.save({
            ...(dto as Prisma.PassIssuanceUncheckedCreateInput),
            issuedByUserId: principalId,
            issuedAt: new Date(),
        });
    }

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<PassIssuance | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.passIssuanceRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async paginate(
        principalId: number,
        query: PassIssuanceQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<PassIssuance>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.passIssuanceRepository.paginateInScope(scope, this.createQueryFromPayload(query), options);
    }

    public async updateById(principalId: number, id: number, dto: PassIssuanceUpdateDTO): Promise<PassIssuance> {
        await this.findByIdOrThrow(principalId, id);
        Log.info(`[PassIssuance Service]: updating the note of pass issuance (id ${id})`);
        return this.passIssuanceRepository.update({ id }, dto as Prisma.PassIssuanceUpdateInput);
    }

    /**
     * La cancellazione **revoca l'emissione, annulla i suoi biglietti e rilascia
     * i consumi**: un accredito ritirato che lasciasse il proprio posto occupato
     * sarebbe deriva pura fra contatori e realtà (`05` §8, invariante I6).
     */
    public async safeDeleteById(principalId: number, id: number): Promise<PassIssuance> {
        const issuance = await this.findByIdOrThrow(principalId, id);
        await this.assertWritableEvent(principalId, issuance.eventId);

        Log.info(`[PassIssuance Service]: revoking pass issuance (id ${id}) — tickets cancelled and quotas released`);

        return getPrismaClient().$transaction(async prisma => {
            const tickets = await this.ticketService.findByIssuance(id, prisma);
            const registrationIds = tickets
                .map(ticket => ticket.registrationId)
                .filter((registrationId): registrationId is number => !!registrationId);

            for (const ticket of tickets) {
                await this.ticketService.cancel(ticket.id, prisma);
            }
            if (registrationIds.length) {
                await this.capacityEngineService.releaseRegistrations(registrationIds, prisma);
            }

            const revoked = await this.passIssuanceRepository.update(
                { id },
                { revokedAt: new Date(), deleted: true },
                undefined,
                undefined,
                prisma,
            );

            Log.info(
                `[PassIssuance Service]: pass issuance (id ${id}) revoked — ${tickets.length} ticket(s) cancelled, `
                + `${registrationIds.length} registration(s) released`,
            );
            return revoked;
        });
    }

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Un pass emesso senza ruolo su un evento senza quote di ruolo non ha un
     * ruolo dichiarato: `FLEXIBLE` è la sola forma onesta, e il motore lo
     * risolverà a `null` non trovando quote di ruolo.
     */
    private declaredRoleOf(role: DanceRole | null): DeclaredDanceRole {
        if (role === DanceRole.LEADER) return DeclaredDanceRole.LEADER;
        if (role === DanceRole.FOLLOWER) return DeclaredDanceRole.FOLLOWER;
        return DeclaredDanceRole.FLEXIBLE;
    }

    private async assertWritableEvent(principalId: number, eventId: number): Promise<Event> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const event = await this.eventRepository.findOneInScope(scope, { id: eventId, deleted: false });
        if (!event) {
            Log.warn(`[PassIssuance Service]: event (id ${eventId}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Evento non trovato.");
        }
        this.organizationScopeService.assertWritable(scope, event.organizationId);
        return event;
    }

    private async findByIdOrThrow(principalId: number, id: number): Promise<PassIssuance> {
        const issuance = await this.findById(principalId, id);
        if (!issuance) {
            Log.warn(`[PassIssuance Service]: pass issuance (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Emissione non trovata.");
        }
        return issuance;
    }

    private createQueryFromPayload(payload: PassIssuanceQueryDTO): Prisma.PassIssuanceWhereInput {
        const query: Prisma.PassIssuanceWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(payload.eventId, { eventId: payload.eventId }),
            createObjectWithoutThrow(payload.ticketTypeId, { ticketTypeId: payload.ticketTypeId }),
            createObjectWithoutThrow(payload.reason, { reason: payload.reason }),
            createObjectWithoutThrow(payload.role, { role: payload.role }),
            payload.nominal === undefined ? {} : { nominal: payload.nominal },
            createObjectWithoutThrow(payload.value, {
                note: { contains: payload.value ?? "", mode: "insensitive" as const },
            }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
