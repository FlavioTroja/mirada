import { z } from "zod";
import { SessionOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { I18nTextSchema } from "@utils/helpers/i18nText";

/**
 * §4.6 — `isImplicit` non è scrivibile dal client: la sessione implicita è creata
 * dal servizio alla creazione di un evento il cui `EventType` ha
 * `capMultiSession = false`. `cancelledAt`/`cancellationReason` passano da
 * `cancelSession`. `allocationWeight` resta facoltativo: in sua assenza il
 * servizio applica il default uniforme (`RF-EVT-36`).
 */
export const SessionCreateSchema = withoutMetadata(SessionOptionalDefaultsSchema)
    .omit({
        isImplicit: true,
        cancelledAt: true,
        cancellationReason: true,
    })
    .extend({
        name: I18nTextSchema,
    });

export type SessionCreateDTO = z.infer<typeof SessionCreateSchema>;
