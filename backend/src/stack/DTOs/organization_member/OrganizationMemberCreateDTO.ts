import { z } from "zod";
import { OrganizationMemberOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/** `invitedAt` è il momento dell'invito, registrato dal server. */
export const OrganizationMemberCreateSchema = withoutMetadata(
    OrganizationMemberOptionalDefaultsSchema.omit({
        invitedAt: true,
        acceptedAt: true,
    }),
);

export type OrganizationMemberCreateDTO = z.infer<typeof OrganizationMemberCreateSchema>;
