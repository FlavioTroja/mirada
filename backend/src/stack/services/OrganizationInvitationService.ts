import { Service } from "fastify-decorators";
import { OrganizationInvitation, OrgMemberRole, Prisma } from "@prisma/client";
import httpErrors from "http-errors";
import { createHash, randomBytes } from "node:crypto";
import { Log } from "@utils/adapters/log";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { getPrismaClient } from "@utils/adapters/prisma";
import { OrganizationInvitationRepository } from "@repositories/OrganizationInvitationRepository";
import { OrganizationMemberRepository } from "@repositories/OrganizationMemberRepository";
import { OrganizationRepository } from "@repositories/OrganizationRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { OrganizationMemberService } from "@services/OrganizationMemberService";
import { MailService } from "@mail/MailService";
import { OrganizationInvitationCreateDTO } from "@DTOs/organization_invitation/OrganizationInvitationCreateDTO";
import { OrganizationInvitationQueryDTO } from "@DTOs/organization_invitation/OrganizationInvitationQueryDTO";

/** Sette giorni: il tempo di leggere la posta senza che il link diventi eterno. */
const INVITO_TTL_GIORNI = 7;

/**
 * **Gli inviti a entrare in un'organizzazione che esiste già.**
 *
 * È la seconda delle due strade d'ingresso per un organizzatore. La prima —
 * arrivare dal fornitore di identità senza invito — apre un tenant nuovo. Questa
 * porta dentro un tenant altrui, ed è per questo che ha molte più regole.
 *
 * ── L'invariante ─────────────────────────────────────────────────────────────
 * **Solo un `OWNER` dell'organizzazione può invitare, e solo nella propria.**
 * Non basta essere membri: un responsabile eventi che potesse invitare titolari
 * si promuoverebbe da sé passando per un secondo indirizzo.
 *
 * ── Cosa custodisce la banca dati ────────────────────────────────────────────
 * L'**impronta** del gettone, mai il gettone. L'originale esiste solo dentro il
 * link che parte per posta: chi legge una copia del database non entra in
 * nessuna organizzazione.
 */
@Service()
export class OrganizationInvitationService {
    constructor(
        private readonly organizationInvitationRepository: OrganizationInvitationRepository,
        private readonly organizationMemberRepository: OrganizationMemberRepository,
        private readonly organizationRepository: OrganizationRepository,
        private readonly organizationScopeService: OrganizationScopeService,
        private readonly organizationMemberService: OrganizationMemberService,
        private readonly mailService: MailService,
    ) {}

    public async save(principalId: number, dto: OrganizationInvitationCreateDTO): Promise<OrganizationInvitation> {
        await this.assertTitolare(principalId, dto.organizationId);

        const email = dto.email.trim().toLowerCase();
        const organization = await this.organizationRepository.findOne({ id: dto.organizationId, deleted: false });
        if (!organization) {
            throw new httpErrors.NotFound("Organizzazione non trovata.");
        }

        // Chi è già dentro non si invita: l'invito gli arriverebbe, lo
        // accetterebbe, e il vincolo di unicità su (organizzazione, utente,
        // ruolo) farebbe fallire l'accettazione con un errore incomprensibile
        // **dopo** che ha già fatto tutto il giro.
        const giaMembro = await this.organizationMemberRepository.findOne({
            organizationId: dto.organizationId,
            deleted: false,
            user: { person: { contact: { email } } },
        } as never);
        if (giaMembro) {
            throw new httpErrors.Conflict("Questa persona fa già parte dell'organizzazione.");
        }

        // Il gettone si genera QUI e si restituisce al chiamante una volta sola,
        // dentro il link dell'email. In banca dati va la sola impronta.
        const token = randomBytes(32).toString("base64url");
        const scadenza = new Date(Date.now() + INVITO_TTL_GIORNI * 24 * 60 * 60 * 1000);

        Log.info(
            `[OrganizationInvitation Service]: inviting '${email}' as ${OrgMemberRole.OWNER} `
            + `to organization (id ${dto.organizationId}) by user (id ${principalId})`,
        );

        const invitation = await this.organizationInvitationRepository.save({
            organizationId: dto.organizationId,
            email,
            // Oggi si invitano solo titolari: gli altri ruoli si assegnano dal
            // backoffice a chi un'utenza ce l'ha già.
            role: OrgMemberRole.OWNER,
            tokenHash: impronta(token),
            invitedById: principalId,
            expiresAt: scadenza,
        } as never);

        await this.mailService.sendOrganizationInvitation(email, {
            organizzazione: organization.name,
            inviteUrl: `${backofficeUrl()}/registrazione?invito=${encodeURIComponent(token)}`,
            validForDays: INVITO_TTL_GIORNI,
        });

        Log.info(`[OrganizationInvitation Service]: invitation created (id ${invitation.id}) for '${email}'`);
        return invitation;
    }

    public async paginate(
        principalId: number,
        query: OrganizationInvitationQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<OrganizationInvitation> | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const where: Prisma.OrganizationInvitationWhereInput = {};
        if (query.organizationId) where.organizationId = query.organizationId;
        if (query.email) where.email = { contains: query.email.trim().toLowerCase() };
        if (query.soloAperti) {
            where.acceptedAt = null;
            where.revokedAt = null;
            where.expiresAt = { gt: new Date() };
        }
        return this.organizationInvitationRepository.paginateInScope(scope, where, options) as never;
    }

    /**
     * Revoca. Non cancella la riga: «chi ha invitato chi, e poi ci ha
     * ripensato» è una domanda che ci si pone dopo, e una riga cancellata non
     * risponde a niente.
     */
    public async revoke(principalId: number, id: number): Promise<OrganizationInvitation> {
        const invitation = await this.organizationInvitationRepository.findOne({ id });
        if (!invitation) {
            throw new httpErrors.NotFound("Invito non trovato.");
        }
        await this.assertTitolare(principalId, invitation.organizationId);

        if (invitation.acceptedAt) {
            throw new httpErrors.Conflict(
                "Questo invito è già stato accettato: per togliere la persona, rimuovila dai membri.",
            );
        }

        Log.info(`[OrganizationInvitation Service]: revoking invitation (id ${id}) by user (id ${principalId})`);
        return this.organizationInvitationRepository.update({ id }, { revokedAt: new Date() });
    }

    /** L'invito dietro un gettone, se è ancora spendibile. `null` se non lo è. */
    public async findSpendibile(token: string) {
        return this.organizationInvitationRepository.findSpendibileByHash(impronta(token), {
            populate: "organization",
        });
    }

    /**
     * Spende l'invito: crea la membership e allinea i ruoli.
     *
     * ⚠️ L'invito si **rilegge dentro la transazione** invece di fidarsi di
     * quello passato dal chiamante. Fra il controllo e la scrittura può essere
     * stato revocato, o speso da un secondo clic sullo stesso link arrivato un
     * istante prima: rileggerlo qui, insieme alla scrittura, è ciò che rende
     * l'accettazione davvero unica.
     */
    public async accept(token: string, userId: number, email: string): Promise<OrganizationInvitation> {
        const hash = impronta(token);

        return getPrismaClient().$transaction(async prisma => {
            const invitation = await this.organizationInvitationRepository.findSpendibileByHash(hash, undefined, prisma);
            if (!invitation) {
                throw new httpErrors.Gone("Questo invito non è più valido: chiedine un altro all'organizzatore.");
            }

            // L'invito vale per QUELL'indirizzo. Senza questo confronto un link
            // inoltrato — anche solo perché la casella è condivisa — porterebbe
            // un estraneo dentro un'organizzazione altrui.
            if (invitation.email !== email.trim().toLowerCase()) {
                Log.warn(
                    `[OrganizationInvitation Service]: invitation (id ${invitation.id}) presented by '${email}' `
                    + `but issued to '${invitation.email}' — refused`,
                );
                throw new httpErrors.Forbidden(
                    "Questo invito è stato mandato a un altro indirizzo: accedi con quello a cui è arrivato.",
                );
            }

            await this.organizationMemberRepository.save(
                {
                    organizationId: invitation.organizationId,
                    userId,
                    role: invitation.role,
                    invitedAt: invitation.createdAt,
                    acceptedAt: new Date(),
                },
                prisma,
            );

            await this.organizationMemberService.syncMembershipRoles(userId, prisma);

            const accettato = await this.organizationInvitationRepository.update(
                { id: invitation.id },
                { acceptedAt: new Date(), acceptedById: userId },
                undefined,
                undefined,
                prisma,
            );

            Log.info(
                `[OrganizationInvitation Service]: invitation (id ${invitation.id}) accepted by user (id ${userId}) `
                + `— joined organization (id ${invitation.organizationId}) as ${invitation.role}`,
            );
            return accettato;
        });
    }

    /**
     * Titolare **di quella** organizzazione. Essere membri non basta: un
     * responsabile eventi che potesse invitare titolari si promuoverebbe da sé
     * passando per un secondo indirizzo.
     */
    private async assertTitolare(principalId: number, organizationId: number): Promise<void> {
        const scope = await this.organizationScopeService.resolve(principalId);
        this.organizationScopeService.assertWritable(scope, organizationId);

        // `scope === null` è `GOD`: nessuna restrizione, e nessuna membership da
        // cercare — non ne ha, per costruzione.
        if (scope === null) return;

        const titolare = await this.organizationMemberRepository.findOne({
            organizationId,
            userId: principalId,
            role: OrgMemberRole.OWNER,
            deleted: false,
        });
        if (!titolare) {
            Log.warn(
                `[OrganizationInvitation Service]: user (id ${principalId}) is not OWNER of organization `
                + `(id ${organizationId}) — invitation refused`,
            );
            throw new httpErrors.Forbidden("Solo un titolare dell'organizzazione può invitare altri titolari.");
        }
    }
}

/**
 * Dove porta il link dell'invito.
 *
 * ⚠️ Il **backoffice**, non il sito pubblico: chi accetta diventa titolare di
 * un'organizzazione, e il posto dove lo si fa è `app.mirada.dance`. Riusare
 * `PUBLIC_URL` — che è di `mirada.dance` — manderebbe l'invitato su un sito che
 * quella pagina non ce l'ha, con un `404` al posto del benvenuto.
 */
function backofficeUrl(): string {
    return (process.env.BACKOFFICE_URL ?? "https://app.mirada.dance").replace(/\/+$/, "");
}

/** SHA-256 in esadecimale: l'impronta che finisce in banca dati. */
function impronta(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}
