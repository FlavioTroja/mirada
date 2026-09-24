import { z } from "zod";
import { ProspectOptionalDefaultsSchema } from "@prisma-gen/zod";

/**
 * `POST /prospects/create` — chi è venuto all'open day e non si è iscritto.
 *
 * Non ci sono né `organizationId` né gli stati: la prima la deriva il server dal
 * corso, i secondi nascono `TO_CONTACT` e la conversione la trova il server
 * (`19-prospect.md` §4). Email **o** telefono: almeno uno, e lo verifica il
 * servizio — un contatto che non si può contattare non è un contatto.
 */
export const ProspectCreateSchema = ProspectOptionalDefaultsSchema.pick({
    sourceEventId: true,
    preferredRole: true,
    note: true,
}).extend({
    name: z.string().trim().min(1, "Indica il nome."),
    surname: z.string().trim().nullish(),
    email: z.string().trim().toLowerCase().email("Email non valida.").nullish().or(z.literal("")),
    phone: z.string().trim().nullish(),
    /**
     * **Il consenso a essere ricontattato** (`19` §3). Non un booleano che può
     * valere falso: chi non acconsente non si registra per ricontattarlo. Il
     * server ne scrive la data in `consentAt`.
     */
    consent: z.literal(true, { message: "Serve il consenso a essere ricontattati." }),
});
export type ProspectCreateDTO = z.infer<typeof ProspectCreateSchema>;
