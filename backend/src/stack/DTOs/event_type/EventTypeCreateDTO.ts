import { z } from "zod";
import { EventTypeOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { I18nTextSchema } from "@utils/helpers/i18nText";

export const EventTypeCreateSchema = withoutMetadata(EventTypeOptionalDefaultsSchema).extend({
    name: I18nTextSchema,
    defaultTemplate: z.any().optional(),
});

export type EventTypeCreateDTO = z.infer<typeof EventTypeCreateSchema>;
