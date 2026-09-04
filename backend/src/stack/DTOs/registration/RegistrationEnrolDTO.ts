import { z } from "zod";
import { DeclaredDanceRoleSchema } from "@prisma-gen/zod";

/**
 * `POST /api/registrations/enrol` — **l'iscrizione a listino dal back-office**
 * (`15-corsi.md` §3).
 *
 * È la via della segreteria: qualcuno digita nome, cognome ed email di un
 * allievo e sceglie il titolo. Non è il checkout, e non deve diventarlo.
 *
 * ── Perché non passa da `Order` ─────────────────────────────────────────────
 * `Order` e `Reservation` esistono per difendere l'ultimo posto da due
 * acquirenti simultanei: un fermo di quindici minuti mentre qualcuno paga. Su un
 * modulo compilato allo sportello quel macchinario è solo attrito — non c'è
 * nessuno con cui contendere, e la persona è lì davanti.
 *
 * ── ⚠️ NON esiste un campo «importo», ed è la regola di questo DTO ──────────
 * `RegistrationCreateDTO` esclude `balanceDueAmount` con una motivazione scritta:
 * *«un'iscrizione creata da fuori con un residuo già dentro sarebbe un debito che
 * nessuna vendita ha prodotto»*. Quella regola non si allenta qui — si soddisfa.
 *
 * Il divieto non è «nessuno può nascere con un residuo»: è **il client non può
 * dichiarare un debito**. Il debito deve venire da una vendita, e un'iscrizione a
 * listino *è* una vendita — solo registrata a mano. Quindi qui si manda il
 * **titolo**, e il prezzo lo risolve il server da `TicketTypeService.resolvePrice`,
 * lo stesso che alimenta la disponibilità pubblica: il listino mostrato e quello
 * addebitato non possono divergere, e gli scaglioni funzionano senza codice in più.
 *
 * Un `amount` in questo schema sarebbe il difetto di sicurezza che §4.11 chiama
 * per nome: *«un prezzo che arriva dal client è un difetto di sicurezza»*.
 */
export const RegistrationEnrolSchema = z.object({
    eventId: z.number().int().positive(),
    /**
     * Il titolo a listino da cui nasce il dovuto. **Deve appartenere a
     * `eventId`**: il servizio lo verifica, perché un titolo di un altro evento
     * darebbe un prezzo plausibile e sbagliato — e nessuno se ne accorgerebbe.
     */
    ticketTypeId: z.number().int().positive(),

    holderName: z.string().trim().min(1),
    holderSurname: z.string().trim().min(1),
    /**
     * L'indirizzo su cui regge l'anagrafica unica (`16` §3). Obbligatorio come su
     * ogni iscrizione: è dove arriva ciò che la riguarda.
     */
    holderEmail: z.string().trim().toLowerCase().email(),

    declaredRole: DeclaredDanceRoleSchema,
});

export type RegistrationEnrolDTO = z.infer<typeof RegistrationEnrolSchema>;
