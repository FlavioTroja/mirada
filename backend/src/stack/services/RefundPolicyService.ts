import { Service } from "fastify-decorators";
import { Prisma, RefundPolicy } from "@prisma/client";
import httpErrors from "http-errors";
import { isBoolean } from "lodash";
import { Log } from "@utils/adapters/log";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { RefundPolicyRepository } from "@repositories/RefundPolicyRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { RefundPolicyCreateDTO } from "@DTOs/refund_policy/RefundPolicyCreateDTO";
import { RefundPolicyUpdateDTO } from "@DTOs/refund_policy/RefundPolicyUpdateDTO";
import { RefundPolicyQueryDTO } from "@DTOs/refund_policy/RefundPolicyQueryDTO";
import { findRestrictions, RefundPolicyTerms, RefundTier } from "@utils/helpers/refundPolicy";

@Service()
export class RefundPolicyService {
    constructor(
        private readonly refundPolicyRepository: RefundPolicyRepository,
        private readonly organizationScopeService: OrganizationScopeService,
    ) {}

    public async save(principalId: number, dto: RefundPolicyCreateDTO): Promise<RefundPolicy> {
        const scope = await this.organizationScopeService.resolve(principalId);
        // organizationId nullo = preset di piattaforma: riservato a GOD.
        // L'organizzazione la DERIVA il server (§OrganizationScopeService).
        const organizationId = this.organizationScopeService.resolveOwner(scope, dto.organizationId);
        this.assertTiersAreCoherent(dto.tiers);
        await this.assertDerivationIsNotMoreRestrictive({
            derivedFromPolicyId: dto.derivedFromPolicyId,
            tiers: dto.tiers,
            transferDeadlineHours: dto.transferDeadlineHours,
            feeRefundable: dto.feeRefundable,
        });

        Log.info(`[RefundPolicy Service]: creating refund policy for organization (id ${organizationId ?? "platform"})`);
        const policy = await this.refundPolicyRepository.save({ ...dto, organizationId });
        Log.info(`[RefundPolicy Service]: refund policy created (id ${policy.id})`);
        return policy;
    }

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<RefundPolicy | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.refundPolicyRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async findPlatformPresets(): Promise<RefundPolicy[]> {
        return this.refundPolicyRepository.findPlatformPresets();
    }

    public async paginate(
        principalId: number,
        query: RefundPolicyQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<RefundPolicy>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.refundPolicyRepository.paginateInScope(scope, this.createQueryFromPayload(query), options);
    }

    public async updateById(principalId: number, id: number, dto: RefundPolicyUpdateDTO): Promise<RefundPolicy> {
        const policy = await this.findByIdOrThrow(principalId, id);
        const scope = await this.organizationScopeService.resolve(principalId);
        this.organizationScopeService.assertWritable(scope, dto.organizationId ?? policy.organizationId);
        this.assertTiersAreCoherent(dto.tiers);
        await this.assertDerivationIsNotMoreRestrictive({
            derivedFromPolicyId: dto.derivedFromPolicyId === undefined ? policy.derivedFromPolicyId : dto.derivedFromPolicyId,
            tiers: dto.tiers ?? (policy.tiers as unknown as RefundTier[]),
            transferDeadlineHours: dto.transferDeadlineHours ?? policy.transferDeadlineHours,
            feeRefundable: dto.feeRefundable ?? policy.feeRefundable,
        }, id);

        Log.info(`[RefundPolicy Service]: updating refund policy (id ${id})`);
        return this.refundPolicyRepository.update({ id }, dto);
    }

    public async safeDeleteById(principalId: number, id: number): Promise<RefundPolicy> {
        const policy = await this.findByIdOrThrow(principalId, id);
        const scope = await this.organizationScopeService.resolve(principalId);
        this.organizationScopeService.assertWritable(scope, policy.organizationId);

        Log.info(`[RefundPolicy Service]: soft deleting refund policy (id ${id})`);
        return this.refundPolicyRepository.safeDeleteById(id);
    }

    /**
     * §4.4 con l'emendamento B.0 — una policy derivata da un preset di piattaforma
     * può essere **più favorevole al partecipante, mai più restrittiva**.
     *
     * `derivedFromPolicyId` è ciò che rende la regola verificabile: senza il
     * riferimento il confronto non avrebbe un termine, ed è la ragione per cui in
     * fase A il controllo era rimasto incompleto. Le tre grandezze confrontate —
     * scaglioni, finestra di trasferimento e rimborsabilità dei diritti di
     * prevendita — e il verso in cui migliorano stanno in
     * `@utils/helpers/refundPolicy`.
     */
    private async assertDerivationIsNotMoreRestrictive(
        candidate: {
            derivedFromPolicyId?: number | null;
            tiers?: RefundTier[] | null;
            transferDeadlineHours?: number | null;
            feeRefundable?: boolean | null;
        },
        selfId?: number,
    ): Promise<void> {
        if (!candidate.derivedFromPolicyId) {
            return;
        }

        if (selfId && candidate.derivedFromPolicyId === selfId) {
            Log.warn(`[RefundPolicy Service]: refund policy (id ${selfId}) cannot derive from itself`);
            throw new httpErrors.BadRequest("Una politica di rimborso non può derivare da se stessa.");
        }

        const preset = await this.refundPolicyRepository.findOne({
            id: candidate.derivedFromPolicyId,
            deleted: false,
        });

        if (!preset) {
            Log.warn(`[RefundPolicy Service]: derivation refused — policy (id ${candidate.derivedFromPolicyId}) not found`);
            throw new httpErrors.BadRequest("La politica di rimborso di origine non esiste.");
        }

        if (!preset.isPlatformPreset) {
            Log.warn(`[RefundPolicy Service]: derivation refused — policy (id ${preset.id}) is not a platform preset`);
            throw new httpErrors.BadRequest("Si può derivare solo da un preset di piattaforma.");
        }

        const derivedTerms: RefundPolicyTerms = {
            tiers: candidate.tiers ?? [],
            transferDeadlineHours: candidate.transferDeadlineHours ?? 0,
            feeRefundable: candidate.feeRefundable ?? false,
        };
        const presetTerms: RefundPolicyTerms = {
            tiers: (preset.tiers as unknown as RefundTier[]) ?? [],
            transferDeadlineHours: preset.transferDeadlineHours,
            feeRefundable: preset.feeRefundable,
        };

        const violations = findRestrictions(derivedTerms, presetTerms);
        if (violations.length) {
            Log.warn(
                `[RefundPolicy Service]: derivation from preset (id ${preset.id}) refused — `
                + `${violations.length} condition(s) more restrictive than the preset`,
            );
            throw new httpErrors.BadRequest(
                "La politica derivata non può essere più restrittiva del preset da cui discende: "
                + `${violations.join("; ")}.`,
            );
        }

        Log.info(`[RefundPolicy Service]: derivation from preset (id ${preset.id}) accepted — no condition is more restrictive`);
    }

    /**
     * `tiers` = `[{ daysBefore, percent }]`. La percentuale rimborsata non può
     * crescere avvicinandosi all'evento: sarebbe una scala incoerente e produrrebbe
     * rimborsi non spiegabili al partecipante.
     */
    private assertTiersAreCoherent(tiers?: RefundTier[] | null): void {
        if (!tiers?.length) {
            return;
        }

        const sorted = [...tiers].sort((a, b) => b.daysBefore - a.daysBefore);
        let previousPercent = Number.POSITIVE_INFINITY;

        for (const tier of sorted) {
            if (tier.percent > previousPercent) {
                Log.warn(`[RefundPolicy Service]: incoherent refund tiers — ${tier.percent}% at ${tier.daysBefore} days before the event`);
                throw new httpErrors.BadRequest(
                    "Gli scaglioni di rimborso non possono aumentare avvicinandosi alla data dell'evento.",
                );
            }
            previousPercent = tier.percent;
        }
    }

    private async findByIdOrThrow(principalId: number, id: number): Promise<RefundPolicy> {
        const policy = await this.findById(principalId, id);
        if (!policy) {
            Log.warn(`[RefundPolicy Service]: refund policy (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Politica di rimborso non trovata.");
        }
        return policy;
    }

    private createQueryFromPayload(payload: RefundPolicyQueryDTO): Prisma.RefundPolicyWhereInput {
        const query: Prisma.RefundPolicyWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(payload.organizationId, { organizationId: payload.organizationId }),
            createObjectWithoutThrow(isBoolean(payload.isPlatformPreset), { isPlatformPreset: payload.isPlatformPreset }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
