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
type AuthenticatedUser = User & { roles?: { roleName: string; isActive: boolean }[] };

@Service()
export class AuthService {
    constructor(
        private readonly userService: UserService,
        private readonly logService: LogService
    ) {}

    async login(loginRequestDTO: LoginRequestDTO): Promise<AuthenticatedUser> {
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
     */
    private assertAccountCanLogin(user: User): void {
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
        const populatedUser = await this.userService.findById(user.id, { populate: "person.contact roles" })

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
