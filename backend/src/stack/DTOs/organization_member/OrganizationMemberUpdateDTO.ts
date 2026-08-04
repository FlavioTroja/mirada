import { z } from "zod";
import { OrganizationMemberPartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/** Solo scalari della propria riga — regola 11 di controllers.md. */
export const OrganizationMemberUpdateSchema = withoutMetadata(
    OrganizationMemberPartialSchema.omit({ invitedAt: true }),
);

export type OrganizationMemberUpdateDTO = z.infer<typeof OrganizationMemberUpdateSchema>;
