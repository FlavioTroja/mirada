import { createPublicKey, generateKeyPairSync, KeyObject } from "node:crypto";
import { Log } from "@utils/adapters/log";
import {
    exportPublicKeyJwk,
    exportPublicKeySpki,
    importPrivateKeyFromBase64,
} from "@utils/helpers/jws";

/**
 * La chiave di firma dei QR — backend-brief §4.12, assunzione `AS-7`.
 *
 * Adapter, non helper: tiene **stato di processo** (la chiave caricata) e legge
 * l'ambiente. Il segreto vive qui e in nessun altro punto del codice.
 *
 * ── Il contratto con il dispositivo di check-in ──────────────────────────────
 * La verifica del QR deve funzionare **senza rete**, quindi la chiave PUBBLICA
 * viaggia con `GET /events/:id/checkin-manifest` e resta su IndexedDB. Il `keyId`
 * esiste per la rotazione: il manifest scaricato ieri porta la chiave di ieri, e
 * un QR firmato con una chiave che non è più in servizio deve essere rifiutato
 * **con il motivo giusto**, non verificato con la chiave corrente.
 *
 * ── Chiavi ritirate ──────────────────────────────────────────────────────────
 * `QR_SIGNING_RETIRED_KEYS` accetta un elenco `keyId:spkiBase64` separato da
 * virgole. Sono chiavi con cui **non si firma più** ma con cui si **verifica
 * ancora**: senza, il giorno della rotazione ogni biglietto già emesso
 * smetterebbe di aprire la porta.
 */

export type QrPublicKeyMaterial = {
    keyId: string;
    algorithm: "Ed25519";
    /** SPKI DER in base64 — `crypto.subtle.importKey("spki", …)`. */
    spki: string;
    /** JWK OKP — le librerie JOSE. */
    jwk: { kty: "OKP"; crv: "Ed25519"; x: string };
};

type LoadedKeys = {
    keyId: string;
    privateKey: KeyObject;
    publicKey: KeyObject;
    /** Chiave corrente più eventuali chiavi ritirate, per `keyId`. */
    verificationKeys: Map<string, KeyObject>;
    ephemeral: boolean;
};

let loaded: LoadedKeys | null = null;

function load(): LoadedKeys {
    if (loaded) {
        return loaded;
    }

    const keyId = process.env.QR_SIGNING_KEY_ID?.trim() || "k1";
    const secret = process.env.QR_SIGNING_PRIVATE_KEY?.trim();

    let privateKey: KeyObject;
    let ephemeral = false;

    if (secret) {
        try {
            privateKey = importPrivateKeyFromBase64(secret);
        } catch (err) {
            // Fallire in avvio è preferibile a firmare con una chiave a caso: una
            // chiave malformata in produzione significa biglietti che nessun
            // dispositivo può verificare, scoperti la sera dell'evento.
            Log.error(`[QrSigningKey Adapter]: QR_SIGNING_PRIVATE_KEY is not a valid base64 PKCS#8 Ed25519 key: ${(err as Error).message}`);
            throw err;
        }
    } else {
        privateKey = generateKeyPairSync("ed25519").privateKey;
        ephemeral = true;
        Log.warn(
            "[QrSigningKey Adapter]: QR_SIGNING_PRIVATE_KEY is not set — an EPHEMERAL Ed25519 key was generated "
            + `with keyId '${keyId}'. Tickets signed now stop verifying after a restart. Set the variable in .env `
            + "before issuing anything that matters.",
        );
    }

    const publicKey = createPublicKey(privateKey);

    const verificationKeys = new Map<string, KeyObject>([[keyId, publicKey]]);
    for (const entry of (process.env.QR_SIGNING_RETIRED_KEYS ?? "").split(",")) {
        const trimmed = entry.trim();
        if (!trimmed) continue;
        const separator = trimmed.indexOf(":");
        if (separator <= 0) {
            Log.warn(`[QrSigningKey Adapter]: retired key entry '${trimmed}' is not in the 'keyId:spkiBase64' form — ignored`);
            continue;
        }
        const retiredId = trimmed.slice(0, separator);
        const retiredSpki = trimmed.slice(separator + 1);
        try {
            verificationKeys.set(retiredId, createPublicKey({
                key: Buffer.from(retiredSpki, "base64"),
                format: "der",
                type: "spki",
            }));
            Log.info(`[QrSigningKey Adapter]: retired key '${retiredId}' loaded for verification only`);
        } catch (err) {
            Log.error(`[QrSigningKey Adapter]: retired key '${retiredId}' could not be imported: ${(err as Error).message}`);
        }
    }

    Log.info(
        `[QrSigningKey Adapter]: Ed25519 signing key ready (keyId '${keyId}'${ephemeral ? ", EPHEMERAL" : ""}) — `
        + `${verificationKeys.size} key(s) accepted for verification`,
    );

    loaded = { keyId, privateKey, publicKey, verificationKeys, ephemeral };
    return loaded;
}

/** `keyId` della chiave con cui si firma **adesso**. */
export function currentQrKeyId(): string {
    return load().keyId;
}

export function qrPrivateKey(): KeyObject {
    return load().privateKey;
}

/**
 * Risolve la chiave pubblica di un `keyId`. **`null` è un rifiuto**: un `keyId`
 * sconosciuto non deve mai ricadere sulla chiave corrente, o la rotazione
 * smetterebbe di significare qualcosa.
 */
export function resolveQrPublicKey(keyId: string): KeyObject | null {
    return load().verificationKeys.get(keyId) ?? null;
}

/** Il materiale pubblico distribuito con il manifest di check-in (`RF-CHK-3`). */
export function qrPublicKeyMaterial(): QrPublicKeyMaterial {
    const keys = load();
    return {
        keyId: keys.keyId,
        algorithm: "Ed25519",
        spki: exportPublicKeySpki(keys.publicKey),
        jwk: exportPublicKeyJwk(keys.publicKey),
    };
}

/** True quando la chiave in uso è stata generata al volo e non sopravvive al riavvio. */
export function isQrKeyEphemeral(): boolean {
    return load().ephemeral;
}

/** Solo per i test: forza il ricaricamento dall'ambiente. */
export function resetQrSigningKeyCache(): void {
    loaded = null;
}
