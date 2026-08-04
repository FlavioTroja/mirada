import { HiddenComponentConfigSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { z } from "zod";

export const HiddenComponentConfigUpdateSchema = withoutMetadata(HiddenComponentConfigSchema).partial();
export type HiddenComponentConfigUpdateDTO = z.infer<typeof HiddenComponentConfigUpdateSchema>;