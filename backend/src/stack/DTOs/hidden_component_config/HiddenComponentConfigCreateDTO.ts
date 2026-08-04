import { HiddenComponentConfigSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { RoleName } from "@prisma/client";
import { z } from "zod";

export const HiddenComponentConfigCreateSchema = withoutMetadata(
    HiddenComponentConfigSchema
        .omit({ roleName: true })
        .extend({ roles: z.enum(RoleName).array() })
);

export type HiddenComponentConfigCreateDTO = z.infer<typeof HiddenComponentConfigCreateSchema>;