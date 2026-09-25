import { z } from "zod";
import { SessionPartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { I18nTextSchema } from "@utils/helpers/i18nText";

/**
 * Solo scalari della propria riga — regola 11 di controllers.md.
 *
 * `seriesId` accetta **solo `null`**: è «solo questo» del calendario
 * (`20-calendario.md` §5.1), che fa uscire la riga dalla serie. Entrare in una
 * serie altrui, o inventarne una, non ha senso da qui.
 */
export const SessionUpdateSchema = withoutMetadata(SessionPartialSchema)
    .omit({
        eventId: true,
        isImplicit: true,
        cancelledAt: true,
        cancellationReason: true,
    })
    .extend({
        name: I18nTextSchema.optional(),
        seriesId: z.null().optional(),
    });

export type SessionUpdateDTO = z.infer<typeof SessionUpdateSchema>;
