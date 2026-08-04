import { HttpErrorResponse } from '@angular/common/http';

/**
 * Errori canonici del §3.3.
 *
 *  - Zod            → `400 { error: "ZodError", message, issues: [{ path, code, message }] }`
 *  - `HttpError`    → `{ error: "HttpError", code, message }`
 *  - altro          → `500 { error, message }`
 *
 * I `code` di dominio del motore di capienza NON sono errori generici: hanno un
 * significato che l'interfaccia deve saper distinguere, e in due casi opposto.
 */

/** Codici di dominio del §3.3 — elenco chiuso. */
export const DOMAIN_ERROR_CODES = [
  'SOLD_OUT',
  'ROLE_ON_HOLD',
  'PARTIAL_AVAILABILITY',
  'RESERVATION_EXPIRED',
  'RESERVATION_ALREADY_ACTIVE',
  'SALES_CLOSED',
  'PAYOUT_NOT_ENABLED',
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export function isDomainErrorCode(value: unknown): value is DomainErrorCode {
  return typeof value === 'string' && (DOMAIN_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Payload che `SOLD_OUT` e `ROLE_ON_HOLD` portano sempre (§3.3): serve a
 * **nominare la sessione e il ruolo** (`RF-PAY-16`).
 */
export interface CapacityScope {
  scope?: string;
  scopeId?: number;
  scopeLabel?: string;
  role?: 'LEADER' | 'FOLLOWER';
}

/** Una issue di `ZodError`. `path` va mappato sui campi del form. */
export interface ZodIssue {
  path: (string | number)[];
  code?: string;
  message: string;
}

export type ApiErrorKind =
  /** `HttpError` con un `code` di dominio del §3.3 — lo presenta il componente. */
  | 'domain'
  /** `400 ZodError` — le issue si mappano sui campi del form. */
  | 'validation'
  /**
   * `400 HttpError` — un **vincolo di dominio** con il suo messaggio, non un
   * guasto: l'indirizzo ancora referenziato (§3.4), la colonna non ammessa in
   * esportazione (`RB12`), la pubblicazione rifiutata da `RB13`. Si presenta
   * come la regola che è, mai come «errore».
   */
  | 'constraint'
  /** `401` — nessun refresh token: logout e ritorno al login. */
  | 'unauthorized'
  /** `403` */
  | 'forbidden'
  /** `404` */
  | 'not-found'
  /**
   * `501` — la funzione **esiste nel contratto ma non è ancora producibile**, e
   * il backend ne dichiara il motivo (§3.7, esportazioni). Non è un fallimento:
   * va presentato come tale, mai come «errore» e mai come tracciato vuoto.
   */
  | 'not-implemented'
  /** rete assente / server irraggiungibile */
  | 'network'
  /** tutto il resto */
  | 'server';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    override readonly message: string,
    readonly status: number,
    readonly code?: DomainErrorCode,
    readonly issues: ZodIssue[] = [],
    readonly scope?: CapacityScope,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** `{ campo: messaggio }` costruito da `issues[].path` per il form. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const issue of this.issues) {
      const key = issue.path.join('.');
      if (key && !out[key]) out[key] = issue.message;
    }
    return out;
  }

  get isDomain(): boolean {
    return this.kind === 'domain';
  }
}

interface RawErrorBody {
  error?: string;
  code?: unknown;
  message?: string;
  issues?: ZodIssue[];
  scope?: string;
  scopeId?: number;
  scopeLabel?: string;
  role?: 'LEADER' | 'FOLLOWER';
}

/** Traduce la risposta del backend in un `ApiError` classificato. */
export function parseApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  if (!(err instanceof HttpErrorResponse)) {
    const message = err instanceof Error ? err.message : 'Errore imprevisto.';
    return new ApiError('server', message, 0);
  }

  if (err.status === 0) {
    return new ApiError('network', 'Server non raggiungibile. Verifica la connessione.', 0);
  }

  const body: RawErrorBody = (err.error ?? {}) as RawErrorBody;
  const message = body.message || err.message || 'Errore imprevisto.';

  if (body.error === 'ZodError') {
    return new ApiError(
      'validation',
      'Alcuni campi non sono validi.',
      err.status,
      undefined,
      Array.isArray(body.issues) ? body.issues : [],
    );
  }

  if (isDomainErrorCode(body.code)) {
    return new ApiError('domain', message, err.status, body.code, [], {
      scope: body.scope,
      scopeId: body.scopeId,
      scopeLabel: body.scopeLabel,
      role: body.role,
    });
  }

  if (err.status === 401) return new ApiError('unauthorized', message, 401);
  if (err.status === 403) {
    return new ApiError('forbidden', message || 'Non hai i permessi per questa operazione.', 403);
  }
  if (err.status === 404) return new ApiError('not-found', message, 404);
  if (err.status === 501) return new ApiError('not-implemented', message, 501);
  if (err.status === 400) return new ApiError('constraint', message, 400);

  return new ApiError('server', message, err.status);
}
