import { z } from "zod";
import { DancerProfileOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * `userId` arriva dall'autenticazione, non dal corpo (profilo 1–1 con `User`).
 * `nicknameChangedAt` e `nicknameChangeCount` sono governati dal servizio (§4.3).
 */
export const DancerProfileCreateSchema = withoutMetadata(
    DancerProfileOptionalDefaultsSchema.omit({
        userId: true,
        nicknameChangedAt: true,
        nicknameChangeCount: true,
    }),
).extend({
    attributes: z.any().optional(),
});

export type DancerProfileCreateDTO = z.infer<typeof DancerProfileCreateSchema>;
