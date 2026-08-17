import { Service } from "fastify-decorators";
import { Log } from "@utils/adapters/log";
import { InlineImage, MailLocale } from "@mail/ports/Mailer";
import { SmtpMailer } from "@mail/adapters/SmtpMailer";
import {
    ConfirmEmailInput,
    RegistrationConfirmedInput,
    ReservationExpiredInput,
    TicketTransferredInput,
    WelcomeInput,
    confirmEmailMail,
    registrationConfirmedMail,
    reservationExpiredMail,
    ticketTransferredMail,
    welcomeMail,
} from "@mail/templates";

/**
 * **Il servizio che il codice di dominio inietta per spedire** — `RF-COM-1`.
 *
 * Sta fra i servizi di dominio e la porta: sceglie la lingua, compone il
 * modello, chiama il trasporto. I chiamanti non conoscono né i modelli né
 * `nodemailer`; chiamano un metodo che descrive il **fatto** («l'iscrizione è
 * confermata») e non il mezzo.
 *
 * ── Due regole, entrambe non negoziabili ─────────────────────────────────────
 *
 * 1. **Nessun metodo lancia.** Un'email è sempre la conseguenza di un fatto già
 *    scritto e già committato: un'iscrizione confermata, un biglietto emesso,
 *    una prenotazione rilasciata. Se il server di posta è irraggiungibile, quel
 *    fatto resta vero. Far fallire un ordine pagato perché SMTP non risponde
 *    sarebbe il difetto peggiore che questo file possa introdurre.
 *
 * 2. **Si spedisce dopo il commit, mai dentro la transazione.** Identica alla
 *    regola del §3.9 per il WebSocket, e per la stessa ragione rovesciata: una
 *    transazione che rotola indietro dopo l'invio lascerebbe in mano al
 *    ballerino la conferma di un'iscrizione che non esiste. Un'email non si
 *    richiama indietro.
 *
 * ── La lingua (`RF-COM-6`) ───────────────────────────────────────────────────
 * I modelli esistono in italiano e inglese. **Oggi non c'è un campo «lingua
 * preferita»** su `Person` né su `Contact`: la scelta ricade quindi sempre
 * sull'italiano, che è la lingua del primo mercato. Quando il campo esisterà,
 * `localeFor` è l'unico punto da cambiare — ed è per questo che esiste come
 * metodo invece di essere una costante sparsa nei quattro invii.
 */
@Service()
export class MailService {
    constructor(private readonly mailer: SmtpMailer) {}

    /**
     * La lingua del destinatario.
     *
     * Ricaduta dichiarata: **italiano**. Non è una scelta di comodo mascherata
     * da impostazione predefinita — è l'unica onesta finché il dato non c'è, e
     * il commento serve a chi si chiederà perché un ballerino inglese riceve
     * l'italiano.
     */
    private localeFor(_recipientEmail: string): MailLocale {
        return "it";
    }

    /** Benvenuto — spedito **dopo** la conferma dell'indirizzo, non prima (`RF-COM-1`). */
    public async sendWelcome(to: string, input: Omit<WelcomeInput, "locale">): Promise<void> {
        await this.dispatch("welcome", to, input.firstName, () =>
            welcomeMail({ ...input, locale: this.localeFor(to) }),
        );
    }

    /**
     * Conferma dell'indirizzo — **l'unico invio il cui esito il chiamante deve
     * conoscere**, ed è per questo che restituisce un booleano invece di nulla.
     *
     * La regola 1 di questa classe — «nessun metodo lancia, il fatto è già
     * scritto e resta vero» — vale perché le altre email *raccontano* qualcosa
     * che è successo: se non arriva la conferma d'ordine, il biglietto esiste
     * comunque e si recupera dall'area personale.
     *
     * Questa no. Questa **è** il meccanismo: senza, l'account resta inattivo per
     * sempre e la persona non ha nessun'altra strada. Ingoiare il fallimento in
     * silenzio mostrerebbe «controlla la posta» a chi non riceverà mai niente.
     * Continua a non lanciare — un'eccezione lascerebbe l'account creato e la
     * risposta HTTP in errore, che è lo stato peggiore — ma **dice come è andata**,
     * così il sito può proporre subito il rinvio invece di una bugia.
     */
    public async sendEmailConfirmation(
        to: string,
        input: Omit<ConfirmEmailInput, "locale">,
    ): Promise<boolean> {
        return this.dispatch("email-confirmation", to, input.firstName, () =>
            confirmEmailMail({ ...input, locale: this.localeFor(to) }),
        );
    }

    /** Iscrizione confermata con i biglietti — l'email che conta di più. */
    public async sendRegistrationConfirmed(
        to: string,
        input: Omit<RegistrationConfirmedInput, "locale">,
        /** I QR dei biglietti, già disegnati. Il corpo li richiama per `cid`. */
        inlineImages?: InlineImage[],
    ): Promise<void> {
        await this.dispatch(
            "registration-confirmed",
            to,
            input.firstName,
            () => registrationConfirmedMail({ ...input, locale: this.localeFor(to) }),
            inlineImages,
        );
    }

    /** Prenotazione scaduta: dice soprattutto che non è stato addebitato nulla. */
    public async sendReservationExpired(
        to: string,
        input: Omit<ReservationExpiredInput, "locale">,
    ): Promise<void> {
        await this.dispatch("reservation-expired", to, input.firstName, () =>
            reservationExpiredMail({ ...input, locale: this.localeFor(to) }),
        );
    }

    /** Esito del trasferimento del nominativo, a chi riceve e a chi cede. */
    public async sendTicketTransferred(
        to: string,
        input: Omit<TicketTransferredInput, "locale">,
    ): Promise<void> {
        await this.dispatch("ticket-transferred", to, input.firstName, () =>
            ticketTransferredMail({ ...input, locale: this.localeFor(to) }),
        );
    }

    /**
     * Il punto unico in cui si compone e si spedisce — e in cui si assorbe
     * qualunque cedimento.
     *
     * Il `try` avvolge anche la **composizione** e non solo l'invio: un dato
     * mancante che facesse esplodere un modello annullerebbe altrimenti un
     * ordine già pagato, il che sarebbe assurdo per un problema di testo.
     */
    private async dispatch(
        kind: string,
        to: string,
        toName: string,
        compose: () => { subject: string; html: string; text: string },
        inlineImages?: InlineImage[],
    ): Promise<boolean> {
        if (!to) {
            Log.warn(`[Mail Service]: '${kind}' not sent — no recipient address`);
            return false;
        }
        try {
            const mail = compose();
            const outcome = await this.mailer.send({ ...mail, to, toName, inlineImages });
            if (!outcome.sent) {
                Log.warn(`[Mail Service]: '${kind}' to '${to}' was NOT delivered — ${outcome.error}`);
            }
            return outcome.sent;
        } catch (err) {
            Log.error(`[Mail Service]: '${kind}' to '${to}' failed to compose or send: ${(err as Error).message}`);
            return false;
        }
    }
}
