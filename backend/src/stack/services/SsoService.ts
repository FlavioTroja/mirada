import { Service } from "fastify-decorators";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { AuthenticatedUser, AuthService } from "@services/AuthService";
import { UserService } from "@services/UserService";
import { UserRepository } from "@repositories/UserRepository";
import { SsoConfigDTO, SsoLoginDTO } from "@DTOs/login/SsoLoginDTO";
import { authorizationEndpoint, exchangeCode, IdTokenClaims, oidcConfig } from "@utils/adapters/oidc";

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
@Service()
export class SsoService {
    constructor(
        private readonly authService: AuthService,
        private readonly userService: UserService,
        private readonly userRepository: UserRepository,
    ) {}

    /** Quel poco che serve alla SPA per comporre la richiesta di autorizzazione. */
    public async config(): Promise<SsoConfigDTO> {
        const passwordLogin = this.authService.passwordLoginMode();
        const config = oidcConfig();
        if (!config) {
            return { enabled: false, authorizationEndpoint: null, clientId: null, scope: null, passwordLogin };
        }

        try {
            return {
                enabled: true,
                authorizationEndpoint: await authorizationEndpoint(config),
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
            return { enabled: false, authorizationEndpoint: null, clientId: null, scope: null, passwordLogin };
        }
    }

    /**
     * Scambia il codice di autorizzazione e restituisce l'utenza di mirada
     * corrispondente, pronta per essere firmata come qualsiasi altro accesso.
     */
    public async login(dto: SsoLoginDTO): Promise<AuthenticatedUser> {
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

        const existing = await this.userService.findOneForAuthentication(
            { authentikSub: claims.sub },
            { populate: "roles" },
        );

        const user = existing ?? await this.linkByEmail(claims);

        this.authService.assertAccountCanLogin(user);

        Log.info(`[Sso Service]: SSO login allowed for user '${user.username}' (id ${user.id})`);
        return user;
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
    private async linkByEmail(claims: IdTokenClaims): Promise<AuthenticatedUser> {
        const email = claims.email?.trim().toLowerCase();

        if (!email) {
            Log.warn(`[Sso Service]: sub '${claims.sub}' has no email claim — cannot link to a mirada account`);
            throw new httpErrors.Forbidden(
                "Il tuo profilo sul fornitore di identità non espone un indirizzo email: non è possibile collegarlo.",
            );
        }

        if (claims.email_verified === false) {
            Log.warn(`[Sso Service]: sub '${claims.sub}' has an unverified email — link refused`);
            throw new httpErrors.Forbidden(
                "L'indirizzo email del tuo profilo non risulta verificato: non è possibile collegarlo.",
            );
        }

        const user = await this.userService.findOneForAuthentication(
            { person: { contact: { email } } },
            { populate: "roles" },
        );

        if (!user) {
            Log.warn(`[Sso Service]: no mirada account for '${email}' (sub '${claims.sub}') — access refused`);
            throw new httpErrors.Forbidden(
                "Il tuo accesso è valido, ma non esiste un'utenza su questa piattaforma collegata al tuo indirizzo. "
                + "Chiedi a un amministratore di crearla.",
            );
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
