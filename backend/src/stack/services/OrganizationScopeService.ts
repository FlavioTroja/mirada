import { Service } from "fastify-decorators";
import httpErrors from "http-errors";
import { OrganizationMemberRepository } from "@repositories/OrganizationMemberRepository";
import { isGod } from "@utils/adapters/permission";
import { isWritableOrganization, OrganizationScope } from "@utils/helpers/organizationScope";

/**
 * Contesto di tenancy — backend-brief §1.5.
 *
 * Traduce l'utente autenticato nell'insieme delle organizzazioni di cui è membro,
 * che è il filtro obbligatorio di ogni finder su un'entità che discende da
 * `Organization`. `GOD` è l'unico principale senza restrizione (`null`).
 */
@Service()
export class OrganizationScopeService {
    constructor(private readonly organizationMemberRepository: OrganizationMemberRepository) {}

    /** `null` = nessuna restrizione (GOD). Array vuoto = nessuna appartenenza, quindi nessuna riga. */
    public async resolve(principalId: number): Promise<OrganizationScope> {
        if (await isGod(principalId)) {
            return null;
        }
        return this.organizationMemberRepository.findOrganizationIdsByUser(principalId);
    }

    /**
     * Verifica che il chiamante possa SCRIVERE righe dell'organizzazione indicata.
     * Le righe di piattaforma (`organizationId` nullo) sono riservate a `GOD`.
     */
    public assertWritable(scope: OrganizationScope, organizationId?: number | null): void {
        if (!isWritableOrganization(scope, organizationId)) {
            throw new httpErrors.Forbidden(
                "Non hai i permessi per operare su questa organizzazione.",
            );
        }
    }
}
