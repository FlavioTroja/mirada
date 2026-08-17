/**
 * Codici di dominio stabili — backend-brief §3.3.
 *
 * Il frontend **deve** poterli distinguere perché hanno significati opposti
 * (`RF-PAY-17`): `SOLD_OUT` è definitivo, `ROLE_ON_HOLD` si può sbloccare.
 * L'elenco è chiuso e identico nei due brief; in fase B ne sono lanciati due
 * (`PAYOUT_NOT_ENABLED`, `SALES_CLOSED`), gli altri appartengono al motore di
 * capienza e al checkout.
 */
export enum DomainErrorCode {
    SOLD_OUT = "SOLD_OUT",
    ROLE_ON_HOLD = "ROLE_ON_HOLD",
    PARTIAL_AVAILABILITY = "PARTIAL_AVAILABILITY",
    RESERVATION_EXPIRED = "RESERVATION_EXPIRED",
    RESERVATION_ALREADY_ACTIVE = "RESERVATION_ALREADY_ACTIVE",
    SALES_CLOSED = "SALES_CLOSED",
    PAYOUT_NOT_ENABLED = "PAYOUT_NOT_ENABLED",

    // ── Identità: i tre esiti che il form d'iscrizione deve saper distinguere ──
    // Prima erano tutti e tre un `400 BadRequest` con una frase italiana diversa,
    // e il sito li mostrava allo stesso modo: un riquadro rosso dentro la scheda
    // «Crea un account». Chi aveva già un account leggeva «Email già in uso» e
    // restava fermo lì, perché nulla gli diceva che la cosa da fare era
    // **accedere**. Un codice stabile è ciò che permette all'interfaccia di
    // proporre l'azione giusta invece del testo dell'errore.

    /** L'email appartiene già a un account: la via d'uscita è l'accesso, non un altro indirizzo. */
    EMAIL_ALREADY_REGISTERED = "EMAIL_ALREADY_REGISTERED",
    /** Il nome utente è occupato: qui invece la via d'uscita è davvero cambiarlo. */
    USERNAME_TAKEN = "USERNAME_TAKEN",
    /** Credenziali giuste, ma l'indirizzo non è mai stato confermato: si offre di rimandare l'email. */
    EMAIL_NOT_CONFIRMED = "EMAIL_NOT_CONFIRMED",
}
