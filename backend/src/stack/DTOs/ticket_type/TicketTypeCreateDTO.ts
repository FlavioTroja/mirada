import { z } from "zod";
import { TicketTypeOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { I18nTextNullishSchema, I18nTextSchema } from "@utils/helpers/i18nText";

/**
 * §4.7 — `Create` NON accetta le sessioni incluse né gli scaglioni: sono figli
 * posseduti e si scrivono con i due `PATCH` sub-risorsa del §3.4.
 * `basePrice` è in centesimi interi (§3.1).
 */
export const TicketTypeCreateSchema = withoutMetadata(TicketTypeOptionalDefaultsSchema).extend({
    name: I18nTextSchema,
    description: I18nTextNullishSchema,
});

export type TicketTypeCreateDTO = z.infer<typeof TicketTypeCreateSchema>;
