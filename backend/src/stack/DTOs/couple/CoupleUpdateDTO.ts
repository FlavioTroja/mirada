import { z } from "zod";
import { CouplePartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * Solo scalari della propria riga. `dissolvedAt` non si scrive qui: lo
 * scioglimento passa da `POST /couples/:id/dissolve`, perché è un atto con una
 * regola sua — **non muove alcun consumo** (`05` §8).
 */
export const CoupleUpdateSchema = withoutMetadata(CouplePartialSchema)
    .omit({ eventId: true, dissolvedAt: true });

export type CoupleUpdateDTO = z.infer<typeof CoupleUpdateSchema>;
