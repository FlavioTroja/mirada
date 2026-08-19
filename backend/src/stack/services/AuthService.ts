import { Service } from "fastify-decorators";
import { UserService } from "@services/UserService";
import { comparePasswords } from "@utils/helpers/crypto";
import { User } from "@prisma/client";
import httpErrors from "http-errors";
import { LoginRequestDTO } from "@DTOs/login/LoginRequestDTO";
import { AuthTokenPayloadDTO } from "@DTOs/login/AuthTokenPayloadDTO";
import { LogService } from "@services/LogService";
import { Log } from "@utils/adapters/log";
import { domainError } from "@utils/helpers/domainError";
import { DomainErrorCode } from "@enums/DomainErrorCode";

/** Riga utente arricchita dei soli ruoli, come la restituisce `findOneForAuthentication`. */
export type AuthenticatedUser = User & { roles?: { roleName: string; isActive: boolean }[] };

/**
 * Quanto è aperta la porta dell'accesso con utente e password, ora che esiste
 * anche quella del fornitore di identità.
 *
 *  - `on`        tutti possono usarla. **È il valore predefinito**, ed è la
 *                configurazione giusta finché l'SSO non ha mesi di uso reale
 *                alle spalle: Authentik è un punto di rottura unico davanti al
 *                backoffice, e senza questa porta un suo guasto chiude fuori
 *                anche chi dovrebbe entrare per ripararlo.
 *  - `god-only`  la chiave d'emergenza. Solo chi ha il ruolo `GOD` entra con la
 *                password; per tutti gli altri l'unica strada è Authentik, con
 *                il secondo fattore e le politiche che ci sono configurate.
 *  - `off`       nessuno. Da usare solo quando esiste un'altra via di rientro
 *                documentata, perché qui un guasto di Authentik non lascia
 *                alcuna porta di servizio.
 */
export type PasswordLoginMode = "on" | "god-only" | "off";

@Service()
export class AuthService {
    constructor(
        private readonly userService: UserService,
        private readonly logService: LogService
    ) {}

    /**
     * Come sta la porta dell'accesso con password — `PASSWORD_LOGIN` nel `.env`.
     *
     * ⚠️ **Un valore non riconosciuto vale `on`, non `off`**, e la scelta è
     * deliberata. Questo interruttore esiste per garantire una via di rientro:
     * far valere `off` a un `PASSWORD_LOGIN=of` battuto male significherebbe
     * che un refuso chiude fuori tutto lo staff — e se nel frattempo Authentik
     * non risponde, non resta nessuno che possa correggerlo. Si perde la
     * chiusura, non l'accesso. L'errore però si urla nel log, perché chi
     * credeva di aver chiuso deve poterlo scoprire leggendo l'avvio e non un
     * incidente.
     */
    public passwordLoginMode(): PasswordLoginMode {
        const grezzo = (process.env.PASSWORD_LOGIN ?? "on").trim().toLowerCase();
        if (grezzo === "on" || grezzo === "god-only" || grezzo === "off") {
            return grezzo;
        }
        Log.error(
            `[Auth Service]: PASSWORD_LOGIN has an unrecognised value '${process.env.PASSWORD_LOGIN}' — `
            + "falling back to 'on'. Accepted values are 'on', 'god-only', 'off'.",
        );
        return "on";
    }

    async login(loginRequestDTO: LoginRequestDTO): Promise<AuthenticatedUser> {
        const mode = this.passwordLoginMode();

        // `off` si rifiuta PRIMA di toccare la banca dati: non c'è nulla da
        // verificare, e non interrogare nessuno è anche l'unico modo di non
        // dire, con il tempo di risposta, se quel nome utente esista.
        if (mode === "off") {
            Log.warn(`[Auth Service]: password login refused for '${loginRequestDTO.usernameOrEmail}' — PASSWORD_LOGIN is 'off'`);
            throw new httpErrors.Forbidden(
                "L'accesso con nome utente e password è disattivato: entra dal fornitore di identità.",
            );
        }

        // L'hash della password vive **solo** su questo percorso: il client Prisma
        // lo omette globalmente (§3.1), questo finder lo riaccende in modo
        // esplicito perché il confronto bcrypt non può farne a meno.
        const user = await this.userService.findOneForAuthentication({
            OR: [
                { username: loginRequestDTO.usernameOrEmail },
                {
                    person: {
                        contact: {
                            email: loginRequestDTO.usernameOrEmail,
                        }
                    }
                }
            ]
        }, { populate: "roles" });
        if(!user) {
            throw new httpErrors.Unauthorized("Username o password non validi!");
        }

        if(!await this.comparePasswords(user.password, loginRequestDTO.password)) {
            throw new httpErrors.Unauthorized("Username o password non validi!");
        }

        // `god-only` si valuta DOPO la verifica della password, e non prima:
        // per sapere se questa persona è `GOD` bisogna prima sapere che è
        // davvero questa persona. Chi arriva fin qui ha comunque dimostrato di
        // conoscere le credenziali, quindi scoprire che la porta è ristretta
        // non gli dice nulla che non potesse già dedurre.
        if (mode === "god-only" && !isGod(user)) {
            Log.warn(
                `[Auth Service]: password login refused for '${user.username}' (id ${user.id}) — `
                + "PASSWORD_LOGIN is 'god-only' and the account is not GOD",
            );
            throw new httpErrors.Forbidden(
                "L'accesso con nome utente e password è riservato all'amministratore di piattaforma: "
                + "entra dal fornitore di identità.",
            );
        }

        this.assertAccountCanLogin(user);

        return user;
    }

    private async comparePasswords(password: string, candidate: string) {
        return await comparePasswords(password, candidate);
    }

    /**
     * Payload da firmare — backend-brief §3.1: `{ id, username, wsCode, roles }`
     * **e nulla più**. Il template firmava `{ ...user }` e spandeva l'hash bcrypt
     * della password in un blob base64 conservato in `localStorage`.
     *
     * Questo è l'**unico** punto in cui si compone il payload del token: se un
     * campo serve altrove, si legge da `GET /auth/profile`, non lo si aggiunge qui.
     */
    public toTokenPayload(user: AuthenticatedUser): AuthTokenPayloadDTO {
        return {
            id: user.id,
            username: user.username,
            wsCode: user.wsCode ?? null,
            roles: (user.roles ?? []).map(role => ({
                roleName: role.roleName as AuthTokenPayloadDTO["roles"][number]["roleName"],
                isActive: role.isActive,
            })),
        };
    }

    /**
     * I cancelli d'accesso, **in quest'ordine di proposito**.
     *
     * Prima le decisioni prese da un amministratore — cancellato, disabilitato,
     * fuori dalla finestra di validità — e solo **per ultima** la conferma
     * dell'indirizzo. Il criterio è: si dice alla persona la cosa su cui può
     * agire soltanto se non c'è nulla su cui non può agire.
     *
     * All'inverso, un account sospeso e mai confermato leggerebbe «conferma il
     * tuo indirizzo», andrebbe a cercare l'email, premerebbe il tasto e si
     * ritroverebbe davanti «Account disabilitato»: due passaggi per arrivare
     * all'informazione che contava fin dall'inizio.
     *
     * ⚠️ È **pubblico** perché anche l'accesso tramite fornitore di identità
     * deve passare di qui (`SsoService`). Autenticarsi su Authentik dimostra
     * *chi sei*, non che il tuo account su mirada sia attivo: sospensione,
     * scadenza e cancellazione sono decisioni di questa applicazione, e un
     * secondo percorso d'ingresso che le saltasse le renderebbe inefficaci.
     */
    public assertAccountCanLogin(user: User): void {
        if (user.deleted) {
            Log.warn(`[${AuthService.name}][login][${user.id}] login negato: account eliminato`);
            throw new httpErrors.Unauthorized("Account non più attivo.");
        }
        if (!user.enabled) {
            Log.warn(`[${AuthService.name}][login][${user.id}] login negato: account disabilitato`);
            throw new httpErrors.Unauthorized("Account disabilitato.");
        }

        const now = new Date();
        if (user.activatedAt && user.activatedAt.getTime() > now.getTime()) {
            Log.warn(`[${AuthService.name}][login][${user.id}] login negato: account non ancora attivo (activatedAt=${user.activatedAt.toISOString()})`);
            throw new httpErrors.Unauthorized("Account non ancora attivo.");
        }
        if (user.expiresAt && user.expiresAt.getTime() < now.getTime()) {
            Log.warn(`[${AuthService.name}][login][${user.id}] login negato: account scaduto (expiresAt=${user.expiresAt.toISOString()})`);
            throw new httpErrors.Unauthorized("Account scaduto.");
        }

        // L'ultimo cancello, e l'unico che la persona può aprire da sola. Ha un
        // codice suo perché le credenziali sono **giuste**: «username o password
        // non validi» sarebbe una bugia, e «account disabilitato» manderebbe a
        // cercare un amministratore che non c'entra nulla. La cosa da fare è
        // premere il tasto nell'email — o farsene rimandare una.
        if (!user.emailVerifiedAt) {
            Log.warn(`[${AuthService.name}][login][${user.id}] login negato: indirizzo mai confermato`);
            throw domainError(
                DomainErrorCode.EMAIL_NOT_CONFIRMED,
                "Devi prima confermare il tuo indirizzo email: trovi il link nel messaggio che ti abbiamo mandato.",
                403,
            );
        }

        Log.info(`[${AuthService.name}][login][${user.id}] login consentito`);
    }

    /** Riceve il payload del token (§3.1), non la riga utente: ne usa il solo `id`. */
    async getProfile(user: { id: number }) {
        const unReadNotification = await this.logService.findMany({
            isNotification: true,
            recipients: {
                array_contains: [
                    { userId: user.id, isRead: false }
                ]
            }
        });
        // `dancerProfile.avatarFile` serve alla testata del sito pubblico: il
        // ritratto della persona è il modo in cui riconosce di essere entrata
        // con il proprio account. Senza, ogni pagina dovrebbe chiedere il
        // profilo da ballerino con una seconda richiesta, per un dato che
        // questa risposta ha già sottomano.
        const populatedUser = await this.userService.findById(user.id, {
            populate: "person.contact roles dancerProfile.avatarFile",
        })

        // `password` non arriva più fin qui: il client Prisma la omette a livello
        // globale (§3.1, `initializePrismaClient`). La riga resta come difesa in
        // profondità, non come correzione puntuale.
        return {
            ...populatedUser,
            unReadNotificationLen: unReadNotification?.length,
            password: undefined,
        };
    }
}

/**
 * Il ruolo `GOD`, **attivo**. Il flag `isActive` non è un dettaglio: un ruolo
 * disattivato è un ruolo revocato, e leggerlo come concesso trasformerebbe la
 * chiave d'emergenza in una porta lasciata socchiusa.
 */
function isGod(user: AuthenticatedUser): boolean {
    return (user.roles ?? []).some(role => role.roleName === "GOD" && role.isActive);
}
