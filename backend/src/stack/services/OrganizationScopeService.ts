import { Service } from "fastify-decorators";
import httpErrors from "http-errors";
import { OrganizationMemberRepository } from "@repositories/OrganizationMemberRepository";
import { isGod, rolesGranting } from "@utils/adapters/permission";
import { currentActor } from "@utils/adapters/requestContext";
import { Log } from "@utils/adapters/log";
import { ROLE_OF_MEMBERSHIP } from "@utils/helpers/membershipRole";
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

    /**
     * `null` = nessuna restrizione (GOD). Array vuoto = nessuna appartenenza, quindi nessuna riga.
     *
     * ── Un ruolo vale nell'organizzazione in cui è stato dato ───────────────
     * I ruoli di un'appartenenza sono copiati in `RoleToUser`, che è globale, e
     * `HasPermission` li legge da lì. Da solo quel controllo dice «questo
     * utente può modificare eventi **da qualche parte**», non **dove**. Se lo
     * scope fosse l'insieme di tutte le organizzazioni dell'utente, chi è
     * `OWNER` di A e `CHECKIN_OPERATOR` di B modificherebbe gli eventi di B con
     * i poteri che ha in A — ed era così (`RuoloPerOrganizzazione.test.ts`).
     *
     * Per questo, dentro una richiesta, lo scope tiene solo le organizzazioni in
     * cui il ruolo dell'appartenenza concede **ogni** permesso dichiarato dalla
     * rotta. Il permesso lo dichiara la rotta e non chi chiama: nessuno dei
     * servizi che risolvono lo scope deve ricordarsene.
     *
     * Fuori da una richiesta con permessi dichiarati — prove di servizio, lavori
     * pianificati — resta l'insieme di tutte le appartenenze: lì non c'è una
     * rotta che dica quale permesso si sta esercitando.
     */
    public async resolve(principalId: number): Promise<OrganizationScope> {
        if (await isGod(principalId)) {
            return null;
        }

        const memberships = await this.organizationMemberRepository.findByUser(principalId);
        const context = currentActor();
        const permissions = context?.actorId === principalId ? context.permissions : undefined;

        if (!permissions?.length) {
            return [...new Set(memberships.map(m => m.organizationId))];
        }

        const granting = await Promise.all(permissions.map(p => rolesGranting(p)));
        const scope = [...new Set(
            memberships
                .filter(m => granting.every(roles => roles.includes(ROLE_OF_MEMBERSHIP[m.role])))
                .map(m => m.organizationId),
        )];

        if (scope.length < new Set(memberships.map(m => m.organizationId)).size) {
            Log.debug(
                `[OrganizationScope Service]: scope of user (id ${principalId}) narrowed to [${scope.join(", ")}] ` +
                `by the role held in each organization`,
            );
        }
        return scope;
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

    /**
     * **A quale organizzazione appartiene una riga che si sta creando** — e la
     * risposta la dà il server, non il corpo della richiesta.
     *
     * ── Il difetto che questo metodo chiude (4 settembre 2026) ───────────────
     * `assertWritable(scope, dto.organizationId)` rifiuta con `403` quando
     * `organizationId` è **assente**, perché `isWritableOrganization` pretende un
     * valore. Le pagine Location e Cast non lo mandavano, e creare una sala in
     * produzione rispondeva *«Non hai i permessi per operare su questa
     * organizzazione»* — un messaggio che accusa il chiamante di un problema che
     * non ha: l'organizzazione ce l'ha, non l'aveva **detta**.
     *
     * ── Perché derivare, e non pretendere che il client la mandi ─────────────
     * Perché è un dato che il server **conosce già**. È la stessa disciplina del
     * prezzo in `OrderPricingService` — *«un prezzo che arriva dal client è un
     * difetto di sicurezza»* — applicata alla tenancy: chiedere al client di
     * dichiarare la propria organizzazione lo mette nella posizione di
     * dichiararne un'altra, e obbliga ogni pagina a ricordarsene. Due se ne sono
     * dimenticate, e nessuna delle due falliva in compilazione.
     *
     * ── I quattro casi ──────────────────────────────────────────────────────
     * | chi                     | `organizationId` | esito |
     * |---|---|---|
     * | `GOD` (scope `null`)    | qualunque        | passa com'è: può creare righe di piattaforma |
     * | membro                  | **indicato**     | verificato come prima |
     * | membro di **una** org   | assente          | **derivato** |
     * | membro di **più** org   | assente          | `400`, e dice che manca la scelta |
     *
     * L'ultimo caso è l'unico in cui il server non può decidere al posto di
     * nessuno — e allora lo dice, invece di rispondere «non hai i permessi».
     */
    public resolveOwner(
        scope: OrganizationScope,
        organizationId?: number | null,
    ): number | null | undefined {
        // `GOD` non ha restrizioni e può creare righe di piattaforma
        // (`organizationId` nullo): ciò che manda vale così com'è.
        if (scope === null) {
            return organizationId;
        }

        if (organizationId !== undefined && organizationId !== null) {
            this.assertWritable(scope, organizationId);
            return organizationId;
        }

        if (scope.length === 1) {
            return scope[0];
        }

        if (scope.length === 0) {
            throw new httpErrors.Forbidden(
                "Non appartieni ad alcuna organizzazione: non puoi creare questa riga.",
            );
        }

        throw new httpErrors.BadRequest(
            "Appartieni a più organizzazioni: indica a quale appartiene questa riga.",
        );
    }

    /**
     * Come `resolveOwner`, ma per le entità la cui colonna `organizationId` è
     * **obbligatoria** — `Event`, `FiscalDeclaration`, `OrganizationMember`.
     *
     * Lì una riga di piattaforma non esiste: un evento senza organizzatore non è
     * un evento. `GOD` deve quindi indicarla, e se non lo fa se lo sente dire —
     * invece di ricevere l'errore del database su una colonna nulla, che parla
     * di vincoli e non di ciò che manca.
     */
    public resolveRequiredOwner(scope: OrganizationScope, organizationId?: number | null): number {
        const resolved = this.resolveOwner(scope, organizationId);
        if (resolved === undefined || resolved === null) {
            throw new httpErrors.BadRequest("Indica l'organizzazione a cui appartiene questa riga.");
        }
        return resolved;
    }
}
