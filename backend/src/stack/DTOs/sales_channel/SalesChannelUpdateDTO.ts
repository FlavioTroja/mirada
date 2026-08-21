import { z } from "zod";
import { SalesChannelPartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * Solo scalari della propria riga — regola 11 di `controllers.md`.
 *
 * Fuori: `organizationId` e `provider` (l'identità del canale: cambiarli non è
 * una modifica, è un altro canale, e lascerebbe le vendite già registrate
 * agganciate a un negozio che non è quello da cui sono arrivate), `publicId` e
 * `lastReconciledAt` (governati dal server, vedi il DTO di creazione).
 *
 * I segreti si possono **sostituire** — un token si revoca e se ne genera un
 * altro — e il servizio li ricifra. Restano fuori da ogni lettura.
 */
export const SalesChannelUpdateSchema = withoutMetadata(SalesChannelPartialSchema)
    .omit({ organizationId: true, provider: true, publicId: true, lastReconciledAt: true })
    .extend({
        credentials: z.string().min(1).optional(),
        webhookSecret: z.string().min(1).optional(),
    });

export type SalesChannelUpdateDTO = z.infer<typeof SalesChannelUpdateSchema>;
