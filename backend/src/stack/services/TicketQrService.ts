import { Service } from "fastify-decorators";
import { Ticket } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { Log } from "@utils/adapters/log";
import {
    JwsError,
    looksLikeCompactJws,
    signCompactJws,
    verifyCompactJws,
} from "@utils/helpers/jws";
import {
    currentQrKeyId,
    qrPrivateKey,
    qrPublicKeyMaterial,
    QrPublicKeyMaterial,
    resolveQrPublicKey,
} from "@utils/adapters/qrSigningKey";

/**
 * Il payload firmato che il QR contiene — backend-brief §4.12, assunzione `AS-7`.
 * Il §4.12 chiede «almeno `{ ticketId, eventId, issuedAt, keyId }`»; `code` è
 * aggiunto perché è **ciò che il dispositivo cerca nella lista locale** e ciò che
 * `POST /tickets/verify` riceve: senza, il telefono offline dovrebbe risolvere un
 * id in un codice, cioè fare esattamente la cosa che offline non può fare.
 */
export type TicketQrPayload = {
    ticketId: number;
    eventId: number;
    code: string;
    issuedAt: string;
    keyId: string;
};

export type QrVerification =
    | { verified: true; keyId: string; payload: TicketQrPayload }
    | { verified: false; keyId: string | null; reason: string; message: string };

/**
 * # Firma e verifica del QR
 *
 * **Ed25519 in JWS compatto** (assunzione `AS-7`). Tre fatti che questo servizio
 * esiste per garantire:
 *
 * 1. **Un QR non firmato è un QR falsificabile con uno screenshot.** Non esiste
 *    una variante «semplificata» del requisito: il payload è firmato, sempre.
 * 2. **La verifica deve funzionare senza rete.** Per questo la chiave pubblica
 *    viaggia con `GET /events/:id/checkin-manifest` e finisce in IndexedDB: in
 *    sala non c'è campo, e il dispositivo deve poter dire da solo se un QR è
 *    autentico. Questo servizio verifica **anche lato server**, perché la stessa
 *    firma vale online.
 * 3. **`keyId` esiste per la rotazione**, e un `keyId` sconosciuto è un
 *    **rifiuto**: mai un secondo tentativo con la chiave corrente, o la rotazione
 *    smetterebbe di significare qualcosa.
 *
 * ── Perché il `code` del biglietto non è il JWS ──────────────────────────────
 * `Ticket.code` è un codice breve, unico, leggibile: è la colonna «codice» di
 * `/tickets`, quella che l'operatore digita nella ricerca manuale quando il
 * telefono non legge il QR. Il JWS è il **contenuto del QR**, calcolato da quel
 * codice al momento del bisogno. Il trasferimento cambia il codice, e il QR
 * precedente smette di risolvere: non serve una lista di revoche.
 */
@Service()
export class TicketQrService {
    /** 16 byte esadecimali: 32 caratteri, collisione fuori scala e nessuna ambiguità di lettura. */
    private static readonly CODE_BYTES = 16;

    /** Un codice biglietto nuovo. Unico nel database per vincolo di tabella. */
    public generateCode(): string {
        return randomBytes(TicketQrService.CODE_BYTES).toString("hex").toUpperCase();
    }

    /** Il contenuto del QR di un biglietto: JWS compatto firmato Ed25519. */
    public issueToken(ticket: Pick<Ticket, "id" | "eventId" | "code" | "qrIssuedAt">): string {
        const payload: TicketQrPayload = {
            ticketId: ticket.id,
            eventId: ticket.eventId,
            code: ticket.code,
            issuedAt: ticket.qrIssuedAt.toISOString(),
            keyId: currentQrKeyId(),
        };
        return signCompactJws(payload, qrPrivateKey(), currentQrKeyId());
    }

    /** Firma un contenuto qualunque con la chiave dei QR — la usa il manifest (`RF-CHK-3`). */
    public sign(payload: Record<string, unknown>): { keyId: string; value: string } {
        const keyId = currentQrKeyId();
        return { keyId, value: signCompactJws(payload, qrPrivateKey(), keyId) };
    }

    /** Il materiale pubblico distribuito con il manifest, per la verifica offline. */
    public publicKey(): QrPublicKeyMaterial {
        return qrPublicKeyMaterial();
    }

    public looksLikeToken(value: string): boolean {
        return looksLikeCompactJws(value);
    }

    /**
     * Verifica la firma e restituisce il payload.
     *
     * Non lancia: la verifica di un QR è un **esito da mostrare**, non
     * un'eccezione. Un QR manomesso e un `keyId` sconosciuto sono due rifiuti
     * distinti, e l'operatore deve poterli distinguere — il primo è un tentativo,
     * il secondo è quasi sempre una lista scaricata prima di una rotazione.
     */
    public verifyToken(token: string): QrVerification {
        try {
            const { header, payload } = verifyCompactJws<TicketQrPayload>(token, keyId => resolveQrPublicKey(keyId));
            return { verified: true, keyId: header.kid, payload };
        } catch (err) {
            if (err instanceof JwsError) {
                Log.warn(`[TicketQr Service]: QR rejected — ${err.reason}: ${err.message}`);
                return {
                    verified: false,
                    keyId: null,
                    reason: err.reason,
                    message: this.messageFor(err.reason),
                };
            }
            Log.error(`[TicketQr Service]: unexpected QR verification failure: ${(err as Error).message}`);
            return {
                verified: false,
                keyId: null,
                reason: "MALFORMED",
                message: "Codice QR non leggibile.",
            };
        }
    }

    /**
     * Estrae il codice biglietto da ciò che il dispositivo ha inviato: il codice
     * nudo, oppure il JWS letto dal QR — **verificandone la firma**.
     *
     * `verification` è nullo quando il valore era già un codice: alla ricerca
     * manuale non c'è alcun QR da verificare, e pretenderla renderebbe
     * impossibile la sola strada che resta quando la fotocamera non legge.
     */
    public resolveCode(value: string): { code: string | null; verification: QrVerification | null } {
        if (!this.looksLikeToken(value)) {
            return { code: value.trim(), verification: null };
        }

        const verification = this.verifyToken(value.trim());
        if (!verification.verified) {
            return { code: null, verification };
        }
        return { code: verification.payload.code, verification };
    }

    private messageFor(reason: string): string {
        switch (reason) {
            case "UNKNOWN_KEY_ID":
                return "Il QR è firmato con una chiave che questo evento non riconosce. Riscarica la lista di check-in.";
            case "INVALID_SIGNATURE":
                return "Firma del QR non valida: il codice è stato alterato.";
            case "UNSUPPORTED_ALGORITHM":
                return "Il QR usa un algoritmo di firma non ammesso.";
            default:
                return "Codice QR non leggibile.";
        }
    }
}
