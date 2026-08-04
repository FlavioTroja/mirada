import { Service } from "fastify-decorators";
import { Prisma } from "@prisma/client";
import { Log } from "@utils/adapters/log";

/**
 * Presidio dei biglietti emessi — l'unico punto in cui il progetto chiede
 * «esistono biglietti emessi per questo titolo?».
 *
 * Il modello `Ticket` è del passo 24 del §2 (fase C) e **oggi non esiste**. Questo
 * servizio è il singolo innesto attraverso cui i controlli del §4.5 e del §4.7 —
 *
 *   - `setSessions` rifiuta la rimozione di una sessione se esistono biglietti
 *     emessi per quel titolo;
 *   - `resolveOrphanSessions` distingue i titoli venduti dagli invenduti;
 *   - la rimozione di uno scaglione già venduto è rifiutata;
 *
 * — diventeranno effettivi **senza toccare i servizi chiamanti**: basterà
 * sostituire il corpo di `countIssuedTickets` con la query su `Ticket`.
 *
 * Finché `Ticket` non esiste il conteggio è `0` e il servizio lo **dichiara nel
 * log**: nessun chiamante deve credere di aver verificato qualcosa che non è
 * ancora verificabile.
 */
@Service()
export class TicketIssuanceGuardService {
    /**
     * Numero di biglietti emessi per il titolo indicato.
     *
     * FASE C — sostituire con:
     *   `return this.ticketRepository.count({ ticketTypeId, status: { in: [VALID, TRANSFERRED] } }, tx);`
     */
    public async countIssuedTickets(ticketTypeId: number, _tx?: Prisma.TransactionClient): Promise<number> {
        Log.debug(
            `[TicketIssuanceGuard Service]: issued ticket count requested for ticket type (id ${ticketTypeId}) — `
            + `the Ticket model does not exist yet (backend-brief §2, step 24), the count is reported as 0`,
        );
        return 0;
    }

    /** True quando il titolo ha già biglietti emessi e non è più liberamente modificabile. */
    public async hasIssuedTickets(ticketTypeId: number, tx?: Prisma.TransactionClient): Promise<boolean> {
        return (await this.countIssuedTickets(ticketTypeId, tx)) > 0;
    }
}
