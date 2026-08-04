import { z } from "zod";
import { EventRequirementOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { I18nTextSchema } from "@utils/helpers/i18nText";

/**
 * §4.6 — `kind` è ereditato dal `RequirementType`, non dichiarato qui. Nel primo
 * taglio il servizio ammette solo `DECLARATION` e `CUSTOM_FIELD`: nessun upload
 * di documenti, nessun dato sanitario (`RF-REQ-2`, `RF-REQ-3`).
 */
export const EventRequirementCreateSchema = withoutMetadata(EventRequirementOptionalDefaultsSchema).extend({
    label: I18nTextSchema,
    text: I18nTextSchema,
});

export type EventRequirementCreateDTO = z.infer<typeof EventRequirementCreateSchema>;
