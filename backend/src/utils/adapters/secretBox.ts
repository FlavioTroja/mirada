import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Log } from "@utils/adapters/log";

/**
 * La cassaforte dei segreti di terze parti — fase E, canali di vendita esterni.
 *
 * Adapter e non helper, per la stessa ragione di `qrSigningKey`: tiene stato di
 * processo (la chiave caricata) e legge l'ambiente.
 *
 * ── Perché esiste ────────────────────────────────────────────────────────────
 * Un token di amministrazione Shopify non legge «i biglietti»: legge **ordini,
 * anagrafiche e contatti di tutto il negozio**, e vale finché l'organizzatore non
 * lo revoca. In chiaro in una colonna, una copia del database — un dump di
 * ripristino, un backup su S3, una `SELECT` di diagnosi incollata in chat —
 * diventa una copia dei negozi di tutti i clienti. Cifrato, quella stessa copia
 * non vale nulla senza `SECRET_BOX_KEY`, che nel database non c'è.
 *
 * ── AES-256-GCM, non AES-CBC ────────────────────────────────────────────────
 * GCM è autenticato: il tag di autenticazione fa fallire la decifratura se il
 * testo cifrato è stato toccato. Serve davvero, perché ciò che esce di qui
 * finisce dentro l'intestazione `X-Shopify-Access-Token` di una richiesta in
 * uscita: un valore alterato in silenzio è una richiesta fatta a nome di
 * qualcun altro.
 *
 * ── L'IV è per messaggio, e sta nella busta ─────────────────────────────────
 * Con GCM riusare l'IV sulla stessa chiave non indebolisce un messaggio: li
 * rompe **tutti e due**. Dodici byte casuali per ogni cifratura, trasportati in
 * chiaro nella busta — l'IV non è un segreto, la sua unicità sì.
 *
 * Formato della busta: `v1.<iv>.<tag>.<ciphertext>`, tutto in base64url. Il
 * prefisso di versione esiste perché il giorno della rotazione dell'algoritmo si
 * deve poter leggere ciò che è stato scritto ieri.
 */

const ENVELOPE_VERSION = "v1";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

let key: Buffer | null = null;
let ephemeral = false;

function loadKey(): Buffer {
    if (key) {
        return key;
    }

    const configured = process.env.SECRET_BOX_KEY?.trim();

    if (configured) {
        const material = Buffer.from(configured, "base64");
        if (material.length !== KEY_LENGTH) {
            // Fallire al primo uso è preferibile a cifrare con una chiave
            // troncata: il danno non si vede finché non si prova a rileggere.
            Log.error(
                `[SecretBox Adapter]: SECRET_BOX_KEY decodes to ${material.length} byte(s), ${KEY_LENGTH} required — `
                + "generate one with `openssl rand -base64 32`",
            );
            throw new Error("SECRET_BOX_KEY must be 32 bytes, base64 encoded.");
        }
        key = material;
        Log.info("[SecretBox Adapter]: AES-256-GCM key loaded from the environment");
        return key;
    }

    key = randomBytes(KEY_LENGTH);
    ephemeral = true;
    Log.warn(
        "[SecretBox Adapter]: SECRET_BOX_KEY is not set — an EPHEMERAL key was generated. Every secret sealed now "
        + "becomes UNREADABLE after a restart, and the sales channels using them will have to be reconnected. "
        + "Set the variable in .env before connecting anything that matters.",
    );
    return key;
}

/** Cifra un segreto. Il risultato è la stringa da salvare in colonna. */
export function seal(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv("aes-256-gcm", loadKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [
        ENVELOPE_VERSION,
        iv.toString("base64url"),
        tag.toString("base64url"),
        ciphertext.toString("base64url"),
    ].join(".");
}

/**
 * Decifra una busta prodotta da `seal`. **Solleva** su busta malformata, chiave
 * sbagliata o testo alterato: un segreto che non si riesce a leggere non deve
 * mai degradare in stringa vuota, che diventerebbe una richiesta senza
 * credenziali e un `401` incomprensibile a chilometri da qui.
 */
export function open(envelope: string): string {
    const parts = envelope.split(".");
    if (parts.length !== 4 || parts[0] !== ENVELOPE_VERSION) {
        Log.error(`[SecretBox Adapter]: malformed envelope — expected '${ENVELOPE_VERSION}.<iv>.<tag>.<ciphertext>'`);
        throw new Error("Malformed secret envelope.");
    }

    const [, ivPart, tagPart, ciphertextPart] = parts as [string, string, string, string];

    try {
        const decipher = createDecipheriv("aes-256-gcm", loadKey(), Buffer.from(ivPart, "base64url"));
        decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
        return Buffer.concat([
            decipher.update(Buffer.from(ciphertextPart, "base64url")),
            decipher.final(),
        ]).toString("utf8");
    } catch (err) {
        // Il messaggio non riporta MAI il testo cifrato né la chiave.
        Log.error(`[SecretBox Adapter]: decryption failed — wrong key or tampered envelope: ${(err as Error).message}`);
        throw new Error("Secret could not be decrypted.");
    }
}

/** True quando la chiave in uso è stata generata al volo e non sopravvive al riavvio. */
export function isSecretBoxKeyEphemeral(): boolean {
    loadKey();
    return ephemeral;
}

/** Solo per i test: forza il ricaricamento dall'ambiente. */
export function resetSecretBoxCache(): void {
    key = null;
    ephemeral = false;
}
