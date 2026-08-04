import { z } from "zod";
import { RequirementOutcomePartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * §4.10 — l'`Update` porta la **decisione di revisione** (`status`,
 * `rejectionReason`) e il valore dichiarato, nulla più.
 *
 * `reviewedByUserId` e `reviewedAt` sono stampati dal servizio quando lo stato
 * passa a `VALID` o `REJECTED`: chi ha deciso e quando non è un dato che il
 * client possa affermare su se stesso. Stessa ragione per `acceptedAt`,
 * `acceptedIp` e `acceptedVersion` (`RF-REQ-4`).
 *
 * `registrationId` ed `eventRequirementId` sono fuori: cambiarli non sarebbe un
 * aggiornamento, sarebbe un altro esito.
 */
export const RequirementOutcomeUpdateSchema = withoutMetadata(RequirementOutcomePartialSchema)
    .omit({
        registrationId: true,
        eventRequirementId: true,
        acceptedAt: true,
        acceptedIp: true,
        acceptedVersion: true,
        reviewedByUserId: true,
        reviewedAt: true,
    });

export type RequirementOutcomeUpdateDTO = z.infer<typeof RequirementOutcomeUpdateSchema>;
