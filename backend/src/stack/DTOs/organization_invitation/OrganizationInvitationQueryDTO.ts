import { z } from "zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

/** Filtri di `POST /organization-invitations/`. */
export const OrganizationInvitationQuerySchema = z.object({
    organizationId: z.number().int().positive().optional(),
    email: z.string().optional(),
    /** Solo quelli ancora spendibili: né accettati, né revocati, né scaduti. */
    soloAperti: z.boolean().optional(),
});

export type OrganizationInvitationQueryDTO = z.infer<typeof OrganizationInvitationQuerySchema>;

export const OrganizationInvitationPaginateBodyInputSchema = paginateSchema(OrganizationInvitationQuerySchema);
export type OrganizationInvitationPaginateDTO = z.infer<typeof OrganizationInvitationPaginateBodyInputSchema>;
