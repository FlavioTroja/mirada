import { z } from "zod";
import { RefundPolicyOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { I18nTextSchema } from "@utils/helpers/i18nText";

/** `tiers` = `[{ daysBefore, percent }]` (§3.6). */
export const RefundPolicyTierSchema = z.object({
    daysBefore: z.number().int().min(0),
    percent: z.number().int().min(0).max(100),
});

export const RefundPolicyCreateSchema = withoutMetadata(RefundPolicyOptionalDefaultsSchema).extend({
    name: I18nTextSchema,
    tiers: RefundPolicyTierSchema.array().optional(),
});

export type RefundPolicyCreateDTO = z.infer<typeof RefundPolicyCreateSchema>;
