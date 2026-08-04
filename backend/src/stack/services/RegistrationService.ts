import { Service } from "fastify-decorators";
import { Event, Prisma, Registration, RegistrationStatus } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { getPrismaClient } from "@utils/adapters/prisma";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { RegistrationRepository } from "@repositories/RegistrationRepository";
import { EventRepository } from "@repositories/EventRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { CapacityEngineService, CommitOutcome } from "@services/CapacityEngineService";
import { OrganizationAudienceService } from "@services/OrganizationAudienceService";
import { WsPublisherService } from "@websocket/publisher/WsPublisherService";
import { Events } from "@websocket/events/Events";
import { RegistrationCreatedPayloadDTO } from "@websocket/dtos/RegistrationCreatedPayloadDTO";
import { RegistrationCreateDTO } from "@DTOs/registration/RegistrationCreateDTO";
import { RegistrationUpdateDTO } from "@DTOs/registration/RegistrationUpdateDTO";
import { RegistrationQueryDTO } from "@DTOs/registration/RegistrationQueryDTO";
import { RegistrationRoleReassignDTO } from "@DTOs/registration/RegistrationRoleDTO";

/**
 * `Registration` — backend-brief §4.10.
 *
 * *Una iscrizione per persona per evento, con più biglietti collegati.*
 *
 * Due regole che il servizio deve far rispettare e che non sono di interfaccia:
 *  - `assignedRole` è **calcolato dal server**: la riassegnazione passa dal motore
 *    di capienza, che rilascia i consumi del vecchio ruolo e impegna quelli del
 *    nuovo con le stesse verifiche di un acquisto;
 *  - `status = TO_CONFIRM` **non blocca mai l'ingresso** (`RF-CPL-13`): il
 *    biglietto è valido, restano inattivi il profilo e le comunicazioni non
 *    essenziali. Nessun controllo di questo servizio può derivarne un divieto.
 */
@Service()
export class RegistrationService {
    constructor(
        private readonly registrationRepository: RegistrationRepository,
        private readonly eventRepository: EventRepository,
        private readonly organizationScopeService: OrganizationScopeService,
        private readonly capacityEngineService: CapacityEngineService,
        private readonly organizationAudienceService: OrganizationAudienceService,
        private readonly wsPublisher: WsPublisherService,
    ) {}

    // ─────────────────────────────────────────────────────────────────────────
    // CRUD del dialetto (§3.2)
    // ─────────────────────────────────────────────────────────────────────────

    public async save(principalId: number, dto: RegistrationCreateDTO): Promise<Registration> {
        const event = await this.assertWritableEvent(principalId, dto.eventId);

        if (dto.personUserId) {
            const existing = await this.registrationRepository.findByEventAndPerson(dto.eventId, dto.personUserId);
            if (existing) {
                Log.warn(
                    `[Registration Service]: create refused on event (id ${dto.eventId}) — user (id ${dto.personUserId}) `
                    + `already has registration (id ${existing.id})`,
                );
                throw new httpErrors.BadRequest("Questa persona è già iscritta all'evento.");
            }
        }

        Log.info(`[Registration Service]: creating registration on event (id ${dto.eventId}) for '${dto.holderEmail}'`);
        const registration = await this.registrationRepository.save(dto as any);
        Log.info(`[Registration Service]: registration created (id ${registration.id})`);

        // §3.9 — dopo la scrittura, mai dentro: `registration/created` ai membri
        // dell'organizzazione, uno per uno, mai in broadcast per ruolo.
        await this.publishRegistrationCreated(event, registration);

        return registration;
    }

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<Registration | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.registrationRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async paginate(
        principalId: number,
        query: RegistrationQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<Registration>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.registrationRepository.paginateInScope(scope, this.createQueryFromPayload(query), options);
    }

    public async updateById(principalId: number, id: number, dto: RegistrationUpdateDTO): Promise<Registration> {
        const registration = await this.findByIdOrThrow(principalId, id);
        await this.assertWritableEvent(principalId, registration.eventId);

        Log.info(`[Registration Service]: updating registration (id ${id})`);
        return this.registrationRepository.update({ id }, dto as any);
    }

    /**
     * La cancellazione **rilascia i consumi**: un'iscrizione che sparisce
     * lasciando il proprio posto impegnato è deriva pura fra contatori e realtà
     * (invariante I6, `05` §12).
     */
    public async safeDeleteById(principalId: number, id: number): Promise<Registration> {
        const registration = await this.findByIdOrThrow(principalId, id);
        await this.assertWritableEvent(principalId, registration.eventId);

        Log.info(`[Registration Service]: soft deleting registration (id ${id}) and releasing its quota consumptions`);

        const deleted = await getPrismaClient().$transaction(async prisma => {
            await this.capacityEngineService.releaseRegistrations([id], prisma);
            return this.registrationRepository.safeDeleteById(id, prisma);
        });

        return deleted;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Transizioni (§4.10)
    // ─────────────────────────────────────────────────────────────────────────

    public async confirm(principalId: number, id: number): Promise<Registration> {
        const registration = await this.findByIdOrThrow(principalId, id);
        await this.assertWritableEvent(principalId, registration.eventId);

        if (registration.status === RegistrationStatus.DECLINED) {
            Log.warn(`[Registration Service]: confirm refused for registration (id ${id}) — already declined`);
            throw new httpErrors.BadRequest("L'iscrizione è stata rifiutata e non può essere confermata.");
        }

        Log.info(`[Registration Service]: confirming registration (id ${id})`);
        return this.registrationRepository.update(
            { id },
            { status: RegistrationStatus.CONFIRMED, confirmedAt: new Date() },
        );
    }

    /**
     * `RB24` — il rifiuto rende il biglietto **privo di titolare e lo restituisce
     * alla disponibilità dell'acquirente**: l'iscrizione esce dai contatori, il
     * posto torna in vendita, e i dati del terzo escono dalla piattaforma salvo la
     * traccia contabile obbligatoria.
     */
    public async decline(principalId: number, id: number): Promise<Registration> {
        const registration = await this.findByIdOrThrow(principalId, id);
        await this.assertWritableEvent(principalId, registration.eventId);

        if (registration.status === RegistrationStatus.DECLINED) {
            Log.warn(`[Registration Service]: decline refused for registration (id ${id}) — already declined`);
            throw new httpErrors.BadRequest("L'iscrizione è già stata rifiutata.");
        }

        Log.info(`[Registration Service]: declining registration (id ${id}) and releasing its quota consumptions`);

        return getPrismaClient().$transaction(async prisma => {
            await this.capacityEngineService.releaseRegistrations([id], prisma);
            return this.registrationRepository.update(
                { id },
                { status: RegistrationStatus.DECLINED, declinedAt: new Date() },
                undefined,
                undefined,
                prisma,
            );
        });
    }

    /**
     * `POST /registrations/:id/reassign-role` — rilascio del vecchio ruolo e
     * impegno del nuovo **nella stessa transazione**. Se il nuovo ruolo è saturo
     * l'operazione è rifiutata con `SOLD_OUT` e **nulla cambia**.
     */
    public async reassignRole(
        principalId: number,
        id: number,
        dto: RegistrationRoleReassignDTO,
    ): Promise<CommitOutcome> {
        const registration = await this.findByIdOrThrow(principalId, id);
        await this.assertWritableEvent(principalId, registration.eventId);

        return this.capacityEngineService.reassignRole(id, dto.role, {
            ticketTypeId: dto.ticketTypeId ?? null,
            serviceIds: dto.serviceIds ?? [],
        });
    }

    // ─────────────────────────────────────────────────────────────────────────

    private async publishRegistrationCreated(event: Event, registration: Registration): Promise<void> {
        try {
            const wsCodes = await this.organizationAudienceService.resolveMemberWsCodes(event.organizationId);
            if (!wsCodes.length) {
                return;
            }
            const payload: RegistrationCreatedPayloadDTO = {
                eventId: event.id,
                organizationId: event.organizationId,
                registrationId: registration.id,
            };
            await this.wsPublisher.sendToUsers(wsCodes, Events.REGISTRATION_CREATED, payload);
        } catch (err) {
            // Il segnale è un trigger di refetch: la sua perdita non può far
            // fallire un'iscrizione già scritta.
            Log.error(`[Registration Service]: failed to publish 'registration/created' for registration (id ${registration.id}): ${(err as Error).message}`);
        }
    }

    private async assertWritableEvent(principalId: number, eventId: number): Promise<Event> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const event = await this.eventRepository.findOneInScope(scope, { id: eventId, deleted: false });
        if (!event) {
            Log.warn(`[Registration Service]: event (id ${eventId}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Evento non trovato.");
        }
        this.organizationScopeService.assertWritable(scope, event.organizationId);
        return event;
    }

    private async findByIdOrThrow(principalId: number, id: number): Promise<Registration> {
        const registration = await this.findById(principalId, id);
        if (!registration) {
            Log.warn(`[Registration Service]: registration (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Iscrizione non trovata.");
        }
        return registration;
    }

    private createQueryFromPayload(payload: RegistrationQueryDTO): Prisma.RegistrationWhereInput {
        const query: Prisma.RegistrationWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(payload.eventId, { eventId: payload.eventId }),
            createObjectWithoutThrow(payload.assignedRole, { assignedRole: payload.assignedRole }),
            createObjectWithoutThrow(payload.status, { status: payload.status }),
            createObjectWithoutThrow(payload.channel, { channel: payload.channel }),
            createObjectWithoutThrow(payload.coupleId, { coupleId: payload.coupleId }),
            createObjectWithoutThrow(payload.value, {
                OR: [
                    { holderName: { contains: payload.value ?? "", mode: "insensitive" as const } },
                    { holderSurname: { contains: payload.value ?? "", mode: "insensitive" as const } },
                    { holderEmail: { contains: payload.value ?? "", mode: "insensitive" as const } },
                ],
            }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
