import { configureServiceTest } from "fastify-decorators/testing";
import { TicketQrService } from "@services/TicketQrService";
import { importPublicKeyFromBase64, JwsError, verifyCompactJws } from "@utils/helpers/jws";
import { generateKeyPairSync, KeyObject } from "node:crypto";
import { signCompactJws } from "@utils/helpers/jws";

/**
 * # La firma del QR — assunzione `AS-7`, §4.12
 *
 * Tre proprietà, e nessuna è formale.
 *
 * 1. **Un QR valido si verifica con la sola chiave pubblica.** È la condizione
 *    che rende possibile il check-in **senza rete**: in sala non c'è campo, e il
 *    telefono ha soltanto ciò che il manifest gli ha dato. Qui la verifica è
 *    fatta con una chiave importata da zero dal materiale pubblico, senza
 *    toccare il servizio che ha firmato.
 * 2. **Un QR manomesso è rifiutato.** Un QR non firmato — o firmato male — è un
 *    QR falsificabile con uno screenshot.
 * 3. **Un `keyId` sconosciuto è rifiutato**, mai riprovato con la chiave
 *    corrente: altrimenti la rotazione smetterebbe di significare qualcosa.
 */
describe("TicketQrService — firma Ed25519 e verifica offline (AS-7)", () => {
    let qr: TicketQrService;

    const ticket = {
        id: 4242,
        eventId: 7,
        code: "ABCDEF0123456789",
        qrIssuedAt: new Date("2026-08-01T10:00:00.000Z"),
    };

    beforeAll(async () => {
        qr = await configureServiceTest({ service: TicketQrService });
    });

    it("un QR valido si verifica con la SOLA chiave pubblica del manifest, senza rete", () => {
        const token = qr.issueToken(ticket);
        const material = qr.publicKey();

        // Questa è la parte che conta: la chiave viene ricostruita dal materiale
        // che il manifest distribuisce, esattamente come farebbe il dispositivo
        // dopo averla letta da IndexedDB. Nessun accesso al servizio, nessuna
        // chiave privata, nessuna rete.
        const publicKey = importPublicKeyFromBase64(material.spki);
        const { header, payload } = verifyCompactJws<{ ticketId: number; eventId: number; code: string; keyId: string }>(
            token,
            keyId => (keyId === material.keyId ? publicKey : null),
        );

        expect(header.alg).toBe("EdDSA");
        expect(header.kid).toBe(material.keyId);
        expect(payload.ticketId).toBe(ticket.id);
        expect(payload.eventId).toBe(ticket.eventId);
        expect(payload.code).toBe(ticket.code);
        expect(payload.keyId).toBe(material.keyId);
    });

    it("il materiale pubblico è distribuibile in due forme, entrambe importabili offline", () => {
        const material = qr.publicKey();
        expect(material.algorithm).toBe("Ed25519");
        expect(material.spki.length).toBeGreaterThan(0);
        expect(material.jwk).toEqual({ kty: "OKP", crv: "Ed25519", x: expect.any(String) });
        expect(() => importPublicKeyFromBase64(material.spki)).not.toThrow();
    });

    it("un QR MANOMESSO è rifiutato: il payload alterato non corrisponde più alla firma", () => {
        const token = qr.issueToken(ticket);
        const [header, payload, signature] = token.split(".");

        // Si riscrive il payload conservando header e firma: è precisamente
        // l'attacco dello screenshot ritoccato.
        const forged = JSON.parse(Buffer.from(payload!, "base64url").toString("utf8"));
        forged.ticketId = 9999;
        forged.code = "CODICE-FALSO";
        const tampered = `${header}.${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${signature}`;

        const verification = qr.verifyToken(tampered);
        expect(verification.verified).toBe(false);
        expect(verification.verified === false && verification.reason).toBe("INVALID_SIGNATURE");
    });

    it("un `keyId` SCONOSCIUTO è rifiutato, mai riprovato con la chiave corrente", () => {
        // Un QR firmato con un'altra chiave e un `kid` che non conosciamo: è il
        // caso della rotazione, e il caso dell'attaccante che porta la propria.
        const foreign: KeyObject = generateKeyPairSync("ed25519").privateKey;
        const token = signCompactJws(
            { ticketId: ticket.id, eventId: ticket.eventId, code: ticket.code, issuedAt: "x", keyId: "chiave-mai-vista" },
            foreign,
            "chiave-mai-vista",
        );

        const verification = qr.verifyToken(token);
        expect(verification.verified).toBe(false);
        expect(verification.verified === false && verification.reason).toBe("UNKNOWN_KEY_ID");
    });

    it("una firma valida ma di una chiave estranea con `kid` NOTO resta rifiutata", () => {
        // Stesso `kid` di quello in servizio, chiave diversa: la firma non regge.
        const material = qr.publicKey();
        const foreign = generateKeyPairSync("ed25519").privateKey;
        const token = signCompactJws({ ticketId: 1, eventId: 1, code: "X", issuedAt: "x", keyId: material.keyId }, foreign, material.keyId);

        const verification = qr.verifyToken(token);
        expect(verification.verified).toBe(false);
        expect(verification.verified === false && verification.reason).toBe("INVALID_SIGNATURE");
    });

    it("una stringa che non è un JWS è rifiutata come malformata, non accettata «per sicurezza»", () => {
        const verification = qr.verifyToken("non-un-jws");
        expect(verification.verified).toBe(false);
        expect(verification.verified === false && verification.reason).toBe("MALFORMED");
    });

    it("`resolveCode` distingue il codice nudo dal QR: il primo non ha firma da verificare", () => {
        const bare = qr.resolveCode("ABCDEF0123456789");
        expect(bare.code).toBe("ABCDEF0123456789");
        // Alla ricerca manuale non c'è alcun QR: pretendere una firma renderebbe
        // impossibile l'unica strada che resta quando la fotocamera non legge.
        expect(bare.verification).toBeNull();

        const scanned = qr.resolveCode(qr.issueToken(ticket));
        expect(scanned.code).toBe(ticket.code);
        expect(scanned.verification?.verified).toBe(true);
    });

    it("il codice generato è unico e non indovinabile", () => {
        const codes = new Set(Array.from({ length: 500 }, () => qr.generateCode()));
        expect(codes.size).toBe(500);
        expect([...codes][0]).toMatch(/^[0-9A-F]{32}$/);
    });

    it("l'header di un JWS con algoritmo diverso da EdDSA è rifiutato", () => {
        const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT", kid: "k1" })).toString("base64url");
        const payload = Buffer.from(JSON.stringify({ ticketId: 1 })).toString("base64url");
        const verification = qr.verifyToken(`${header}.${payload}.`);
        expect(verification.verified).toBe(false);
        expect(verification.verified === false && verification.reason).toBe("UNSUPPORTED_ALGORITHM");
    });

    it("`JwsError` porta il motivo, così l'operatore distingue un tentativo da una rotazione", () => {
        expect(() => verifyCompactJws("a.b", () => null)).toThrow(JwsError);
    });
});
