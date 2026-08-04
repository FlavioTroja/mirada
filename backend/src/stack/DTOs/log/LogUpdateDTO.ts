import { LogPartialSchema } from "@prisma-gen/zod";
import { z } from "zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

export const LogUpdateSchema = withoutMetadata(LogPartialSchema);
export type LogUpdateDTO = z.infer<typeof LogUpdateSchema>;
