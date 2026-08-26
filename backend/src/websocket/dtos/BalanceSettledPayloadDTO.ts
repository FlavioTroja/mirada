import { z } from "zod";

/**
 * Payload of `Events.BALANCE_SETTLED` (`14` §8, `RF-SAL-17`).
 *
 * Stessa disciplina di `ExternalSaleIngestedPayloadDTO`: **notifica e invito a
 * rileggere, mai un canale di dati**. Porta ciò che serve a decidere *cosa*
 * ricaricare — quale iscrizione, quale evento — e nient'altro.
 *
 * ── Perché niente importo, qui più che altrove ──────────────────────────────
 * L'importo di un residuo è il dato che `RB27` tiene lontano da chi non tiene la
 * cassa. Un fotogramma WebSocket non passa dal controllo di permesso della rotta:
 * metterci la cifra vorrebbe dire spedirla a ogni membro connesso, aggirando in
 * un colpo solo la regola che il resto della funzione difende.
 *
 * `fullySettled` non è denaro: è lo stato che decide se l'avviso alla porta deve
 * ancora comparire.
 */
export const BalanceSettledPayloadSchema = z.object({
    balanceSettlementId: z.number().int(),
    registrationId: z.number().int(),
    eventId: z.number().int(),
    organizationId: z.number().int(),
    /** `true` = il residuo di quella persona è chiuso: l'avviso alla porta sparisce. */
    fullySettled: z.boolean(),
    /** `true` = la riga è nata in conflitto con un'altra — doppio incasso da risolvere. */
    conflict: z.boolean(),
});

export type BalanceSettledPayloadDTO = z.infer<typeof BalanceSettledPayloadSchema>;
