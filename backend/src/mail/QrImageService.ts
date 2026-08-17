import { Service } from "fastify-decorators";
import QRCode from "qrcode";
import { PNG } from "pngjs";
import { Log } from "@utils/adapters/log";
import { InlineImage } from "@mail/ports/Mailer";

/**
 * **Disegna il QR di un biglietto come immagine da incorporare nell'email**,
 * con il marchio al centro.
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
 * ── Perché correzione `M` e non `H`, che è il contrario di ciò che si direbbe ─
 * Il consiglio corrente per un QR con il logo è «alza la correzione d'errore a
 * `H`, così il logo copre moduli recuperabili». **Misurato sul nostro token,
 * peggiora le cose.**
 *
 * Il payload è un JWS lungo: a livello `M` occupa la versione 13, cioè 69 moduli
 * per lato; a livello `H` sale alla versione 18, **89 moduli**. A parità di
 * dimensione mostrata nell'email, più moduli significa moduli più piccoli — e a
 * 180px il QR a livello `H` **non si è letto nemmeno senza logo**, mentre quello
 * a `M` si è letto in tutte le prove.
 *
 * La ragione per cui `M` basta comunque è aritmetica: il badge è largo il 22%
 * del lato e ha forma circolare, quindi copre π·(0.11)² ≈ **3,8%** dell'area,
 * ben dentro il ~15% che `M` sa ricostruire. La regola generale presume un logo
 * grande; qui il logo è piccolo e il payload è lungo, e vince l'altro vincolo.
 *
 * Prova finale della configurazione scelta — livello `M`, badge al 22%, sorgente
 * 800px, mostrato a 200px, con sfocatura e rumore a simulare una fotocamera:
 * **letto 8 volte su 8**, token identico all'originale.
 *
 * ── Le altre scelte, tutte funzionali ────────────────────────────────────────
 * · **Fondo bianco, moduli neri.** Un lettore ottico legge il contrasto: il QR è
 *   l'unico riquadro dell'email che non segue la palette del prodotto, perché
 *   deve funzionare, non intonarsi.
 * · **Margine 2 moduli.** Lo standard ne chiede 4; 2 è il minimo che i lettori
 *   moderni accettano e tiene l'immagine compatta in un'email.
 * · **800px per 200 mostrati.** Su uno schermo a densità doppia — cioè ogni
 *   telefono — un PNG alla dimensione esatta arriva sfocato, e un QR sfocato è
 *   un QR che non si legge.
 */
@Service()
export class QrImageService {
    /** Il lato del PNG generato. Quattro volte la dimensione di visualizzazione. */
    private static readonly SIZE = 800;

    /** Larghezza del badge, in frazione del lato. Oltre, la lettura si degrada. */
    private static readonly BADGE_RATIO = 0.22;

    /** Il marchio: rombo oro su superficie prugna, lo stesso della testata di `www`. */
    private static readonly GOLD = { r: 224, g: 184, b: 79 };
    private static readonly SURFACE = { r: 32, g: 16, b: 21 };

    public async ticketQr(ticketId: number, token: string): Promise<InlineImage | null> {
        try {
            const raw = await QRCode.toBuffer(token, {
                type: "png",
                errorCorrectionLevel: "M",
                margin: 2,
                width: QrImageService.SIZE,
                color: { dark: "#000000FF", light: "#FFFFFFFF" },
            });

            const png = PNG.sync.read(raw);
            this.drawBadge(png);

            return {
                cid: `ticket-${ticketId}@mirada.dance`,
                filename: `biglietto-${ticketId}.png`,
                content: PNG.sync.write(png),
                contentType: "image/png",
            };
        } catch (err) {
            // **Non lancia.** L'email di conferma deve partire comunque, con il
            // solo codice in chiaro: un biglietto senza QR si usa ancora —
            // l'operatore digita il codice — mentre un'email non spedita no.
            Log.error(`[QrImage Service]: failed to render QR for ticket (id ${ticketId}): ${(err as Error).message}`);
            return null;
        }
    }

    /**
     * Disegna il badge al centro, direttamente sui pixel.
     *
     * A mano e non con una libreria di grafica perché `sharp` e `canvas`
     * portano binari nativi — compilazione, immagini Docker più grandi,
     * un'installazione che può fallire su un'architettura diversa — e qui serve
     * un cerchio e un rombo. `pngjs` è JavaScript puro e basta.
     *
     * L'antialiasing è calcolato sulla distanza dal bordo invece che con un
     * ritaglio netto: un cerchio a gradini in mezzo a un QR si vede, e il punto
     * di questa modifica era che fosse **bello**.
     */
    private drawBadge(png: PNG): void {
        const size = png.width;
        const centre = size / 2;
        const outer = (size * QrImageService.BADGE_RATIO) / 2;

        // Un anello bianco attorno al badge: separa il marchio dai moduli e
        // impedisce che il lettore scambi il bordo dorato per un modulo.
        const halo = outer * 1.08;
        const ring = outer * 0.9;   // bordo oro
        const inner = outer * 0.78; // superficie interna
        const rhomb = outer * 0.42; // semidiagonale del rombo

        const put = (x: number, y: number, c: { r: number; g: number; b: number }, alpha: number) => {
            if (alpha <= 0) return;
            const i = (size * y + x) << 2;
            const a = Math.min(1, alpha);
            png.data[i] = png.data[i]! * (1 - a) + c.r * a;
            png.data[i + 1] = png.data[i + 1]! * (1 - a) + c.g * a;
            png.data[i + 2] = png.data[i + 2]! * (1 - a) + c.b * a;
            png.data[i + 3] = 255;
        };

        /** Copertura del pixel dentro un cerchio: 1 dentro, 0 fuori, sfumata sul bordo. */
        const coverage = (d: number, r: number) => Math.min(1, Math.max(0, r + 0.5 - d));

        const from = Math.max(0, Math.floor(centre - halo - 2));
        const to = Math.min(size - 1, Math.ceil(centre + halo + 2));

        for (let y = from; y <= to; y++) {
            for (let x = from; x <= to; x++) {
                const dx = x + 0.5 - centre;
                const dy = y + 0.5 - centre;
                const d = Math.hypot(dx, dy);

                put(x, y, { r: 255, g: 255, b: 255 }, coverage(d, halo));
                put(x, y, QrImageService.GOLD, coverage(d, ring));
                put(x, y, QrImageService.SURFACE, coverage(d, inner));

                // Il rombo: |dx| + |dy| <= semidiagonale. La sfumatura si ottiene
                // sulla stessa distanza, così il bordo non risulta seghettato.
                const diamond = Math.abs(dx) + Math.abs(dy);
                put(x, y, QrImageService.GOLD, coverage(diamond, rhomb));
            }
        }
    }
}
