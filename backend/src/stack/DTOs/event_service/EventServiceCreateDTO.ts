import { z } from "zod";
import { EventServiceOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { I18nTextNullishSchema, I18nTextSchema } from "@utils/helpers/i18nText";

/** `price` in centesimi interi (§3.1). */
export const EventServiceCreateSchema = withoutMetadata(EventServiceOptionalDefaultsSchema).extend({
    name: I18nTextSchema,
    description: I18nTextNullishSchema,
});

export type EventServiceCreateDTO = z.infer<typeof EventServiceCreateSchema>;
