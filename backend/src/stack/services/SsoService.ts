import { Service } from "fastify-decorators";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { AuthenticatedUser, AuthService } from "@services/AuthService";
import { UserService } from "@services/UserService";
import { UserRepository } from "@repositories/UserRepository";
import { SsoConfigDTO, SsoLoginDTO, SsoSignupDTO } from "@DTOs/login/SsoLoginDTO";
import { OrganizationService } from "@services/OrganizationService";
import { OrganizationInvitationService } from "@services/OrganizationInvitationService";
import { signSsoTicket, verifySsoTicket } from "@utils/helpers/ssoTicket";
import { authorizationEndpoint, endSessionEndpoint, exchangeCode, IdTokenClaims, oidcConfig } from "@utils/adapters/oidc";

/**
 * Accesso tramite fornitore di identità — Authentik (`auth.mirada.dance`).
 *
 * ── Il confine, che è la ragione per cui questo servizio è breve ─────────────
 * **Authentik dice CHI sei. Mirada decide COSA puoi.** Qui finisce la prima
 * metà: si verifica l'identità e si trova l'utenza corrispondente. Ruoli,
 * appartenenza all'organizzazione e permessi restano dove sono sempre stati —
 * `RoleToUser`, `OrganizationMember`, `PermissionConfig` — e non vengono
 * toccati da nessuna rivendicazione del token.
 *
 * La conseguenza pratica: dal ritorno di questo metodo in poi il percorso è
 * **identico** a quello dell'accesso con password. Lo stesso payload firmato
 * (§3.1), lo stesso `wsCode`, gli stessi cancelli d'accesso. Cambia solo *come
 * nasce* la sessione, non come viene usata — ed è per questo che
 * `Authenticate.ts` e tutta la catena dei permessi non hanno dovuto cambiare.
 *
 * ── Perché NON crea utenze ───────────────────────────────────────────────────
 * Chi si autentica su Authentik senza avere un'utenza qui viene **respinto**,
 * non creato al volo. Creare l'utenza significherebbe decidere che ruolo darle,
 * e quella è una decisione di mirada che nessuno ha preso: nascerebbe un utente
 * senza ruoli, che entra e non vede nulla, indistinguibile da un guasto.
 *
 * Quando entreranno i ballerini dall'app mobile la risposta cambierà — lì il
 * ruolo giusto esiste ed è sempre lo stesso (`DANCER`) — e questo è il punto in
 * cui aggiungerlo.
 */
/**
 * I due esiti di un accesso dal fornitore di identità. Discriminati su `esito`
 * invece che «token oppure eccezione»: non avere ancora un'utenza è un passo
 * del percorso, non un guasto.
 */
export type SsoLoginOutcome =
    | { esito: "sessione"; user: AuthenticatedUser }
    | {
          esito: "registrazione";
          /** Identità già verificata, firmata da noi, valida quindici minuti. */
          ticket: string;
          email: string;
          nome: string | null;
          invito: { organizationId: number; organizzazione: string; ruolo: string } | null;
      };

@Service()
export class SsoService {
    constructor(
        private readonly authService: AuthService,
        private readonly userService: UserService,
        private readonly userRepository: UserRepository,
        private readonly organizationService: OrganizationService,
        private readonly organizationInvitationService: OrganizationInvitationService,
    ) {}

    /** Quel poco che serve alla SPA per comporre la richiesta di autorizzazione. */
    public async config(): Promise<SsoConfigDTO> {
        const passwordLogin = this.authService.passwordLoginMode();
        const config = oidcConfig();
        if (!config) {
            return { enabled: false, authorizationEndpoint: null, endSessionEndpoint: null, clientId: null, scope: null, passwordLogin };
        }

        try {
            return {
                enabled: true,
                authorizationEndpoint: await authorizationEndpoint(config),
                // Una sola scoperta serve entrambi: `discovery()` ha la sua
                // cache, quindi la seconda chiamata non esce dal processo.
                endSessionEndpoint: await endSessionEndpoint(config),
                clientId: config.clientId,
                scope: config.scope,
                passwordLogin,
            };
        } catch (err) {
            // Il fornitore irraggiungibile NON è un errore della pagina di
            // accesso: si risponde «spento» e la SPA mostra il solo form con
            // utente e password, che continua a funzionare. Un 500 qui
            // renderebbe inaccessibile il backoffice per un guasto di un
            // servizio che è, di proposito, soltanto una seconda strada.
            Log.warn(`[Sso Service]: identity provider unreachable, SSO announced as disabled: ${(err as Error).message}`);
            return { enabled: false, authorizationEndpoint: null, endSessionEndpoint: null, clientId: null, scope: null, passwordLogin };
        }
    }

    /**
     * Scambia il codice di autorizzazione e dice **cosa succede adesso**.
     *
     * Due esiti, e non uno più un errore. Chi ha già un'utenza entra. Chi non
     * ce l'ha non ha sbagliato nulla: si è autenticato correttamente e non è
     * ancora nessuno **qui** — è il primo passo di un'iscrizione, non un
     * fallimento, e trattarlo come un `403` costringerebbe l'interfaccia a
     * leggere gli errori per capire cosa mostrare.
     *
     * Nel secondo caso torna un **biglietto firmato** con l'identità già
     * verificata. Serve perché il codice di autorizzazione è monouso e l'abbiamo
     * appena speso: senza il biglietto, alla conferma del modulo dovremmo o
     * rifare tutto il giro OIDC, o fidarci del browser su chi è la persona.
     */
    public async login(dto: SsoLoginDTO): Promise<SsoLoginOutcome> {
        const config = oidcConfig();
        if (!config) {
            Log.error("[Sso Service]: login attempted but OIDC_ISSUER/OIDC_CLIENT_ID are not configured");
            throw new httpErrors.ServiceUnavailable("L'accesso tramite fornitore di identità non è configurato.");
        }

        let claims: IdTokenClaims;
        try {
            claims = await exchangeCode(config, dto);
        } catch (err) {
            // Il motivo vero sta nei log dell'adapter. A chi sta davanti allo
            // schermo si dice una cosa sola: non ha funzionato. Distinguere
            // «codice già usato» da «verificatore sbagliato» non lo aiuta e
            // aiuterebbe chi sta provando a indovinare.
            Log.warn(`[Sso Service]: code exchange failed — ${(err as Error).message}`);
            throw new httpErrors.Unauthorized("Accesso tramite il fornitore di identità non riuscito.");
        }

        Log.info(`[Sso Service]: identity verified for sub '${claims.sub}'`);

        const bySub = await this.userService.findOneForAuthentication(
            { authentikSub: claims.sub },
            { populate: "roles" },
        );

        const user = bySub ?? await this.linkByEmail(claims);

        if (user) {
            this.authService.assertAccountCanLogin(user);
            Log.info(`[Sso Service]: SSO login allowed for user '${user.username}' (id ${user.id})`);
            return { esito: "sessione", user };
        }

        // Nessuna utenza: la persona deve ancora iscriversi. Se ha in mano un
        // invito valido glielo si descrive, perché la pagina possa dire «stai
        // per unirti a Tango Club Bari» invece di chiedergli di aprire
        // un'organizzazione che non voleva aprire.
        const invito = dto.invito ? await this.descriviInvito(dto.invito, claims.email) : null;

        Log.info(
            `[Sso Service]: no mirada account for sub '${claims.sub}' — issuing a signup ticket`
            + (invito ? ` with a pending invitation to organization (id ${invito.organizationId})` : ""),
        );

        return {
            esito: "registrazione",
            ticket: signSsoTicket(
                { sub: claims.sub, email: claims.email!, name: claims.name },
                process.env.JWT_SECRET!,
            ),
            email: claims.email!,
            nome: claims.name ?? null,
            invito,
        };
    }

    /**
     * **La registrazione vera e propria**, con la regola che tiene insieme tutto:
     *
     * > è il gettone dell'invito a decidere se nasce un tenant.
     *
     * Senza invito si apre un'organizzazione nuova. Con un invito valido si
     * entra in quella indicata e **nessuna organizzazione viene creata**. Le due
     * strade stanno nello stesso metodo di proposito: sono mutuamente esclusive,
     * e separarle in due endpoint vorrebbe dire che qualcuno, un giorno, potrà
     * chiamarli tutti e due.
     */
    public async signup(dto: SsoSignupDTO): Promise<AuthenticatedUser> {
        const esito = verifySsoTicket(dto.ticket, process.env.JWT_SECRET!);
        if (!esito.ok) {
            Log.warn(`[Sso Service]: signup refused — ticket ${esito.reason}`);
            throw esito.reason === "EXPIRED"
                ? new httpErrors.Gone("La registrazione è rimasta aperta troppo a lungo: rifai l'accesso.")
                : new httpErrors.Unauthorized("Registrazione non valida: rifai l'accesso.");
        }

        const { sub, email, name } = esito.payload;

        // Fra il biglietto e questa chiamata possono essere passati minuti: in
        // mezzo la stessa persona potrebbe aver completato la registrazione in
        // un'altra scheda. Ricontrollare qui evita di creare la seconda utenza —
        // e di farla fallire sul vincolo di unicità con un errore che non
        // spiegherebbe nulla.
        const esistente = await this.userService.findOneForAuthentication(
            { OR: [{ authentikSub: sub }, { person: { contact: { email } } }] },
            { populate: "roles" },
        );
        if (esistente) {
            Log.info(`[Sso Service]: signup found an account already created for '${email}' — logging in instead`);
            this.authService.assertAccountCanLogin(esistente);
            return esistente;
        }

        const user = await this.userService.createFromSso({ sub, email, name });

        if (dto.invito) {
            await this.organizationInvitationService.accept(dto.invito, user.id, email);
        } else {
            await this.organizationService.openSelfService(user.id, {
                name: dto.organizzazione!.nome,
                contactEmail: dto.organizzazione!.emailContatto ?? email,
            });
        }

        // Si rilegge: fra creazione dell'utenza e assegnazione del ruolo sono
        // passate due transazioni, e il token va firmato con i ruoli VERI —
        // altrimenti la persona entra autenticata e senza alcun permesso, cioè
        // in un backoffice vuoto che sembra rotto.
        const definitivo = await this.userService.findOneForAuthentication({ id: user.id }, { populate: "roles" });
        if (!definitivo) {
            throw new httpErrors.InternalServerError("Registrazione completata ma utenza non rileggibile.");
        }

        Log.info(
            `[Sso Service]: signup completed for '${definitivo.username}' (id ${definitivo.id}) `
            + (dto.invito ? "by accepting an invitation" : "by opening a new organization"),
        );
        return definitivo;
    }

    /** L'invito dietro il gettone, se è spendibile **e** intestato a questa persona. */
    private async descriviInvito(token: string, email?: string) {
        const invito = await this.organizationInvitationService.findSpendibile(token);
        if (!invito) return null;

        // Un invito valido ma intestato a un altro indirizzo non si descrive
        // nemmeno: dirne il nome dell'organizzazione a chi non è il destinatario
        // sarebbe già dire qualcosa che non gli spetta.
        if (!email || invito.email !== email.trim().toLowerCase()) return null;

        return {
            organizationId: invito.organizationId,
            organizzazione: (invito as { organization?: { name: string } }).organization?.name ?? "",
            ruolo: invito.role,
        };
    }

    /**
     * Il **primo** accesso via SSO di un'utenza che esiste già: si aggancia
     * l'identità del fornitore alla riga di mirada, cercandola per email.
     *
     * ⚠️ L'aggancio per email si fa **una volta sola**, e da lì in poi vale il
     * `sub`. È la ragione per cui la colonna esiste: l'email cambia e può essere
     * riassegnata, il `sub` no. Continuare a cercare per email significherebbe
     * che chi eredita un indirizzo eredita l'account.
     */
    private async linkByEmail(claims: IdTokenClaims): Promise<AuthenticatedUser | null> {
        const email = claims.email?.trim().toLowerCase();

        if (!email) {
            Log.warn(`[Sso Service]: sub '${claims.sub}' has no email claim — cannot link to a mirada account`);
            throw new httpErrors.Forbidden(
                "Il tuo profilo sul fornitore di identità non espone un indirizzo email: non è possibile collegarlo.",
            );
        }

        const user = await this.userService.findOneForAuthentication(
            { person: { contact: { email } } },
            { populate: "roles" },
        );

        // ── L'indirizzo dimostrato serve per AGGANCIARE, non per iscriversi ──
        //
        // Il controllo sta **dopo** la ricerca, e l'ordine è la sostanza. Ciò
        // che va impedito è che qualcuno rivendichi l'indirizzo di un'utenza
        // che esiste già e se ne impossessi: lì un indirizzo non dimostrato è
        // un'appropriazione di account. Chi invece non corrisponde a nessuno
        // sta solo iscrivendosi, e nel farlo non porta via niente a nessuno.
        //
        // Messo prima, questo `if` rifiutava anche chi si stava registrando —
        // e siccome Authentik restituiva `email_verified: false` per costante
        // (vedi la nota nella mappatura dello scope `email`), rifiutava tutti.
        if (user && claims.email_verified === false) {
            Log.warn(
                `[Sso Service]: sub '${claims.sub}' claims '${email}', which belongs to user (id ${user.id}), `
                + "but the provider does not vouch for the address — link refused",
            );
            throw new httpErrors.Forbidden(
                "L'indirizzo email del tuo profilo non risulta verificato dal fornitore di identità: "
                + "non è possibile collegarlo a un'utenza esistente.",
            );
        }

        // Nessuna utenza: NON è un errore. Da quando gli organizzatori possono
        // iscriversi da soli, questo è il caso normale del primo accesso — e chi
        // chiama lo traduce in «registrati», non in «non puoi entrare».
        if (!user) {
            Log.info(`[Sso Service]: no mirada account for '${email}' (sub '${claims.sub}') — signup needed`);
            return null;
        }

        // ── L'indirizzo, se il fornitore lo dà per verificato, È verificato ──
        // `emailVerifiedAt` esiste per rispondere a «qualcuno ha dimostrato che
        // questo indirizzo è suo?». Un accesso completato su Authentik con
        // `email_verified: true` è esattamente quella dimostrazione: pretendere
        // in più il clic su un'email di conferma vorrebbe dire chiedere due
        // volte la stessa prova, e chiuderebbe fuori chi la prima l'ha già data.
        const emailVerifiedAt = !user.emailVerifiedAt && claims.email_verified === true
            ? new Date()
            : undefined;

        await this.userRepository.update(
            { id: user.id },
            { authentikSub: claims.sub, ...(emailVerifiedAt ? { emailVerifiedAt } : {}) },
        );

        Log.info(
            `[Sso Service]: identity '${claims.sub}' linked to user '${user.username}' (id ${user.id}) by email`
            + (emailVerifiedAt ? " — email marked as verified" : ""),
        );

        return { ...user, ...(emailVerifiedAt ? { emailVerifiedAt } : {}) };
    }
}
