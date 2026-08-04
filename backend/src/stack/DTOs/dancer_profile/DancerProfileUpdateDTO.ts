import { z } from "zod";
import { DancerProfilePartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * Solo scalari della propria riga — regola 11 di controllers.md.
 * `nickname` è ammesso ma passa dal filtro e dal contatore di `DancerProfileService`
 * (`RF-ACC-9`): il contatore e la data non sono scrivibili dal client.
 */
export const DancerProfileUpdateSchema = withoutMetadata(
    DancerProfilePartialSchema.omit({
        userId: true,
        nicknameChangedAt: true,
        nicknameChangeCount: true,
    }),
).extend({
    attributes: z.any().optional(),
});

export type DancerProfileUpdateDTO = z.infer<typeof DancerProfileUpdateSchema>;
