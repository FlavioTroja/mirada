import { Service } from "fastify-decorators";
import QRCode from "qrcode";
import { Log } from "@utils/adapters/log";
import { InlineImage } from "@mail/ports/Mailer";

/**
 * **Disegna il QR di un biglietto come immagine da incorporare nell'email.**
 *
 * ── Cosa ci finisce dentro ───────────────────────────────────────────────────
 * Il **token firmato** (`TicketQrService.issueToken`), non il codice del
 * biglietto. È la differenza fra un QR e un codice a barre qualunque: il token è
 * un JWS Ed25519 che l'app di check-in verifica **offline**, con la sola chiave
 * pubblica scaricata nel manifest. Un QR che contenesse il solo codice
 * costringerebbe l'operatore a interrogare il server per ogni persona alla
 * porta — e la sera di una milonga, in una sala con il telefono a una tacca, è
 * esattamente la cosa che non deve servire.
 *
 * ── Le scelte di disegno, che non sono estetiche ─────────────────────────────
 * · **Correzione d'errore `M`** (~15%). Il QR verrà letto da uno schermo di
 *   telefono, spesso storto, spesso con un dito sopra un angolo e con la
 *   luminosità al minimo per risparmiare batteria. `L` sarebbe più compatto ma
 *   cede al primo riflesso; `H` regge di più ma infittisce i moduli, e su un
 *   token lungo il disegno diventa così denso che lo scanner fatica lo stesso.
 * · **Fondo bianco, moduli neri.** Un lettore ottico legge il contrasto: il QR è
 *   l'unico riquadro dell'email che non segue la palette del prodotto, e la
 *   ragione è che deve funzionare, non intonarsi.
 * · **Margine 2 moduli.** Lo standard ne chiede 4; 2 è il minimo che i lettori
 *   moderni accettano e tiene l'immagine compatta in un'email. Toglierlo del
 *   tutto è l'errore classico che rende un QR illeggibile.
 */
@Service()
export class QrImageService {
    /**
     * L'immagine PNG del token, pronta da allegare.
     *
     * **Non lancia.** Restituisce `null` se il disegno fallisce: l'email di
     * conferma deve partire comunque, con il solo codice in chiaro. Un biglietto
     * senza QR si usa ancora — l'operatore digita il codice — mentre un'email
     * non spedita non si usa affatto.
     */
    public async ticketQr(ticketId: number, token: string): Promise<InlineImage | null> {
        try {
            const content = await QRCode.toBuffer(token, {
                type: "png",
                errorCorrectionLevel: "M",
                margin: 2,
                // 360px per un'immagine mostrata a 180: su uno schermo a densità
                // doppia — cioè ogni telefono — un PNG alla dimensione esatta
                // arriva sfocato, e un QR sfocato è un QR che non si legge.
                width: 360,
                color: { dark: "#000000FF", light: "#FFFFFFFF" },
            });

            return {
                cid: `ticket-${ticketId}@mirada.dance`,
                filename: `biglietto-${ticketId}.png`,
                content,
                contentType: "image/png",
            };
        } catch (err) {
            Log.error(`[QrImage Service]: failed to render QR for ticket (id ${ticketId}): ${(err as Error).message}`);
            return null;
        }
    }
}
