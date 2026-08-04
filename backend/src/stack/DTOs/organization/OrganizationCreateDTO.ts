import { z } from "zod";
import { OrganizationOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * `stripeAccountId`, `payoutStatus` e `payoutCheckedAt` sono calcolati dal server
 * a partire dalla risposta di Stripe: non compaiono in NESSUN DTO di scrittura
 * (backend-brief §4.2 e §5).
 */
export const OrganizationCreateSchema = withoutMetadata(
    OrganizationOptionalDefaultsSchema.omit({
        stripeAccountId: true,
        payoutStatus: true,
        payoutCheckedAt: true,
    }),
);

export type OrganizationCreateDTO = z.infer<typeof OrganizationCreateSchema>;
