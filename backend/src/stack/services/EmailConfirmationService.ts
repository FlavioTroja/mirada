import { Service } from "fastify-decorators";
import { User } from "@prisma/client";
import { UserRepository } from "@repositories/UserRepository";
import { EventRepository } from "@repositories/EventRepository";
import { readI18nText } from "@utils/helpers/i18nText";
import { MailService } from "@mail/MailService";
import { Log } from "@utils/adapters/log";
import { domainError } from "@utils/helpers/domainError";
import { DomainErrorCode } from "@enums/DomainErrorCode";
import {
    EMAIL_TOKEN_TTL_SECONDS,
    signEmailToken,
    verifyEmailToken,
} from "@utils/helpers/emailToken";

/**
 * Utente con l'indirizzo raggiungibile — è tutto ciò che serve qui.
 *
 * Il nome di battesimo sta in `person.name`, **non** in `person.firstName`: la
 * prima stesura usava il secondo, che non esiste, e la ricaduta sullo username
 * scattava sempre. Il risultato erano email che davano del «Benvenuto,
 * giulia1786976137» a una persona che si chiama Giulia.
 */
type UserWithEmail = User & { person?: { name?: string; contact?: { email?: string } } };

/**
 * L'utente com'è richiesto per **firmare un token di sessione**: i ruoli sono
 * obbligatori, perché `AuthService.toTokenPayload` li mette nel payload e senza
 * di essi la persona entrerebbe autenticata ma priva di ogni permesso.
 */
type UserWithRoles = UserWithEmail & { roles?: { roleName: string; isActive: boolean }[] };

export interface ConfirmationOutcome {
    /**
     * Popolato **dei ruoli**: chi chiama deve poter firmare subito il token di
     * sessione. Il senso della conferma è che il clic porti dentro, non che
     * riporti a un modulo d'accesso da compilare di nuovo.
     */
    user: UserWithRoles;
    /** True se questo clic ha confermato ora; false se era già confermato prima. */
    justConfirmed: boolean;
    /** Lo slug dell'evento da cui era partita l'iscrizione, se c'era. */
    next?: string;
}

/**
 * **Il percorso «conferma il tuo indirizzo»**, dall'emissione del link al clic.
 *
 * ── Perché la conferma esiste ────────────────────────────────────────────────
 * Su questa piattaforma il biglietto **è** l'email: il QR d'ingresso arriva lì e
 * da nessun'altra parte. Un account creato su un indirizzo digitato male non è
 * un account con un dato sbagliato, è un biglietto pagato che non raggiungerà
 * mai nessuno — e ce ne si accorge alla porta, la sera dell'evento, quando non
 * c'è più niente da fare.
 *
 * ── Perché blocca *prima* della prenotazione ─────────────────────────────────
 * Il fermo posti dura quindici minuti. Se la conferma stesse **dopo** la
 * prenotazione, quei quindici minuti scorrerebbero mentre la persona cerca
 * l'email nella casella: chi la trova tardi perde il posto che credeva di avere,
 * e l'attrito si trasformerebbe in una prenotazione persa invece che in un
 * minuto d'attesa. Confermando prima, l'orologio parte quando l'indirizzo è già
 * dimostrato e nulla corre contro nulla.
 *
 * ── Cosa NON fa ──────────────────────────────────────────────────────────────
 * Non crea account e non prenota nulla: riceve un utente già scritto e ne
 * valorizza `emailVerifiedAt`. La creazione resta di `UserService.register`.
 */
@Service()
export class EmailConfirmationService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly eventRepository: EventRepository,
        private readonly mailService: MailService,
    ) {}

    /**
     * Il titolo dell'evento, letto **dal database a partire dallo slug**.
     *
     * Non lo si accetta dal client, per quanto sarebbe più comodo: quel testo
     * finisce dentro un'email che parte dai nostri server, con il nostro
     * mittente autenticato SPF/DKIM. Un titolo di provenienza esterna
     * significherebbe che chiunque può far recapitare la frase che vuole con la
     * credibilità del nostro dominio — cioè regalare a un estraneo il pezzo più
     * difficile di una truffa via email.
     *
     * Uno slug sconosciuto non è un errore: l'email si scrive lo stesso, solo
     * senza il nome dell'evento.
     */
    private async titleForSlug(slug?: string | null): Promise<string | null> {
        if (!slug) return null;
        const event = await this.eventRepository.findOne({ slug, deleted: false });
        if (!event) {
            Log.warn(`[EmailConfirmation Service]: unknown event slug '${slug}' — the mail will omit the title`);
            return null;
        }
        return readI18nText(event.title) ?? event.slug;
    }

    /** Ore di validità del link, per scriverlo nel testo dell'email. */
    private get validForHours(): number {
        return Math.round(EMAIL_TOKEN_TTL_SECONDS / 3600);
    }

    /**
     * Il segreto della firma.
     *
     * È lo stesso `JWT_SECRET` dei token di sessione — non per pigrizia, ma
     * perché entrambi sono verificati **da questo server e basta**: aggiungere
     * una seconda variabile d'ambiente significherebbe un altro segreto da
     * distribuire e da ruotare, senza separare nulla che sia davvero separato.
     * Lo `purpose` dentro il gettone impedisce comunque che un gettone di
     * conferma valga come token di sessione, e viceversa.
     */
    private get secret(): string {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            // Qui si lancia davvero: senza segreto non si può firmare nulla, e
            // fingere di aver mandato l'email sarebbe peggio che fermarsi.
            throw new Error("JWT_SECRET non impostato: impossibile firmare il link di conferma.");
        }
        return secret;
    }

    /** Il sito pubblico su cui atterra il link. */
    private publicUrl(): string {
        return (process.env.PUBLIC_URL ?? "https://mirada.dance").replace(/\/+$/, "");
    }

    /**
     * Compone il link e spedisce l'email. Restituisce se è **partita davvero**:
     * chi chiama deve poter dire «controlla la posta» solo quando è vero.
     */
    public async sendConfirmation(
        /**
         * Basta l'identificativo: è l'unica cosa che finisce nel gettone. Un
         * parametro più largo costringerebbe ogni chiamante a procurarsi una
         * riga popolata che qui non servirebbe a niente.
         */
        user: { id: number },
        email: string,
        firstName: string,
        context?: { eventSlug?: string | null },
    ): Promise<boolean> {
        const eventTitle = await this.titleForSlug(context?.eventSlug);

        const token = signEmailToken(
            {
                purpose: "EMAIL_CONFIRMATION",
                userId: user.id,
                email,
                ...(context?.eventSlug ? { next: context.eventSlug } : {}),
            },
            this.secret,
        );

        const confirmUrl = `${this.publicUrl()}/conferma-email?token=${encodeURIComponent(token)}`;

        Log.info(
            `[EmailConfirmation Service]: sending confirmation link to '${email}' for user (id ${user.id})`
            + `${context?.eventSlug ? ` — returning to event '${context.eventSlug}'` : ""}`,
        );

        const sent = await this.mailService.sendEmailConfirmation(email, {
            firstName,
            confirmUrl,
            eventTitle,
            validForHours: this.validForHours,
        });

        if (!sent) {
            Log.error(
                `[EmailConfirmation Service]: confirmation mail to '${email}' (user id ${user.id}) was NOT delivered `
                + "— the account cannot be used until it is",
            );
        }
        return sent;
    }

    /**
     * Verifica il gettone e segna l'indirizzo come confermato.
     *
     * **Idempotente**: un secondo clic sullo stesso link non è un errore. Le
     * email si inoltrano, si aprono due volte, si cliccano dal telefono e poi
     * dal computer; rispondere «link non valido» a chi ha solo ricliccato lo
     * manderebbe a chiedere assistenza per un'operazione perfettamente riuscita.
     */
    public async confirm(token: string): Promise<ConfirmationOutcome> {
        const result = verifyEmailToken(token, this.secret, "EMAIL_CONFIRMATION");

        if (!result.ok) {
            // Le ragioni si distinguono perché le vie d'uscita sono diverse: uno
            // scaduto si rimanda, un link manomesso no.
            Log.warn(`[EmailConfirmation Service]: confirmation refused — token ${result.reason}`);
            if (result.reason === "EXPIRED") {
                throw domainError(
                    DomainErrorCode.EMAIL_NOT_CONFIRMED,
                    "Il link di conferma è scaduto. Chiedine uno nuovo: bastano pochi secondi.",
                    410,
                );
            }
            throw domainError(
                DomainErrorCode.EMAIL_NOT_CONFIRMED,
                "Questo link di conferma non è valido. Chiedine uno nuovo dalla pagina d'iscrizione.",
                400,
            );
        }

        const { userId, email, next } = result.payload;

        const user = (await this.userRepository.findById(userId, {
            populate: "person person.contact roles",
        })) as UserWithRoles | null;

        if (!user || user.deleted) {
            Log.warn(`[EmailConfirmation Service]: confirmation refused — user (id ${userId}) not found or deleted`);
            throw domainError(
                DomainErrorCode.EMAIL_NOT_CONFIRMED,
                "Questo link non corrisponde più a nessun account.",
                400,
            );
        }

        // L'indirizzo attuale deve essere ancora quello che il gettone conferma.
        // Se nel frattempo è cambiato, questo link proverebbe il possesso di una
        // casella che non è più quella dell'account.
        const currentEmail = user.person?.contact?.email?.trim().toLowerCase();
        if (currentEmail !== email) {
            Log.warn(
                `[EmailConfirmation Service]: confirmation refused for user (id ${userId}) `
                + "— the address changed after the link was issued",
            );
            throw domainError(
                DomainErrorCode.EMAIL_NOT_CONFIRMED,
                "L'indirizzo dell'account è cambiato dopo l'invio di questo link. Chiedine uno nuovo.",
                409,
            );
        }

        if (user.emailVerifiedAt) {
            Log.info(`[EmailConfirmation Service]: user (id ${userId}) was already confirmed — nothing to do`);
            return { user, justConfirmed: false, ...(next ? { next } : {}) };
        }

        const confirmedAt = new Date();
        await this.userRepository.update({ id: userId }, { emailVerifiedAt: confirmedAt });
        Log.info(`[EmailConfirmation Service]: email confirmed for user '${user.username}' (id ${userId})`);

        // Il benvenuto sta **qui** e non alla registrazione: prima della conferma
        // l'account non serve a niente, e due email nello stesso minuto — «conferma»
        // e «benvenuto» — si annullerebbero a vicenda nella casella di chi legge.
        await this.mailService.sendWelcome(email, {
            firstName: user.person?.name ?? user.username,
            username: user.username,
        });

        // Si restituisce l'oggetto già letto — ruoli compresi — con la data
        // aggiornata, invece del ritorno di `update`: quello porta la riga nuda,
        // e senza ruoli il token firmato subito dopo lascerebbe la persona
        // autenticata ma senza alcun permesso.
        return {
            user: { ...user, emailVerifiedAt: confirmedAt },
            justConfirmed: true,
            ...(next ? { next } : {}),
        };
    }

    /**
     * Rimanda il link.
     *
     * **Risponde sempre allo stesso modo**, che l'indirizzo esista o no. È la
     * sola difesa contro l'uso di questa rotta come oracolo: senza, chiunque
     * potrebbe provare una lista di indirizzi e leggere dalla risposta quali
     * sono iscritti a Mirada — e a un evento di ballo la lista dei partecipanti
     * è un dato personale, non un dettaglio tecnico.
     */
    public async resend(email: string, eventSlug?: string | null): Promise<void> {
        const normalized = email.trim().toLowerCase();

        const user = (await this.userRepository.findOne(
            { deleted: false, person: { contact: { email: normalized } } },
            { populate: "person person.contact" },
        )) as UserWithEmail | null;

        if (!user) {
            Log.info(`[EmailConfirmation Service]: resend requested for unknown address — answering as if sent`);
            return;
        }
        if (user.emailVerifiedAt) {
            Log.info(`[EmailConfirmation Service]: resend requested for already-confirmed user (id ${user.id}) — not sent`);
            return;
        }

        await this.sendConfirmation(
            user,
            normalized,
            user.person?.name ?? user.username,
            { eventSlug: eventSlug ?? null },
        );
    }
}
