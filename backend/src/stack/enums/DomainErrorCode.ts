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
}
