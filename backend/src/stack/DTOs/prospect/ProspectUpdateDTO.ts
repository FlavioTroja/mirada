import { z } from "zod";
import { ProspectPartialSchema } from "@prisma-gen/zod";

/**
 * Solo scalari della propria riga — regola 11 di `controllers.md`.
 *
 * Fuori: l'organizzazione e il corso di provenienza (sono la storia del
 * contatto), il consenso (è una data, non si ritocca), e la conversione, che la
 * trova il server (`19-prospect.md` §4). `contactedAt` lo scrive il servizio al
 * passaggio a `CONTACTED`.
 */
export const ProspectUpdateSchema = ProspectPartialSchema.pick({
    preferredRole: true,
    note: true,
    status: true,
}).extend({
    name: z.string().trim().min(1, "Indica il nome.").optional(),
    surname: z.string().trim().nullish(),
    email: z.string().trim().toLowerCase().email("Email non valida.").nullish().or(z.literal("")),
    phone: z.string().trim().nullish(),
});
export type ProspectUpdateDTO = z.infer<typeof ProspectUpdateSchema>;
