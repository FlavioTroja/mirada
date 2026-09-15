import { z } from "zod";
import { BalanceSettlementSchema, PaymentInstalmentSchema } from "@prisma-gen/zod";

/**
 * Il residuo di **una persona**, come lo legge la scheda dell'iscrizione
 * (`RF-SAL-14`) e come lo legge la cassa prima di incassare.
 *
 * ── `openAmount` è calcolato, non memorizzato ───────────────────────────────
 * È la differenza fra quanto è nato e quanto è stato saldato. Non esiste in
 * colonna, e non deve: un terzo numero scritto da qualche parte è un terzo numero
 * che può smettere di essere d'accordo con gli altri due.
 *
 * ⚠️ Questo DTO **contiene la cifra**, quindi la rotta che lo restituisce chiede
 * `READ#BALANCE_SETTLEMENT` — cioè il permesso di chi tiene la cassa (`RB27`).
 * Ciò che l'operatore di porta riceve è un'altra cosa: un flag, in
 * `TicketVerifyResponseDTO` e nel manifesto.
 */
export const RegistrationBalanceSchema = z.object({
    registrationId: z.number().int(),
    eventId: z.number().int(),
    holderName: z.string(),
    holderSurname: z.string(),
    /** Quanto è nato con la vendita. Immutabile. */
    dueAmount: z.number().int(),
    /** Quanto ne è stato incassato: la somma delle righe qui sotto. */
    settledAmount: z.number().int(),
    /** `dueAmount - settledAmount`. Negativo = incassato più del dovuto, ed è un conflitto. */
    openAmount: z.number().int(),
    /**
     * Gli incassi, ciascuno con **il nome di chi lo ha preso in mano**.
     *
     * ⚠️ Il nome lo risolve il SERVER e non il front-office. Chiederlo di là
     * significava leggere l'elenco utenti, che è un permesso di piattaforma: un
     * `OWNER` non ce l'ha, quindi la chiamata falliva **sempre** proprio per chi
     * usa questa schermata, e l'intercettore mostrava «User 5 lacks
     * READ#USER#ALL permission» sopra un incasso andato a buon fine.
     *
     * Visto in esercizio il 15 settembre 2026. Non si nasconde un errore: non si
     * fa la chiamata, e il dato arriva da dove è già noto.
     */
    settlements: BalanceSettlementSchema.extend({
        /** Nullo se l'utenza non è più leggibile: resta il numero, come prima. */
        operatorName: z.string().nullable(),
    }).array(),

    // ── Il piano delle rate — `18-rate.md` ──────────────────────────────────
    /**
     * Le rate concordate, per scadenza. Vuoto quando non esiste un piano: il
     * residuo è aperto e basta, che è come funzionava prima.
     */
    instalments: PaymentInstalmentSchema.array(),
    /**
     * **Quanto sarebbe già dovuto essere versato e non lo è** — `RB34`.
     *
     * `somma delle rate scadute − settledAmount`, mai negativo. È l'unico numero
     * che risponde a «questa persona è in ritardo?», e si ottiene confrontando
     * previsione e fatti: nessuna rata porta una spunta «pagata», perché sarebbe
     * un terzo posto in cui vive la stessa verità.
     *
     * Zero anche quando un piano non c'è: senza scadenze non si è mai in ritardo.
     */
    overdueAmount: z.number().int(),
    /**
     * La prossima scadenza non ancora coperta dai versamenti. Nulla quando il
     * piano è finito, o quando non c'è.
     */
    nextDueAt: z.coerce.date().nullable(),
});

export type RegistrationBalanceDTO = z.infer<typeof RegistrationBalanceSchema>;
