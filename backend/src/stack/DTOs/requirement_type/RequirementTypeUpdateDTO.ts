import { z } from "zod";
import { RequirementTypePartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { I18nTextSchema } from "@utils/helpers/i18nText";

/** Solo scalari della propria riga — regola 11 di controllers.md. */
export const RequirementTypeUpdateSchema = withoutMetadata(RequirementTypePartialSchema).extend({
    name: I18nTextSchema.optional(),
    configSchema: z.any().optional(),
});

export type RequirementTypeUpdateDTO = z.infer<typeof RequirementTypeUpdateSchema>;
