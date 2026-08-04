import { z } from "zod";
import { EventPartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { I18nTextNullishSchema, I18nTextSchema } from "@utils/helpers/i18nText";

/**
 * Solo scalari della propria riga — regola 11 di controllers.md.
 * Il ciclo di vita (`status`, `publishedAt`, `cancelledAt`, `cancellationReason`)
 * passa dagli endpoint del §3.7, mai da un `PATCH` generico (§4.5).
 */
export const EventUpdateSchema = withoutMetadata(EventPartialSchema)
    .omit({
        status: true,
        publishedAt: true,
        cancelledAt: true,
        cancellationReason: true,
    })
    .extend({
        title: I18nTextSchema.optional(),
        description: I18nTextSchema.optional(),
        refundPolicyText: I18nTextSchema.optional(),
        minorsConditions: I18nTextNullishSchema,
    });

export type EventUpdateDTO = z.infer<typeof EventUpdateSchema>;
