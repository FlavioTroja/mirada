import { Service } from "fastify-decorators";
import { Event, EventRequirement, Prisma, RequirementKind } from "@prisma/client";
import httpErrors from "http-errors";
import { isBoolean } from "lodash";
import { Log } from "@utils/adapters/log";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { EventRequirementRepository } from "@repositories/EventRequirementRepository";
import { EventRepository } from "@repositories/EventRepository";
import { RequirementTypeRepository } from "@repositories/RequirementTypeRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { EventRequirementCreateDTO } from "@DTOs/event_requirement/EventRequirementCreateDTO";
import { EventRequirementUpdateDTO } from "@DTOs/event_requirement/EventRequirementUpdateDTO";
import { EventRequirementQueryDTO } from "@DTOs/event_requirement/EventRequirementQueryDTO";

/**
 * §4.6 — nel primo taglio sono ammessi **solo** `DECLARATION` e `CUSTOM_FIELD`:
 * nessun upload di documenti, nessun dato sanitario, mai (`RF-REQ-2`, `RF-REQ-3`).
 *
 * Oggi l'enum `RequirementKind` contiene esattamente questi due valori, quindi il
 * controllo non può fallire: è deliberato che resti scritto per esteso. Il giorno
 * in cui l'enum crescerà — ed è previsto che cresca — il rifiuto sarà già qui,
 * non da aggiungere.
 */
const ALLOWED_REQUIREMENT_KINDS: RequirementKind[] = [
    RequirementKind.DECLARATION,
    RequirementKind.CUSTOM_FIELD,
];

@Service()
export class EventRequirementService {
    constructor(
        private readonly eventRequirementRepository: EventRequirementRepository,
        private readonly eventRepository: EventRepository,
        private readonly requirementTypeRepository: RequirementTypeRepository,
        private readonly organizationScopeService: OrganizationScopeService,
    ) {}

    public async save(principalId: number, dto: EventRequirementCreateDTO): Promise<EventRequirement> {
        await this.assertWritableEvent(principalId, dto.eventId);
        await this.assertRequirementTypeIsAllowed(dto.requirementTypeId);

        Log.info(`[EventRequirement Service]: creating requirement on event (id ${dto.eventId}) of type (id ${dto.requirementTypeId})`);
        const requirement = await this.eventRequirementRepository.save(dto as any);
        Log.info(`[EventRequirement Service]: requirement created (id ${requirement.id})`);
        return requirement;
    }

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<EventRequirement | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.eventRequirementRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async paginate(
        principalId: number,
        query: EventRequirementQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<EventRequirement>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.eventRequirementRepository.paginateInScope(scope, this.createQueryFromPayload(query), options);
    }

    public async updateById(principalId: number, id: number, dto: EventRequirementUpdateDTO): Promise<EventRequirement> {
        const requirement = await this.findByIdOrThrow(principalId, id);
        await this.assertWritableEvent(principalId, requirement.eventId);

        if (dto.requirementTypeId && dto.requirementTypeId !== requirement.requirementTypeId) {
            await this.assertRequirementTypeIsAllowed(dto.requirementTypeId);
        }

        Log.info(`[EventRequirement Service]: updating requirement (id ${id})`);
        return this.eventRequirementRepository.update({ id }, dto as any);
    }

    public async safeDeleteById(principalId: number, id: number): Promise<EventRequirement> {
        const requirement = await this.findByIdOrThrow(principalId, id);
        await this.assertWritableEvent(principalId, requirement.eventId);

        Log.info(`[EventRequirement Service]: soft deleting requirement (id ${id})`);
        return this.eventRequirementRepository.safeDeleteById(id);
    }

    /** Il `kind` è ereditato dal `RequirementType`: qui si verifica che sia ammesso. */
    private async assertRequirementTypeIsAllowed(requirementTypeId: number): Promise<void> {
        const requirementType = await this.requirementTypeRepository.findOne({ id: requirementTypeId, deleted: false });
        if (!requirementType) {
            Log.warn(`[EventRequirement Service]: requirement type (id ${requirementTypeId}) not found`);
            throw new httpErrors.BadRequest("Tipo di requisito non trovato.");
        }

        if (!ALLOWED_REQUIREMENT_KINDS.includes(requirementType.kind)) {
            Log.warn(
                `[EventRequirement Service]: requirement type (id ${requirementTypeId}) has kind ${requirementType.kind}, `
                + `which is not admitted in the first cut`,
            );
            throw new httpErrors.BadRequest(
                "Nel primo taglio sono ammessi solo requisiti di tipo dichiarazione o campo personalizzato: "
                + "nessun caricamento di documenti e nessun dato sanitario.",
            );
        }
    }

    private async assertWritableEvent(principalId: number, eventId: number): Promise<Event> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const event = await this.eventRepository.findOneInScope(scope, { id: eventId, deleted: false });
        if (!event) {
            Log.warn(`[EventRequirement Service]: event (id ${eventId}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Evento non trovato.");
        }
        this.organizationScopeService.assertWritable(scope, event.organizationId);
        return event;
    }

    private async findByIdOrThrow(principalId: number, id: number): Promise<EventRequirement> {
        const requirement = await this.findById(principalId, id);
        if (!requirement) {
            Log.warn(`[EventRequirement Service]: requirement (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Requisito non trovato.");
        }
        return requirement;
    }

    private createQueryFromPayload(payload: EventRequirementQueryDTO): Prisma.EventRequirementWhereInput {
        const query: Prisma.EventRequirementWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(payload.eventId, { eventId: payload.eventId }),
            createObjectWithoutThrow(payload.requirementTypeId, { requirementTypeId: payload.requirementTypeId }),
            createObjectWithoutThrow(payload.blocking, { blocking: payload.blocking }),
            createObjectWithoutThrow(isBoolean(payload.mandatory), { mandatory: payload.mandatory }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
