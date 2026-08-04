import httpErrors, { HttpError } from "http-errors";
import { DomainErrorCode } from "@enums/DomainErrorCode";

/**
 * Errore di dominio con `code` stabile — backend-brief §3.3.
 *
 * ── Contraddizione template/brief, risolta qui ────────────────────────────────
 * Il gestore di errori del template (`APIServer.setupFastifyConfiguration`)
 * serializza `code: error.statusCode`, cioè un **numero HTTP**. Il §3.3 dichiara
 * invece `{ error: "HttpError", code, message }` con `code` **stringa di dominio**
 * (`SOLD_OUT`, `PAYOUT_NOT_ENABLED`, …), e `RF-PAY-17` impone al frontend di
 * distinguerli. Le due cose non possono essere entrambe vere.
 *
 * La soluzione è additiva e non rompe nulla di preesistente: un `HttpError` che
 * porta `domainCode` viene serializzato con quella stringa, tutti gli altri
 * continuano a esporre lo `statusCode` come prima.
 */
export type DomainHttpError = HttpError & {
    domainCode: DomainErrorCode;
    payload?: Record<string, unknown>;
};

/**
 * @param code    codice del §3.3
 * @param message messaggio all'utente, in italiano
 * @param status  stato HTTP (default `409 Conflict`: è un conflitto con lo stato
 *                corrente della risorsa, non una richiesta malformata)
 * @param payload dati che il codice porta con sé — `SOLD_OUT` e `ROLE_ON_HOLD`
 *                portano sempre `{ scope, scopeId, scopeLabel, role }` (`RF-PAY-16`)
 */
export function domainError(
    code: DomainErrorCode,
    message: string,
    status = 409,
    payload?: Record<string, unknown>,
): DomainHttpError {
    const error = httpErrors(status, message) as DomainHttpError;
    error.domainCode = code;
    if (payload) {
        error.payload = payload;
    }
    return error;
}

/** True quando l'errore porta un codice di dominio del §3.3. */
export function isDomainError(error: unknown): error is DomainHttpError {
    return !!error && typeof (error as DomainHttpError).domainCode === "string";
}
