import { z } from "zod";
import { SessionPartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { I18nTextSchema } from "@utils/helpers/i18nText";

/** Solo scalari della propria riga — regola 11 di controllers.md. */
export const SessionUpdateSchema = withoutMetadata(SessionPartialSchema)
    .omit({
        eventId: true,
        isImplicit: true,
        cancelledAt: true,
        cancellationReason: true,
    })
    .extend({
        name: I18nTextSchema.optional(),
    });

export type SessionUpdateDTO = z.infer<typeof SessionUpdateSchema>;
