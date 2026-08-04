import { z } from "zod";
import { OrganizationPartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * Solo scalari della propria riga (regola 11 di controllers.md).
 * `payoutStatus` e `stripeAccountId` NON sono scrivibili dal client: li aggiorna
 * `OrganizationService.refreshPayoutStatus` leggendo Stripe (§4.2).
 */
export const OrganizationUpdateSchema = withoutMetadata(
    OrganizationPartialSchema.omit({
        stripeAccountId: true,
        payoutStatus: true,
        payoutCheckedAt: true,
    }),
);

export type OrganizationUpdateDTO = z.infer<typeof OrganizationUpdateSchema>;
