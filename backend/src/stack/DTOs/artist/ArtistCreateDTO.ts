import { z } from "zod";
import { ArtistOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { I18nTextSchema } from "@utils/helpers/i18nText";

/** Anagrafica di cast, senza account: nessun riferimento a `User` (`RF-EVT-6`). */
export const ArtistCreateSchema = withoutMetadata(ArtistOptionalDefaultsSchema).extend({
    bio: I18nTextSchema.nullish(),
});

export type ArtistCreateDTO = z.infer<typeof ArtistCreateSchema>;
