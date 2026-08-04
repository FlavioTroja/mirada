import { z } from "zod";
import { ArtistPartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { I18nTextSchema } from "@utils/helpers/i18nText";

/** Solo scalari della propria riga — regola 11 di controllers.md. */
export const ArtistUpdateSchema = withoutMetadata(ArtistPartialSchema).extend({
    bio: I18nTextSchema.nullish(),
});

export type ArtistUpdateDTO = z.infer<typeof ArtistUpdateSchema>;
