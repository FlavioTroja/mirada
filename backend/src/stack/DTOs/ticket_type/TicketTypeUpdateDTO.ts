import { z } from "zod";
import { TicketTypePartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { I18nTextNullishSchema, I18nTextSchema } from "@utils/helpers/i18nText";

/** Solo scalari della propria riga — regola 11 di controllers.md. */
export const TicketTypeUpdateSchema = withoutMetadata(TicketTypePartialSchema)
    .omit({ eventId: true })
    .extend({
        name: I18nTextSchema.optional(),
        description: I18nTextNullishSchema,
    });

export type TicketTypeUpdateDTO = z.infer<typeof TicketTypeUpdateSchema>;
