import { z } from "zod";
import { RegistrationOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * §4.10 — `assignedRole` **non compare**: è un campo calcolato dal server (§5),
 * risolto dal motore di capienza alla conferma del pagamento. `confirmedAt` e
 * `declinedAt` seguono le transizioni di `confirm` / `decline`, non il client.
 */
export const RegistrationCreateSchema = withoutMetadata(RegistrationOptionalDefaultsSchema)
    .omit({ assignedRole: true, confirmedAt: true, declinedAt: true });

export type RegistrationCreateDTO = z.infer<typeof RegistrationCreateSchema>;
