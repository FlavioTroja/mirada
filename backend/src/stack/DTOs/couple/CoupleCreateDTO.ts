import { z } from "zod";
import { CoupleOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * §4.10 — la coppia **non punta alle iscrizioni**: sono le `Registration` a
 * puntare alla coppia con `coupleId`, così il grafo resta aciclico. Il DTO porta
 * quindi l'evento e, facoltativamente, le due iscrizioni da legare, che il
 * servizio aggiorna verificando che i ruoli assegnati siano complementari.
 */
export const CoupleCreateSchema = withoutMetadata(CoupleOptionalDefaultsSchema)
    .omit({ dissolvedAt: true })
    .extend({
        registrationIds: z.number().int().array().length(2).optional()
            .describe("Le due iscrizioni da legare: ruoli assegnati complementari"),
    });

export type CoupleCreateDTO = z.infer<typeof CoupleCreateSchema>;
