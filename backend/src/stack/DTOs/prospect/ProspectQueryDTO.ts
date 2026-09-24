import { z } from "zod";
import { ProspectStatusSchema } from "@prisma-gen/zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const ProspectQuerySchema = z.object({
    /** Nome, cognome, email, telefono, note. */
    value: z.string().optional(),
    sourceEventId: z.number().int().optional(),
    status: ProspectStatusSchema.optional(),
    /**
     * `false` = solo chi non si è ancora iscritto. È il filtro della domanda
     * «chi chiamo per il corso nuovo?»: `status: TO_CONTACT` + `converted: false`.
     */
    converted: z.boolean().optional(),
});
export type ProspectQueryDTO = z.infer<typeof ProspectQuerySchema>;

export const ProspectPaginateBodyInputSchema = paginateSchema(ProspectQuerySchema);
export type ProspectPaginateDTO = z.infer<typeof ProspectPaginateBodyInputSchema>;
