import { z } from "zod";
import { GenderSchema } from "@prisma-gen/zod";

export const UserRegisterSchema = z.object({
    // User
    username: z.string(),
    password: z.string().min(8),
    avatarUrl: z.string().nullish(),
    note: z.string().nullish(),

    // Person
    firstName: z.string(),
    lastName: z.string(),
    fiscalCode: z.string().nullish(),
    vatNumber: z.string().nullish(),
    gender: GenderSchema.nullish(),
    birthDate: z.coerce.date().nullish(),
    bornIn: z.string().nullish(),
    livesIn: z.string().nullish(),

    // Contact
    email: z.string().email(),
    phoneNumber: z.string().nullish(),
    telephone: z.string().nullish(),
    pec: z.string().nullish(),

    /**
     * Lo slug dell'evento da cui è partita l'iscrizione, quando ce n'è uno.
     *
     * Serve a due cose, entrambe dopo il clic sul tasto di conferma: nominare
     * l'evento nell'email («il tuo posto a … non è ancora prenotato») e
     * riportare la persona **dove aveva lasciato** invece che su una pagina
     * generica di benvenuto.
     *
     * È uno slug e non un percorso di ritorno completo: un URL accettato dal
     * client sarebbe un rimbalzo verso dove vuole chi confeziona il link. Il
     * server lo cerca fra i propri eventi e, se non lo trova, tira dritto senza
     * il nome — non è un errore, è un'informazione in meno.
     */
    eventSlug: z.string().max(200).nullish(),
});
export type UserRegisterDTO = z.infer<typeof UserRegisterSchema>;
