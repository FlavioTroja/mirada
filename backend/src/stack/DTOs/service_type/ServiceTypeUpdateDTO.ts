import { z } from "zod";
import { ServiceTypePartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { I18nTextSchema } from "@utils/helpers/i18nText";

/** Solo scalari della propria riga — regola 11 di controllers.md. */
export const ServiceTypeUpdateSchema = withoutMetadata(ServiceTypePartialSchema).extend({
    name: I18nTextSchema.optional(),
    attributesSchema: z.any().optional(),
});

export type ServiceTypeUpdateDTO = z.infer<typeof ServiceTypeUpdateSchema>;
