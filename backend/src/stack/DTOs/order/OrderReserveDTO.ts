import { z } from "zod";
import { DeclaredDanceRoleSchema } from "@prisma-gen/zod";

/**
 * Un partecipante di una riga d'ordine — è ciò che finisce in
 * `OrderLine.attendees` (§3.6) e ciò da cui nasce una `Registration`.
 *
 * `declaredRole` è **ciò che la persona ha scelto**, non il ruolo effettivo:
 * `assignedRole` è calcolato dal server e non compare in nessun DTO di scrittura
 * (§5). `FLEXIBLE` è una scelta legittima e viene risolta dal motore di capienza.
 *
 * `serviceAttributes` raccoglie ciò che il servizio accessorio dichiara di
 * volere (`EventService.attributesConfig`): taglia, slot orario, **e le diete**,
 * che sono l'unico dato riconducibile alla salute che resta in piattaforma —
 * accesso ristretto, mai nelle esportazioni generiche né nella vista di check-in
 * (`RB12`).
 */
export const OrderAttendeeSchema = z.object({
    name: z.string().min(1),
    surname: z.string().min(1),
    email: z.string().email(),
    declaredRole: DeclaredDanceRoleSchema,
    serviceAttributes: z.record(z.string(), z.any()).optional(),
});
export type OrderAttendeeDTO = z.infer<typeof OrderAttendeeSchema>;

/**
 * Una riga del carrello. **Nessun prezzo**: `unitPrice`,
 * `presaleRightsPerUnit` e `lineTotal` sono calcolati dal server e non sono
 * accettati dal client in nessun DTO — *un prezzo che arriva dal client è un
 * difetto di sicurezza* (§4.11).
 *
 * O un titolo d'ingresso, o un servizio accessorio: mai entrambi sulla stessa
 * riga, perché sono due inventari diversi con due quote diverse.
 */
export const OrderReserveLineSchema = z.object({
    ticketTypeId: z.number().int().positive().optional(),
    eventServiceId: z.number().int().positive().optional(),
    quantity: z.number().int().positive().default(1),
    /**
     * I partecipanti **di questa riga**. Se assente, si attinge in ordine
     * all'elenco di corpo: è la forma comoda per il caso normale — «due Full
     * Pass, ecco i due nomi» — senza obbligare il client a ripetere la struttura.
     */
    attendees: OrderAttendeeSchema.array().optional(),
}).refine(
    line => !!line.ticketTypeId !== !!line.eventServiceId,
    { message: "Una riga d'ordine porta un titolo d'ingresso oppure un servizio accessorio, non entrambi e non nessuno." },
);
export type OrderReserveLineDTO = z.infer<typeof OrderReserveLineSchema>;

/**
 * `POST /api/orders/reserve` — **crea l'ordine, blocca il prezzo e impegna
 * atomicamente la capienza per quindici minuti** (§3.7, §4.11).
 *
 * Il corpo è quello dichiarato dal §3.7: `{ eventId, lines[], attendees[] }`.
 */
export const OrderReserveSchema = z.object({
    eventId: z.number().int().positive(),
    lines: OrderReserveLineSchema.array().min(1),
    /** Partecipanti dell'ordine, distribuiti in ordine sulle righe di titolo. */
    attendees: OrderAttendeeSchema.array().optional(),
});
export type OrderReserveDTO = z.infer<typeof OrderReserveSchema>;
