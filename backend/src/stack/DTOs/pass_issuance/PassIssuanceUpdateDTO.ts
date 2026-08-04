import { z } from "zod";
import { PassIssuancePartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * §4.12 — dell'emissione resta modificabile la sola **nota**.
 *
 * `quantity`, `ticketTypeId`, `role` e `reason` descrivono un atto già compiuto:
 * cambiarli non correggerebbe l'emissione, la riscriverebbe — e i biglietti già
 * emessi, con i loro consumi di capienza, resterebbero quelli di prima.
 * `revokedAt` è una transizione, non un campo.
 */
export const PassIssuanceUpdateSchema = withoutMetadata(PassIssuancePartialSchema)
    .pick({ note: true });

export type PassIssuanceUpdateDTO = z.infer<typeof PassIssuanceUpdateSchema>;
