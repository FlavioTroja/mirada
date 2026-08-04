import { z } from "zod";
import { ServiceTypeOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { I18nTextSchema } from "@utils/helpers/i18nText";

export const ServiceTypeCreateSchema = withoutMetadata(ServiceTypeOptionalDefaultsSchema).extend({
    name: I18nTextSchema,
    attributesSchema: z.any().optional(),
});

export type ServiceTypeCreateDTO = z.infer<typeof ServiceTypeCreateSchema>;
