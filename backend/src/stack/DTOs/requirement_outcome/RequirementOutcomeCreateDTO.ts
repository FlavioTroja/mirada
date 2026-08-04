import { z } from "zod";
import { RequirementOutcomeOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * §4.10 — `acceptedAt`, `acceptedIp` e `acceptedVersion` **non compaiono**: sono
 * calcolati dal server (`RF-REQ-4`). Sono la prova di *quando* e *da dove* la
 * persona ha accettato, e una prova che il client può scrivere non è una prova.
 *
 * Fuori anche `status` e i campi di revisione: lo stato iniziale discende dal
 * `verification` del requisito — `AUTOMATIC` vale come accettato, `MANUAL` entra
 * in `UNDER_REVIEW` — e la decisione di revisione passa dal `PATCH`, che stampa
 * revisore e momento.
 */
export const RequirementOutcomeCreateSchema = withoutMetadata(RequirementOutcomeOptionalDefaultsSchema)
    .omit({
        status: true,
        acceptedAt: true,
        acceptedIp: true,
        acceptedVersion: true,
        reviewedByUserId: true,
        reviewedAt: true,
        rejectionReason: true,
    });

export type RequirementOutcomeCreateDTO = z.infer<typeof RequirementOutcomeCreateSchema>;
