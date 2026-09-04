import { z } from "zod";
import { EventTypePartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { I18nTextNullishSchema, I18nTextSchema } from "@utils/helpers/i18nText";

/** Solo scalari della propria riga — regola 11 di controllers.md. */
export const EventTypeUpdateSchema = withoutMetadata(EventTypePartialSchema).extend({
    name: I18nTextSchema.optional(),
    sessionsLabel: I18nTextNullishSchema,
    defaultTemplate: z.any().optional(),
});

export type EventTypeUpdateDTO = z.infer<typeof EventTypeUpdateSchema>;
