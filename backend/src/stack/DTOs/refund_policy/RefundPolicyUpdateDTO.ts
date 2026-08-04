import { z } from "zod";
import { RefundPolicyPartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { I18nTextSchema } from "@utils/helpers/i18nText";
import { RefundPolicyTierSchema } from "@DTOs/refund_policy/RefundPolicyCreateDTO";

/** Solo scalari della propria riga — regola 11 di controllers.md. */
export const RefundPolicyUpdateSchema = withoutMetadata(RefundPolicyPartialSchema).extend({
    name: I18nTextSchema.optional(),
    tiers: RefundPolicyTierSchema.array().optional(),
});

export type RefundPolicyUpdateDTO = z.infer<typeof RefundPolicyUpdateSchema>;
