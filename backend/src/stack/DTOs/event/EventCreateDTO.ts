import { z } from "zod";
import { EventOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { I18nTextNullishSchema, I18nTextSchema } from "@utils/helpers/i18nText";

/**
 * §4.5 — `Create` NON accetta `status`, `publishedAt`, `cancelledAt` né
 * `cancellationReason`: sono governati dalle transizioni del servizio.
 */
export const EventCreateSchema = withoutMetadata(EventOptionalDefaultsSchema)
    .omit({
        status: true,
        publishedAt: true,
        cancelledAt: true,
        cancellationReason: true,
    })
    .extend({
        title: I18nTextSchema,
        description: I18nTextSchema,
        refundPolicyText: I18nTextSchema,
        minorsConditions: I18nTextNullishSchema,
    });

export type EventCreateDTO = z.infer<typeof EventCreateSchema>;
