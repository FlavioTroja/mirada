import { InputJsonValueSchema, LogSchema } from "@prisma-gen/zod";
import z from "zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { RecipientSchema } from "@DTOs/log/RecipientDTO";

export const LogCreateSchema = withoutMetadata(
    LogSchema.extend({
        input: InputJsonValueSchema.optional(),
        output: InputJsonValueSchema.optional(),
        recipients: RecipientSchema.array().default([]),
    })
);

export type LogCreateDTO = z.infer<typeof LogCreateSchema>;