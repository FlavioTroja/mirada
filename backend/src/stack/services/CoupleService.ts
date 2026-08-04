import { Service } from "fastify-decorators";
import { Couple, DanceRole, Event, Prisma, Registration } from "@prisma/client";
import httpErrors from "http-errors";
import { isBoolean } from "lodash";
import { Log } from "@utils/adapters/log";
import { getPrismaClient } from "@utils/adapters/prisma";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { CoupleRepository } from "@repositories/CoupleRepository";
import { RegistrationRepository } from "@repositories/RegistrationRepository";
import { EventRepository } from "@repositories/EventRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { CoupleCreateDTO } from "@DTOs/couple/CoupleCreateDTO";
import { CoupleUpdateDTO } from "@DTOs/couple/CoupleUpdateDTO";
import { CoupleQueryDTO } from "@DTOs/couple/CoupleQueryDTO";

/** Coppia con i suoi due componenti — la relazione va letta dalle iscrizioni (§4.10). */
export type CoupleWithMembers = Couple & { registrations: Registration[] };

/**
 * `Couple` — backend-brief §4.10.
 *
 * **Non punta alle iscrizioni**: sono le `Registration` a puntare alla coppia con
 * `coupleId`, così il grafo resta aciclico. Vincolo di servizio: una coppia ha
 * esattamente due `Registration` con ruoli assegnati **complementari**.
 *
 * ⚠︎ Questo servizio **non chiama mai il motore di capienza**, ed è deliberato.
 * Lo scioglimento «non muove alcun consumo: le persone restano, cambia solo il
 * legame» (`05` §8, caso T21), e l'iscrizione a coppia supera il cancello di
 * tolleranza **senza codice dedicato** — una coppia aggiunge un'unità per parte e
 * non altera lo sbilancio. Se qui comparisse un caso particolare per le coppie,
 * sarebbe il sintomo di un errore nel modello (§4.8 nota 4).
 */
@Service()
export class CoupleService {
    constructor(
        private readonly coupleRepository: CoupleRepository,
        private readonly registrationRepository: RegistrationRepository,
        private readonly eventRepository: EventRepository,
        private readonly organizationScopeService: OrganizationScopeService,
    ) {}

    public async save(principalId: number, dto: CoupleCreateDTO): Promise<CoupleWithMembers> {
        await this.assertWritableEvent(principalId, dto.eventId);

        const registrationIds = dto.registrationIds ?? [];
        if (registrationIds.length) {
            await this.assertPairIsBindable(dto.eventId, registrationIds);
        }

        Log.info(`[Couple Service]: creating couple on event (id ${dto.eventId})`);

        return getPrismaClient().$transaction(async prisma => {
            const couple = await this.coupleRepository.save({ eventId: dto.eventId }, prisma);

            for (const registrationId of registrationIds) {
                await this.registrationRepository.update(
                    { id: registrationId },
                    { coupleId: couple.id },
                    undefined,
                    undefined,
                    prisma,
                );
            }

            const registrations = await this.registrationRepository.findByCouple(couple.id, prisma);
            Log.info(`[Couple Service]: couple created (id ${couple.id}) with ${registrations.length} member(s)`);
            return { ...couple, registrations };
        });
    }

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<Couple | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.coupleRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async paginate(
        principalId: number,
        query: CoupleQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<Couple>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.coupleRepository.paginateInScope(scope, this.createQueryFromPayload(query), options);
    }

    public async updateById(principalId: number, id: number, dto: CoupleUpdateDTO): Promise<Couple> {
        const couple = await this.findByIdOrThrow(principalId, id);
        await this.assertWritableEvent(principalId, couple.eventId);

        Log.info(`[Couple Service]: updating couple (id ${id})`);
        return this.coupleRepository.update({ id }, dto as any);
    }

    /**
     * `05` §8 e caso T21 — **scioglimento senza rinuncia: nessun movimento sui
     * contatori**. Le due persone restano iscritte, con il loro ruolo e il loro
     * posto; cade soltanto il legame. Non si chiama il motore di capienza, e non
     * è una dimenticanza.
     */
    public async dissolve(principalId: number, id: number): Promise<CoupleWithMembers> {
        const couple = await this.findByIdOrThrow(principalId, id);
        await this.assertWritableEvent(principalId, couple.eventId);

        if (couple.dissolvedAt) {
            Log.warn(`[Couple Service]: dissolve refused for couple (id ${id}) — already dissolved`);
            throw new httpErrors.BadRequest("La coppia è già stata sciolta.");
        }

        Log.info(`[Couple Service]: dissolving couple (id ${id}) — no quota consumption is moved, both dancers stay in`);

        return getPrismaClient().$transaction(async prisma => {
            const members = await this.registrationRepository.findByCouple(id, prisma);
            const dissolved = await this.coupleRepository.update(
                { id },
                { dissolvedAt: new Date() },
                undefined,
                undefined,
                prisma,
            );

            for (const member of members) {
                await this.registrationRepository.update(
                    { id: member.id },
                    { coupleId: null },
                    undefined,
                    undefined,
                    prisma,
                );
            }

            const registrations = await this.registrationRepository.findByIds(members.map(m => m.id), prisma);
            Log.info(`[Couple Service]: couple (id ${id}) dissolved — ${registrations.length} registration(s) unlinked, counters untouched`);
            return { ...dissolved, registrations };
        });
    }

    public async safeDeleteById(principalId: number, id: number): Promise<Couple> {
        const couple = await this.findByIdOrThrow(principalId, id);
        await this.assertWritableEvent(principalId, couple.eventId);

        const members = await this.registrationRepository.findByCouple(id);
        if (members.length) {
            Log.warn(`[Couple Service]: delete refused for couple (id ${id}) — ${members.length} registration(s) still linked`);
            throw new httpErrors.BadRequest("La coppia ha ancora iscrizioni collegate: va prima sciolta.");
        }

        Log.info(`[Couple Service]: soft deleting couple (id ${id})`);
        return this.coupleRepository.safeDeleteById(id);
    }

    // ─────────────────────────────────────────────────────────────────────────

    /** Esattamente due iscrizioni dello stesso evento, con ruoli assegnati complementari. */
    private async assertPairIsBindable(eventId: number, registrationIds: number[]): Promise<void> {
        const registrations = await this.registrationRepository.findByIds(registrationIds);

        if (registrations.length !== 2) {
            Log.warn(`[Couple Service]: refused a couple with ${registrations.length} member(s) — exactly two are required`);
            throw new httpErrors.BadRequest("Una coppia si compone di esattamente due iscrizioni.");
        }
        if (registrations.some(r => r.eventId !== eventId)) {
            Log.warn(`[Couple Service]: refused a couple whose members do not all belong to event (id ${eventId})`);
            throw new httpErrors.BadRequest("Le due iscrizioni devono appartenere allo stesso evento.");
        }
        if (registrations.some(r => r.coupleId !== null)) {
            Log.warn(`[Couple Service]: refused a couple — one of the registrations is already bound to another couple`);
            throw new httpErrors.BadRequest("Una delle due iscrizioni fa già parte di un'altra coppia.");
        }

        const roles = registrations.map(r => r.assignedRole);
        const complementary =
            roles.includes(DanceRole.LEADER) && roles.includes(DanceRole.FOLLOWER);
        const bothUnassigned = roles.every(role => role === null);

        // Ruoli non ancora assegnati: la coppia si forma prima della conferma di
        // pagamento, che è il momento in cui il motore risolve i flessibili.
        if (!complementary && !bothUnassigned) {
            Log.warn(`[Couple Service]: refused a couple with non-complementary roles [${roles.join(", ")}]`);
            throw new httpErrors.BadRequest("Una coppia richiede ruoli complementari: un leader e un follower.");
        }
    }

    private async assertWritableEvent(principalId: number, eventId: number): Promise<Event> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const event = await this.eventRepository.findOneInScope(scope, { id: eventId, deleted: false });
        if (!event) {
            Log.warn(`[Couple Service]: event (id ${eventId}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Evento non trovato.");
        }
        this.organizationScopeService.assertWritable(scope, event.organizationId);
        return event;
    }

    private async findByIdOrThrow(principalId: number, id: number): Promise<Couple> {
        const couple = await this.findById(principalId, id);
        if (!couple) {
            Log.warn(`[Couple Service]: couple (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Coppia non trovata.");
        }
        return couple;
    }

    private createQueryFromPayload(payload: CoupleQueryDTO): Prisma.CoupleWhereInput {
        const query: Prisma.CoupleWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(payload.eventId, { eventId: payload.eventId }),
            createObjectWithoutThrow(isBoolean(payload.dissolved), {
                dissolvedAt: payload.dissolved ? { not: null } : null,
            }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
