import { z } from "zod";
import { EventRequirementPartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { I18nTextSchema } from "@utils/helpers/i18nText";

/** Solo scalari della propria riga — regola 11 di controllers.md. */
export const EventRequirementUpdateSchema = withoutMetadata(EventRequirementPartialSchema)
    .omit({ eventId: true })
    .extend({
        label: I18nTextSchema.optional(),
        text: I18nTextSchema.optional(),
    });

export type EventRequirementUpdateDTO = z.infer<typeof EventRequirementUpdateSchema>;
