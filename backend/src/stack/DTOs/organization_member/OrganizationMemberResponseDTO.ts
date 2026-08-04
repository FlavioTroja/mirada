import { z } from "zod";
import { OrganizationMemberSchema } from "@prisma-gen/zod";

export const OrganizationMemberResponseSchema = OrganizationMemberSchema;
export type OrganizationMemberResponseDTO = z.infer<typeof OrganizationMemberResponseSchema>;
