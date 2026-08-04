import { z } from "zod";
import { RequirementTypeOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { I18nTextSchema } from "@utils/helpers/i18nText";

export const RequirementTypeCreateSchema = withoutMetadata(RequirementTypeOptionalDefaultsSchema).extend({
    name: I18nTextSchema,
    configSchema: z.any().optional(),
});

export type RequirementTypeCreateDTO = z.infer<typeof RequirementTypeCreateSchema>;
