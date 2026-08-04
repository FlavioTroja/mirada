import { z } from "zod";
import { OrganizationSchema } from "@prisma-gen/zod";

export const OrganizationResponseSchema = OrganizationSchema;
export type OrganizationResponseDTO = z.infer<typeof OrganizationResponseSchema>;

/** Payload di `GET /organizations/:id/payout-status` (§3.7, `RF-ORG-12`). */
export const OrganizationPayoutStatusResponseSchema = OrganizationSchema.pick({
    id: true,
    stripeAccountId: true,
    payoutStatus: true,
    payoutCheckedAt: true,
});
export type OrganizationPayoutStatusResponseDTO = z.infer<typeof OrganizationPayoutStatusResponseSchema>;
