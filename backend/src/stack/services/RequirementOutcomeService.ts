import { Service } from "fastify-decorators";
import {
    Prisma,
    Registration,
    RequirementBlocking,
    RequirementOutcome,
    RequirementOutcomeStatus,
    RequirementVerification,
} from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { getPrismaClient } from "@utils/adapters/prisma";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import {
    BLOCKING_OUTCOME_STATUSES,
    RequirementOutcomeRepository,
} from "@repositories/RequirementOutcomeRepository";
import { EventRequirementRepository } from "@repositories/EventRequirementRepository";
import { RegistrationRepository } from "@repositories/RegistrationRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { RequirementOutcomeCreateDTO } from "@DTOs/requirement_outcome/RequirementOutcomeCreateDTO";
import { RequirementOutcomeUpdateDTO } from "@DTOs/requirement_outcome/RequirementOutcomeUpdateDTO";
import { RequirementOutcomeQueryDTO } from "@DTOs/requirement_outcome/RequirementOutcomeQueryDTO";

/** Il requisito che ferma un ingresso, con il suo NOME e nulla del suo contenuto (`RB12`). */
export type BlockingRequirementSummary = {
    eventRequirementId: number;
    label: unknown;
    status: RequirementOutcomeStatus | null;
};

/**
 * `RequirementOutcome` — backend-brief §4.10.
 *
 * L'esito di un requisito d'evento su una singola iscrizione. Due cose lo
 * distinguono da un CRUD qualunque:
 *
 * 1. **`acceptedAt`, `acceptedIp` e `acceptedVersion` sono calcolati dal server**
 *    (`RF-REQ-4`). Sono la prova di quando e da dove la persona ha accettato, e
 *    una prova che il client scrive non prova nulla. L'indirizzo arriva dalla
 *    richiesta, non dal corpo.
 * 2. **`revaluateForRegistration` è invocato dal trasferimento di biglietto**: il
 *    trasferimento **rivaluta sempre i requisiti sul nuovo titolare** (`RB8`).
 *    Una liberatoria firmata da Anna non vale per Marco, e lasciarla `VALID`
 *    farebbe entrare Marco con la firma di un'altra persona.
 *
 * Nel primo taglio i requisiti sono solo `DECLARATION` e `CUSTOM_FIELD`: nessun
 * upload di documenti, nessun dato sanitario, mai (`RF-REQ-2`, `RF-REQ-3`).
 */
@Service()
export class RequirementOutcomeService {
    constructor(
        private readonly requirementOutcomeRepository: RequirementOutcomeRepository,
        private readonly eventRequirementRepository: EventRequirementRepository,
        private readonly registrationRepository: RegistrationRepository,
        private readonly organizationScopeService: OrganizationScopeService,
    ) {}

    // ─────────────────────────────────────────────────────────────────────────
    // CRUD del dialetto (§3.2)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param ipAddress indirizzo della richiesta: è la prova di `RF-REQ-4`, e
     *                  arriva dal trasporto, mai dal corpo.
     */
    public async save(
        principalId: number,
        dto: RequirementOutcomeCreateDTO,
        ipAddress: string,
    ): Promise<RequirementOutcome> {
        const registration = await this.findRegistrationOrThrow(principalId, dto.registrationId);

        const requirement = await this.eventRequirementRepository.findOne({
            id: dto.eventRequirementId,
            deleted: false,
        });
        if (!requirement) {
            Log.warn(`[RequirementOutcome Service]: create refused — event requirement (id ${dto.eventRequirementId}) not found`);
            throw new httpErrors.NotFound("Requisito non trovato.");
        }
        if (requirement.eventId !== registration.eventId) {
            Log.warn(
                `[RequirementOutcome Service]: create refused — requirement (id ${requirement.id}) belongs to event `
                + `(id ${requirement.eventId}), the registration to event (id ${registration.eventId})`,
            );
            throw new httpErrors.BadRequest("Il requisito non appartiene all'evento dell'iscrizione.");
        }

        const existing = await this.requirementOutcomeRepository.findByRegistrationAndRequirement(
            dto.registrationId,
            dto.eventRequirementId,
        );
        if (existing) {
            Log.warn(
                `[RequirementOutcome Service]: create refused — outcome (id ${existing.id}) already exists for `
                + `registration (id ${dto.registrationId}) and requirement (id ${dto.eventRequirementId})`,
            );
            throw new httpErrors.BadRequest("L'esito di questo requisito esiste già per l'iscrizione.");
        }

        // `AUTOMATIC` vale come accettato nel momento in cui la persona dichiara;
        // `MANUAL` entra in revisione e resta bloccante finché qualcuno non decide.
        const automatic = requirement.verification === RequirementVerification.AUTOMATIC;
        const status = automatic ? RequirementOutcomeStatus.VALID : RequirementOutcomeStatus.UNDER_REVIEW;

        Log.info(
            `[RequirementOutcome Service]: recording outcome for registration (id ${dto.registrationId}) on `
            + `requirement (id ${dto.eventRequirementId}) — ${status}`,
        );

        const outcome = await this.requirementOutcomeRepository.save({
            registrationId: dto.registrationId,
            eventRequirementId: dto.eventRequirementId,
            value: (dto.value ?? {}) as Prisma.InputJsonValue,
            status,
            acceptedAt: new Date(),
            acceptedIp: ipAddress,
            acceptedVersion: this.resolveRequirementVersion(requirement.updatedAt),
        });

        Log.info(`[RequirementOutcome Service]: outcome created (id ${outcome.id})`);
        return outcome;
    }

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<RequirementOutcome | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.requirementOutcomeRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async paginate(
        principalId: number,
        query: RequirementOutcomeQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<RequirementOutcome>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.requirementOutcomeRepository.paginateInScope(
            scope,
            this.createQueryFromPayload(query),
            options,
        );
    }

    /**
     * La **decisione di revisione**: chi ha deciso e quando sono stampati qui, non
     * accettati dal client. Un esito approvato senza revisore è un esito che
     * nessuno ha approvato.
     */
    public async updateById(
        principalId: number,
        id: number,
        dto: RequirementOutcomeUpdateDTO,
    ): Promise<RequirementOutcome> {
        const outcome = await this.findByIdOrThrow(principalId, id);

        const decided = dto.status
            && dto.status !== outcome.status
            && (dto.status === RequirementOutcomeStatus.VALID || dto.status === RequirementOutcomeStatus.REJECTED);

        Log.info(
            `[RequirementOutcome Service]: updating outcome (id ${id})`
            + (dto.status ? ` — status ${outcome.status} → ${dto.status}` : ""),
        );

        return this.requirementOutcomeRepository.update({ id }, {
            ...(dto as Prisma.RequirementOutcomeUpdateInput),
            ...(decided ? { reviewedByUserId: principalId, reviewedAt: new Date() } : {}),
        } as Prisma.RequirementOutcomeUpdateInput);
    }

    public async safeDeleteById(principalId: number, id: number): Promise<RequirementOutcome> {
        await this.findByIdOrThrow(principalId, id);
        Log.info(`[RequirementOutcome Service]: soft deleting outcome (id ${id})`);
        return this.requirementOutcomeRepository.safeDeleteById(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Rivalutazione sul nuovo titolare (`RB8`)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * **Il trasferimento rivaluta sempre i requisiti sul nuovo titolare**
     * (§4.10, `RB8`).
     *
     * Ogni esito dell'iscrizione torna a `TO_PROVIDE` e perde le prove di
     * accettazione: erano di un'altra persona. Non è una cautela, è la condizione
     * perché il requisito continui a significare qualcosa dopo un passaggio di
     * mano — altrimenti basterebbe comprare un biglietto già in regola per
     * aggirare ogni dichiarazione dell'organizzatore.
     *
     * I requisiti dell'evento che non hanno ancora un esito ne ricevono uno
     * `TO_PROVIDE`: così l'elenco di ciò che manca al nuovo titolare è completo
     * fin da subito, sia in `/registrations/:id` sia alla porta.
     */
    public async revaluateForRegistration(
        registrationId: number,
        tx?: Prisma.TransactionClient,
    ): Promise<RequirementOutcome[]> {
        const run = async (prisma: Prisma.TransactionClient): Promise<RequirementOutcome[]> => {
            const registration = await this.registrationRepository.findOne(
                { id: registrationId, deleted: false },
                undefined,
                prisma,
            );
            if (!registration) {
                Log.warn(`[RequirementOutcome Service]: revaluation skipped — registration (id ${registrationId}) not found`);
                return [];
            }

            const requirements = await this.eventRequirementRepository.findMany(
                { eventId: registration.eventId, deleted: false },
                { orderBy: { id: "asc" } },
                prisma,
            );
            const outcomes = await this.requirementOutcomeRepository.findByRegistration(registrationId, prisma);
            const byRequirement = new Map(outcomes.map(outcome => [outcome.eventRequirementId, outcome]));

            const result: RequirementOutcome[] = [];

            for (const requirement of requirements) {
                const existing = byRequirement.get(requirement.id);
                if (existing) {
                    result.push(await this.requirementOutcomeRepository.update(
                        { id: existing.id },
                        {
                            status: RequirementOutcomeStatus.TO_PROVIDE,
                            value: {},
                            acceptedAt: null,
                            acceptedIp: null,
                            acceptedVersion: null,
                            reviewedByUserId: null,
                            reviewedAt: null,
                            rejectionReason: null,
                        },
                        undefined,
                        undefined,
                        prisma,
                    ));
                } else {
                    result.push(await this.requirementOutcomeRepository.save(
                        {
                            registrationId,
                            eventRequirementId: requirement.id,
                            status: RequirementOutcomeStatus.TO_PROVIDE,
                            value: {},
                        },
                        prisma,
                    ));
                }
            }

            Log.info(
                `[RequirementOutcome Service]: revaluated ${result.length} requirement outcome(s) on registration `
                + `(id ${registrationId}) after a change of holder (RB8)`,
            );
            return result;
        };

        return tx ? run(tx) : getPrismaClient().$transaction(run);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Requisiti bloccanti in ingresso (`RF-CHK-4`, `RF-REQ-7`)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Il primo requisito **bloccante in ingresso** non soddisfatto di
     * un'iscrizione, o `null`.
     *
     * Restituisce **il nome del requisito, mai il suo contenuto** (`RB12`):
     * all'operatore serve poter dire *«manca la liberatoria»*, non leggere che
     * cosa la persona vi ha scritto dentro.
     *
     * Un requisito bloccante **senza alcun esito registrato** blocca: l'assenza di
     * una dichiarazione obbligatoria non è un'assenza di problema.
     */
    public async findBlockingForEntry(
        registrationId: number | null,
        eventId: number,
        tx?: Prisma.TransactionClient,
    ): Promise<BlockingRequirementSummary | null> {
        const requirements = await this.eventRequirementRepository.findMany(
            { eventId, deleted: false, blocking: RequirementBlocking.ENTRY },
            { orderBy: { sortOrder: "asc" } },
            tx,
        );
        if (!requirements.length) {
            return null;
        }

        const outcomes = registrationId
            ? await this.requirementOutcomeRepository.findByRegistration(registrationId, tx)
            : [];
        const byRequirement = new Map(outcomes.map(outcome => [outcome.eventRequirementId, outcome]));

        for (const requirement of requirements) {
            const outcome = byRequirement.get(requirement.id);
            const blocked = !outcome || BLOCKING_OUTCOME_STATUSES.includes(outcome.status);
            if (blocked && requirement.mandatory) {
                return {
                    eventRequirementId: requirement.id,
                    label: requirement.label,
                    status: outcome?.status ?? null,
                };
            }
        }

        return null;
    }

    /** Tutti i requisiti bloccanti in ingresso ancora aperti — la colonna del manifest. */
    public async listBlockingForEntry(
        registrationIds: number[],
        eventId: number,
        tx?: Prisma.TransactionClient,
    ): Promise<Map<number, BlockingRequirementSummary[]>> {
        const result = new Map<number, BlockingRequirementSummary[]>();

        const requirements = await this.eventRequirementRepository.findMany(
            { eventId, deleted: false, blocking: RequirementBlocking.ENTRY, mandatory: true },
            { orderBy: { sortOrder: "asc" } },
            tx,
        );
        if (!requirements.length || !registrationIds.length) {
            return result;
        }

        const outcomes = await this.requirementOutcomeRepository.findByRegistrations(registrationIds, tx);
        const byRegistration = new Map<number, Map<number, RequirementOutcome>>();
        for (const outcome of outcomes) {
            const map = byRegistration.get(outcome.registrationId) ?? new Map();
            map.set(outcome.eventRequirementId, outcome);
            byRegistration.set(outcome.registrationId, map);
        }

        for (const registrationId of registrationIds) {
            const map = byRegistration.get(registrationId) ?? new Map<number, RequirementOutcome>();
            const blocking = requirements
                .filter(requirement => {
                    const outcome = map.get(requirement.id);
                    return !outcome || BLOCKING_OUTCOME_STATUSES.includes(outcome.status);
                })
                .map(requirement => ({
                    eventRequirementId: requirement.id,
                    label: requirement.label,
                    status: map.get(requirement.id)?.status ?? null,
                }));
            if (blocking.length) {
                result.set(registrationId, blocking);
            }
        }

        return result;
    }

    // ─────────────────────────────────────────────────────────────────────────

    private async findByIdOrThrow(principalId: number, id: number): Promise<RequirementOutcome> {
        const outcome = await this.findById(principalId, id);
        if (!outcome) {
            Log.warn(`[RequirementOutcome Service]: outcome (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Esito del requisito non trovato.");
        }
        return outcome;
    }

    private async findRegistrationOrThrow(principalId: number, registrationId: number): Promise<Registration> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const registration = await this.registrationRepository.findOneInScope(scope, {
            id: registrationId,
            deleted: false,
        });
        if (!registration) {
            Log.warn(`[RequirementOutcome Service]: registration (id ${registrationId}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Iscrizione non trovata.");
        }
        return registration;
    }

    /**
     * La «versione» accettata è il momento dell'ultima modifica del requisito:
     * `RF-REQ-4` chiede di sapere **che cosa** è stato accettato, e il testo di un
     * requisito può cambiare dopo la pubblicazione.
     */
    private resolveRequirementVersion(updatedAt: Date): string {
        return updatedAt.toISOString();
    }

    private createQueryFromPayload(payload: RequirementOutcomeQueryDTO): Prisma.RequirementOutcomeWhereInput {
        const query: Prisma.RequirementOutcomeWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(payload.registrationId, { registrationId: payload.registrationId }),
            createObjectWithoutThrow(payload.eventRequirementId, { eventRequirementId: payload.eventRequirementId }),
            createObjectWithoutThrow(payload.status, { status: payload.status }),
            createObjectWithoutThrow(payload.eventId, { registration: { eventId: payload.eventId } }),
            createObjectWithoutThrow(payload.value, {
                registration: {
                    OR: [
                        { holderName: { contains: payload.value ?? "", mode: "insensitive" as const } },
                        { holderSurname: { contains: payload.value ?? "", mode: "insensitive" as const } },
                    ],
                },
            }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
