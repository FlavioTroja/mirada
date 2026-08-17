/**
 * **La porta d'uscita della posta** — backend → mondo, mai il contrario.
 *
 * Il codice di dominio dipende da questa astrazione e **non** da `nodemailer`,
 * esattamente come dipende da `EventPublisher` e non dalla libreria `ws`. Il
 * giorno in cui si passerà a Resend o a SendGrid cambia un solo adattatore: i
 * servizi che spediscono non sanno né devono sapere come la posta esce.
 *
 * Dichiarata come `abstract class` e non come semplice interfaccia perché così
 * sopravvive a runtime come tipo iniettabile — stesso schema di
 * `@websocket/ports/EventPublisher`.
 */

/** Le lingue dei modelli (`RF-COM-6`). */
export type MailLocale = "it" | "en";

/**
 * Un messaggio pronto per la spedizione.
 *
 * `text` non è un ripiego per client antiquati: è la parte che i filtri
 * antispam leggono per capire se il messaggio è legittimo, ed è l'unica che
 * arriva intatta a chi usa un lettore di schermo o un client che blocca l'HTML.
 * Un'email transazionale senza corpo testuale parte già svantaggiata.
 */
/**
 * Un'immagine **incorporata** nel messaggio e richiamata dall'HTML con
 * `src="cid:<cid>"`.
 *
 * È l'unico modo perché un QR si veda. Le tre alternative non funzionano:
 *  · `<img src="https://…">` — quasi tutti i client bloccano le immagini remote
 *    finché l'utente non le sblocca, e un biglietto va mostrato alla porta, non
 *    sbloccato;
 *  · `data:` URI — Gmail li rimuove del tutto;
 *  · un allegato normale — si scarica, non si mostra nel corpo.
 *
 * L'allegato incorporato non è però una garanzia: qualche client lo blocca lo
 * stesso. Per questo il **codice resta scritto in chiaro** accanto al QR, e
 * l'operatore può digitarlo — è la ragione per cui `RF-CHK` prevede la ricerca
 * manuale accanto alla scansione.
 */
export interface InlineImage {
    /** Identificativo richiamato nell'HTML come `cid:<cid>`. */
    cid: string;
    /** Nome del file, quello che l'utente vede se apre l'allegato. */
    filename: string;
    content: Buffer;
    contentType: string;
}

export interface OutgoingMail {
    to: string;
    subject: string;
    html: string;
    text: string;
    /** Nome leggibile del destinatario, quando lo si conosce. */
    toName?: string;
    /** Immagini incorporate — oggi solo i QR dei biglietti. */
    inlineImages?: InlineImage[];
}

/** Esito della spedizione. **Non si lancia mai**: si riferisce. */
export interface MailOutcome {
    sent: boolean;
    /** Identificativo del messaggio, quando il trasporto lo restituisce. */
    messageId?: string;
    /** Il motivo, quando `sent` è falso. Serve al registro, non all'utente. */
    error?: string;
}

export abstract class Mailer {
    /**
     * Spedisce un messaggio.
     *
     * **Non lancia mai.** Un'email è sempre la conseguenza di un fatto già
     * avvenuto e già scritto — un'iscrizione confermata, un biglietto emesso —
     * e nessun problema di posta può annullare quel fatto a posteriori. Il
     * fallimento si registra e si va avanti.
     */
    abstract send(mail: OutgoingMail): Promise<MailOutcome>;

    /** Come si descrive il trasporto nei log: «SMTP smtp.example.com:587», «solo log». */
    abstract describe(): string;
}
