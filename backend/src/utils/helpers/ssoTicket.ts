import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * **La prova d'identità che sopravvive al codice OIDC già speso.**
 *
 * Serve a un momento preciso: qualcuno si è autenticato su Authentik, il
 * backend ha verificato il suo `id_token`, ma su mirada non esiste ancora
 * nessuna utenza. La persona deve ora compilare un modulo — aprire
 * un'organizzazione, oppure accettare un invito — e solo dopo l'account nasce.
 *
 * Il problema è che a quel punto **il codice di autorizzazione è consumato**:
 * è monouso, e lo abbiamo già scambiato. Rifare tutto il giro OIDC alla
 * conferma del modulo sarebbe fragile e sposterebbe la persona fuori dalla
 * pagina che sta compilando. E l'alternativa peggiore sarebbe far rimandare al
 * client `sub` ed email che gli abbiamo appena detto noi: sarebbe fidarsi del
 * browser su **chi è** la persona, cioè non verificare affatto.
 *
 * Il biglietto risolve la cosa portando quei dati **firmati da noi**, per pochi
 * minuti.
 *
 * ── ⚠️ Perché NON è un JWT ───────────────────────────────────────────────────
 * Sarebbe stato più comodo firmarlo con `reply.jwtSign`. Sarebbe stato anche il
 * modo di fabbricare un gettone che `Authenticate()` — che si limita a
 * `req.jwtVerify()` — accetterebbe come **sessione valida**. Un biglietto di
 * registrazione diventerebbe una chiave d'accesso.
 *
 * La difesa non è un controllo in più da ricordarsi: è la **forma**. Questo
 * gettone è `corpo.firma` in base64url, non ha la struttura di un JWT, e
 * `jwtVerify` lo rifiuta senza che nessuno debba averci pensato. È la stessa
 * scelta di `@utils/helpers/emailToken`, per la stessa ragione.
 *
 * ── Perché così corto ────────────────────────────────────────────────────────
 * Quindici minuti: il tempo di compilare un modulo di due campi. Non è un
 * gettone che deve sopravvivere in una casella di posta — nasce e muore dentro
 * la stessa visita.
 */

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

function hmac(data: string, secret: string): Buffer {
    return createHmac("sha256", secret).update(data).digest();
}

/** Quindici minuti: il tempo di compilare un modulo di due campi. */
export const SSO_TICKET_TTL_SECONDS = 15 * 60;

export interface SsoTicketPayload {
    /** Elenco chiuso di uno: un gettone vale su un solo percorso. */
    purpose: "SSO_SIGNUP";
    /** Il `sub` verificato del fornitore di identità. È l'unico dato che conta. */
    sub: string;
    email: string;
    /** Il nome dichiarato dal fornitore, se c'è: si usa per precompilare. */
    name?: string;
    /** Scadenza, epoch in **secondi**. */
    exp: number;
}

export type SsoTicketResult =
    | { ok: true; payload: SsoTicketPayload }
    | { ok: false; reason: "MALFORMED" | "INVALID_SIGNATURE" | "EXPIRED" };

export function signSsoTicket(
    payload: Omit<SsoTicketPayload, "exp" | "purpose">,
    secret: string,
    ttlSeconds: number = SSO_TICKET_TTL_SECONDS,
): string {
    const full: SsoTicketPayload = {
        ...payload,
        purpose: "SSO_SIGNUP",
        email: payload.email.trim().toLowerCase(),
        exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    };
    const body = b64url(JSON.stringify(full));
    return `${body}.${b64url(hmac(body, secret))}`;
}

export function verifySsoTicket(ticket: string, secret: string): SsoTicketResult {
    const segments = ticket.split(".");
    if (segments.length !== 2 || !segments[0] || !segments[1]) {
        return { ok: false, reason: "MALFORMED" };
    }

    const [body, signature] = segments as [string, string];

    const expected = hmac(body, secret);
    const provided = Buffer.from(signature, "base64url");
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
        return { ok: false, reason: "INVALID_SIGNATURE" };
    }

    let payload: SsoTicketPayload;
    try {
        payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SsoTicketPayload;
    } catch {
        return { ok: false, reason: "MALFORMED" };
    }

    // Lo scopo si controlla **dopo** la firma: prima della verifica il contenuto
    // è testo che ci ha mandato un estraneo.
    if (payload?.purpose !== "SSO_SIGNUP" || typeof payload.sub !== "string" || typeof payload.email !== "string") {
        return { ok: false, reason: "MALFORMED" };
    }
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) {
        return { ok: false, reason: "EXPIRED" };
    }

    return { ok: true, payload };
}
