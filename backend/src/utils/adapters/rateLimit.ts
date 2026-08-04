import { FastifyReply, FastifyRequest } from "fastify";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";

/**
 * Rate limiting a finestra fissa per gli endpoint pubblici anonimi — §5 e §7 D-H.
 *
 * `POST /api/public/events/:id/availability` è **la sorgente del polling a
 * 10–15 s** di ogni visitatore della scheda evento, e in apertura vendite è
 * l'endpoint più interrogato del sistema. Senza un tetto, un client con un
 * intervallo sbagliato — o un solo scraper — basta a saturare il pool di
 * connessioni proprio nel minuto in cui si vendono i biglietti.
 *
 * ── LIMITE DICHIARATO DI QUESTA IMPLEMENTAZIONE ──────────────────────────────
 * Il §5 prescrive rate limiting **su Redis**. Redis **non è ancora nel progetto**:
 * non c'è client fra le dipendenze, non c'è servizio in `docker compose`, non c'è
 * configurazione. Questo contatore è quindi **in processo**: corretto e
 * verificabile con una sola istanza, ma con N istanze dietro un bilanciatore il
 * limite effettivo diventa N volte quello configurato.
 *
 * È deliberatamente un adattatore con una superficie minima
 * (`consume(key) → boolean`): sostituirlo con `INCR`+`EXPIRE` su Redis, quando
 * Redis arriverà, tocca questo file soltanto. La stessa scelta vale per il lock
 * distribuito dello scheduler (§7 D-L), che appartiene alla fase successiva.
 */

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

/** Pulizia pigra: senza, la mappa cresce con ogni indirizzo mai visto. */
function sweep(now: number): void {
    if (buckets.size < 10_000) {
        return;
    }
    for (const [key, window] of buckets) {
        if (window.resetAt <= now) {
            buckets.delete(key);
        }
    }
}

export type RateLimitOptions = {
    /** Richieste ammesse nella finestra. */
    max: number;
    /** Ampiezza della finestra in millisecondi. */
    windowMs: number;
    /** Nome della rotta, per non far competere endpoint diversi sullo stesso secchio. */
    name: string;
};

/** Consuma un gettone. `false` = limite superato. */
export function consumeToken(key: string, options: RateLimitOptions): boolean {
    const now = Date.now();
    sweep(now);

    const bucketKey = `${options.name}:${key}`;
    const window = buckets.get(bucketKey);

    if (!window || window.resetAt <= now) {
        buckets.set(bucketKey, { count: 1, resetAt: now + options.windowMs });
        return true;
    }

    window.count += 1;
    return window.count <= options.max;
}

/** Azzera i contatori — isolamento fra test. */
export function resetRateLimits(): void {
    buckets.clear();
}

/**
 * Hook `onRequest` da montare sulle rotte pubbliche anonime. La chiave è
 * l'indirizzo del chiamante: non c'è un utente autenticato da cui partire, ed è
 * esattamente il caso che il §3.9 descrive («il visitatore anonimo non ha
 * WebSocket»).
 */
export function rateLimit(options: RateLimitOptions) {
    return async function rateLimitHook(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
        const key = req.ip || "unknown";
        if (consumeToken(key, options)) {
            return;
        }

        Log.warn(
            `[RateLimit Middleware]: '${options.name}' throttled '${key}' — more than ${options.max} `
            + `request(s) in ${options.windowMs}ms`,
        );
        throw new httpErrors.TooManyRequests(
            "Troppe richieste in poco tempo. Riprova fra qualche secondo.",
        );
    };
}
