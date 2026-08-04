import { createPrivateKey, createPublicKey, KeyObject, sign, verify } from "node:crypto";

/**
 * JWS compatto firmato **Ed25519** — backend-brief §4.12, assunzione `AS-7`.
 *
 * Funzioni **pure**: nessun I/O, nessuno stato. La chiave arriva dal chiamante
 * (`@utils/adapters/qrSigningKey`), che è l'unico posto in cui vive il segreto.
 *
 * ── Perché a mano e non con una libreria ─────────────────────────────────────
 * Un JWS compatto con `alg: EdDSA` è
 * `base64url(header).base64url(payload).base64url(signature)` e nulla più; Node
 * 22 firma e verifica Ed25519 nativamente con `crypto.sign` / `crypto.verify`.
 * Aggiungere una dipendenza per concatenare tre stringhe significherebbe
 * introdurre una superficie di aggiornamento su un percorso di sicurezza che qui
 * si legge per intero in trenta righe.
 *
 * ── Perché firmato, e non «semplificato» ─────────────────────────────────────
 * Un QR non firmato è un QR falsificabile con uno screenshot. La verifica deve
 * inoltre funzionare **senza rete**, e per questo il payload porta il `keyId`: la
 * chiave pubblica viaggia con il manifest di check-in e il dispositivo deve poter
 * dire *quale* chiave usare, anche dopo una rotazione.
 */

/** Header protetto di un JWS Ed25519. `kid` è obbligatorio: senza, la rotazione non è verificabile. */
export type JwsHeader = {
    alg: "EdDSA";
    typ: "JWT";
    kid: string;
};

export class JwsError extends Error {
    constructor(message: string, public readonly reason: JwsFailureReason) {
        super(message);
        this.name = "JwsError";
    }
}

export type JwsFailureReason =
    /** Non è un JWS compatto: numero di segmenti diverso da tre, o base64url non decodificabile. */
    | "MALFORMED"
    /** L'header dichiara un algoritmo diverso da `EdDSA`. */
    | "UNSUPPORTED_ALGORITHM"
    /** L'header non porta un `kid`, oppure porta un `kid` che non conosciamo. */
    | "UNKNOWN_KEY_ID"
    /** La firma non corrisponde al contenuto: payload manomesso o chiave sbagliata. */
    | "INVALID_SIGNATURE";

function toBase64Url(input: Buffer | string): string {
    return Buffer.from(input).toString("base64url");
}

function fromBase64Url(input: string): Buffer {
    return Buffer.from(input, "base64url");
}

/**
 * Firma il payload e restituisce il JWS compatto.
 *
 * @param payload  oggetto serializzabile — per il QR almeno
 *                 `{ ticketId, eventId, issuedAt, keyId }` (§4.12)
 * @param keyId    finisce sia nell'header (`kid`) sia, per comodità di lettura
 *                 offline, nel payload
 */
export function signCompactJws(
    payload: Record<string, unknown>,
    privateKey: KeyObject,
    keyId: string,
): string {
    const header: JwsHeader = { alg: "EdDSA", typ: "JWT", kid: keyId };
    const signingInput = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`;
    // Ed25519 firma il messaggio integrale: l'algoritmo di digest è `null` per
    // specifica (RFC 8032), non un'omissione.
    const signature = sign(null, Buffer.from(signingInput, "utf8"), privateKey);
    return `${signingInput}.${toBase64Url(signature)}`;
}

/** Legge l'header senza verificare nulla — serve solo a scegliere la chiave dal `kid`. */
export function decodeJwsHeader(token: string): JwsHeader {
    const segments = token.split(".");
    if (segments.length !== 3) {
        throw new JwsError("Il codice non è un JWS compatto.", "MALFORMED");
    }
    let header: JwsHeader;
    try {
        header = JSON.parse(fromBase64Url(segments[0]!).toString("utf8")) as JwsHeader;
    } catch {
        throw new JwsError("Header del QR illeggibile.", "MALFORMED");
    }
    if (header?.alg !== "EdDSA") {
        throw new JwsError(`Algoritmo di firma non supportato: ${header?.alg}.`, "UNSUPPORTED_ALGORITHM");
    }
    if (!header.kid) {
        throw new JwsError("Il QR non dichiara alcun identificativo di chiave.", "UNKNOWN_KEY_ID");
    }
    return header;
}

/**
 * Verifica la firma e restituisce il payload.
 *
 * `resolveKey` riceve il `kid` dell'header e restituisce la chiave pubblica
 * corrispondente, oppure `null` se quel `kid` non è noto: **un `keyId`
 * sconosciuto è un rifiuto**, mai un tentativo con la chiave corrente.
 */
export function verifyCompactJws<T = Record<string, unknown>>(
    token: string,
    resolveKey: (keyId: string) => KeyObject | null,
): { header: JwsHeader; payload: T } {
    const header = decodeJwsHeader(token);

    const publicKey = resolveKey(header.kid);
    if (!publicKey) {
        throw new JwsError(`Chiave di firma sconosciuta: '${header.kid}'.`, "UNKNOWN_KEY_ID");
    }

    const segments = token.split(".");
    const signingInput = `${segments[0]}.${segments[1]}`;
    const signature = fromBase64Url(segments[2]!);

    const ok = verify(null, Buffer.from(signingInput, "utf8"), publicKey, signature);
    if (!ok) {
        throw new JwsError("Firma del QR non valida.", "INVALID_SIGNATURE");
    }

    let payload: T;
    try {
        payload = JSON.parse(fromBase64Url(segments[1]!).toString("utf8")) as T;
    } catch {
        throw new JwsError("Payload del QR illeggibile.", "MALFORMED");
    }

    return { header, payload };
}

/** True quando la stringa ha la forma di un JWS compatto (tre segmenti separati da punto). */
export function looksLikeCompactJws(value: string): boolean {
    return value.split(".").length === 3;
}

/** Chiave privata Ed25519 da PKCS#8 DER codificato base64. */
export function importPrivateKeyFromBase64(base64: string): KeyObject {
    return createPrivateKey({ key: Buffer.from(base64, "base64"), format: "der", type: "pkcs8" });
}

/** Chiave pubblica Ed25519 da SPKI DER codificato base64 — è ciò che il manifest distribuisce. */
export function importPublicKeyFromBase64(base64: string): KeyObject {
    return createPublicKey({ key: Buffer.from(base64, "base64"), format: "der", type: "spki" });
}

/** SPKI DER in base64 — la forma che `crypto.subtle.importKey("spki", …)` accetta nel browser. */
export function exportPublicKeySpki(publicKey: KeyObject): string {
    return publicKey.export({ type: "spki", format: "der" }).toString("base64");
}

/** JWK OKP/Ed25519 — la forma che le librerie JOSE accettano per la verifica offline. */
export function exportPublicKeyJwk(publicKey: KeyObject): { kty: "OKP"; crv: "Ed25519"; x: string } {
    const jwk = publicKey.export({ format: "jwk" }) as { kty?: string; crv?: string; x?: string };
    return { kty: "OKP", crv: "Ed25519", x: jwk.x ?? "" };
}
