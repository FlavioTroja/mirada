import { z } from "zod";
import { SalesChannelOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * Collegare un negozio — fase E.
 *
 * ── I segreti entrano in chiaro ed escono cifrati ───────────────────────────
 * `credentials` e `webhookSecret` **non** sono la colonna: la colonna contiene
 * una busta AES-256-GCM, e la cifratura la fa il servizio. Qui arrivano i valori
 * come l'organizzatore li incolla dal pannello del negozio, e non escono mai più
 * da nessuna rotta di lettura.
 *
 * ── `publicId` non si accetta dal client ────────────────────────────────────
 * È il segmento in URL del webhook e lo genera il server. Un client che potesse
 * sceglierlo potrebbe indovinare o rivendicare quello di un altro, e il webhook
 * di un'organizzazione finirebbe a bussare alla porta di un'altra.
 *
 * ── `lastReconciledAt` nemmeno ─────────────────────────────────────────────
 * È lo stato della passata di riconciliazione. Scriverlo da fuori significa
 * spostare indietro l'orizzonte e farsi rileggere tutto lo storico, o spostarlo
 * avanti e saltare le vendite che stanno in mezzo.
 */
export const SalesChannelCreateSchema = withoutMetadata(SalesChannelOptionalDefaultsSchema)
    .omit({ publicId: true, lastReconciledAt: true })
    .extend({
        /**
         * Il token di amministrazione dell'app *custom* del negozio (`shpat_…`).
         * Facoltativo: senza, il canale riceve i webhook ma **non** può
         * riconciliare — non ha come chiedere al negozio cosa si è perso.
         */
        credentials: z.string().min(1).optional(),
        /** Il segreto con cui il negozio firma le notifiche. */
        webhookSecret: z.string().min(1),
    });

export type SalesChannelCreateDTO = z.infer<typeof SalesChannelCreateSchema>;
