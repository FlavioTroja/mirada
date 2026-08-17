import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * **Il gettone che viaggia nel link di conferma dell'email.**
 *
 * Funzioni pure: nessun I/O, nessuno stato, il segreto arriva dal chiamante.
 *
 * ── Perché non riusiamo il JWS del QR ────────────────────────────────────────
 * `@utils/helpers/jws` firma con **Ed25519** e porta un `kid`, perché il QR di
 * un biglietto deve essere verificabile **offline**, da un telefono alla porta
 * che ha la sola chiave pubblica. Qui non c'è niente di tutto questo: a
 * verificare è lo stesso server che ha firmato, un istante di rete più tardi.
 *
 * Riusare quella chiave legherebbe due cose che non hanno ragione di stare
 * insieme — il giorno in cui si ruota la chiave dei QR, tutti i link di conferma
 * ancora nelle caselle di posta smetterebbero di funzionare. Un HMAC sul
 * `JWT_SECRET` che il progetto ha già è la primitiva giusta: nessuna chiave
 * nuova da distribuire, nessun accoppiamento.
 *
 * ── Perché non una riga in tabella ───────────────────────────────────────────
 * Un gettone opaco salvato sull'utente vorrebbe due colonne, una scadenza da
 * spazzare e una scrittura in più a ogni invio. Un gettone firmato non ha
 * bisogno di nulla: porta con sé la scadenza e chi è. L'unicità d'uso non si
 * perde, perché **arriva da altrove** — dal momento in cui `emailVerifiedAt`
 * viene valorizzato: al secondo clic il server risponde «già confermato».
 *
 * ── Cosa il gettone lega, e perché ognuna di queste cose ─────────────────────
 * · `purpose` — un gettone di conferma non deve poter essere speso su un
 *   percorso diverso, se un domani ne nascerà un altro (recupero password).
 *   Senza, due funzioni che condividono il segreto condividono anche i gettoni.
 * · `email` — l'indirizzo **al momento dell'emissione**. Se l'utente cambia
 *   indirizzo, un link vecchio non deve poter confermare quello nuovo:
 *   confermerebbe una casella che nessuno ha mai dimostrato di possedere.
 * · `exp` — un link che vale per sempre è una chiave d'accesso permanente
 *   dimenticata in una casella di posta.
 */

/** Elenco chiuso: un gettone vale su un solo percorso. */
export type EmailTokenPurpose = "EMAIL_CONFIRMATION";

export interface EmailTokenPayload {
    purpose: EmailTokenPurpose;
    userId: number;
    /** L'indirizzo confermato da questo gettone, com'era all'emissione. */
    email: string;
    /** Scadenza, epoch in **secondi**. */
    exp: number;
    /**
     * Dove riportare la persona dopo la conferma — lo slug dell'evento da cui è
     * partita l'iscrizione.
     *
     * Sta **dentro la firma** e non nella query string di proposito: un
     * parametro fuori dalla firma è un parametro che chiunque può riscrivere, e
     * un link di conferma che accetta una destinazione arbitraria è un rimbalzo
     * verso dove vuole chi lo confeziona.
     */
    next?: string;
}

export type EmailTokenFailure =
    /** Non ha la forma `payload.firma`, o il base64url non si decodifica. */
    | "MALFORMED"
    /** La firma non corrisponde: contenuto manomesso, o segreto diverso. */
    | "INVALID_SIGNATURE"
    /** Firma valida ma il gettone è scaduto. */
    | "EXPIRED"
    /** Firma valida ma emesso per un altro percorso. */
    | "WRONG_PURPOSE";

export type EmailTokenResult =
    | { ok: true; payload: EmailTokenPayload }
    | { ok: false; reason: EmailTokenFailure };

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

function hmac(data: string, secret: string): Buffer {
    return createHmac("sha256", secret).update(data).digest();
}

/** Durata di serie: un giorno. Abbastanza per chi legge la posta la sera dopo. */
export const EMAIL_TOKEN_TTL_SECONDS = 24 * 60 * 60;

export function signEmailToken(
    payload: Omit<EmailTokenPayload, "exp">,
    secret: string,
    ttlSeconds: number = EMAIL_TOKEN_TTL_SECONDS,
): string {
    const full: EmailTokenPayload = {
        ...payload,
        email: payload.email.trim().toLowerCase(),
        exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    };
    const body = b64url(JSON.stringify(full));
    return `${body}.${b64url(hmac(body, secret))}`;
}

/**
 * Verifica firma, scadenza e scopo.
 *
 * Restituisce un esito invece di lanciare: il chiamante deve poter dire
 * all'utente cose **diverse** — «il link è scaduto, te ne mando un altro» non è
 * «questo link non è valido», e trattarle allo stesso modo lascerebbe fermo chi
 * ha solo aspettato troppo.
 */
export function verifyEmailToken(
    token: string,
    secret: string,
    purpose: EmailTokenPurpose,
): EmailTokenResult {
    const segments = token.split(".");
    if (segments.length !== 2 || !segments[0] || !segments[1]) {
        return { ok: false, reason: "MALFORMED" };
    }

    const [body, signature] = segments as [string, string];

    const expected = hmac(body, secret);
    const provided = Buffer.from(signature, "base64url");
    // Lunghezze diverse: `timingSafeEqual` lancerebbe. Il confronto è comunque
    // a tempo costante sul caso che conta, cioè due firme della stessa forma.
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
        return { ok: false, reason: "INVALID_SIGNATURE" };
    }

    let payload: EmailTokenPayload;
    try {
        payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as EmailTokenPayload;
    } catch {
        return { ok: false, reason: "MALFORMED" };
    }

    if (typeof payload?.userId !== "number" || typeof payload?.email !== "string") {
        return { ok: false, reason: "MALFORMED" };
    }
    // Lo scopo si controlla **dopo** la firma: prima della verifica il contenuto
    // è testo che ci ha mandato un estraneo, e non merita ancora una risposta
    // che lo distingua.
    if (payload.purpose !== purpose) {
        return { ok: false, reason: "WRONG_PURPOSE" };
    }
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) {
        return { ok: false, reason: "EXPIRED" };
    }

    return { ok: true, payload };
}
