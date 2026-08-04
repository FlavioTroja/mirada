import { z } from "zod";
import { EventServicePartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { I18nTextNullishSchema, I18nTextSchema } from "@utils/helpers/i18nText";

/** Solo scalari della propria riga — regola 11 di controllers.md. */
export const EventServiceUpdateSchema = withoutMetadata(EventServicePartialSchema)
    .omit({ eventId: true })
    .extend({
        name: I18nTextSchema.optional(),
        description: I18nTextNullishSchema,
    });

export type EventServiceUpdateDTO = z.infer<typeof EventServiceUpdateSchema>;
