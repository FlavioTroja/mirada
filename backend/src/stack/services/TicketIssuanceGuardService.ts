import { Service } from "fastify-decorators";
import { Prisma } from "@prisma/client";
import { Log } from "@utils/adapters/log";
import { TicketRepository } from "@repositories/TicketRepository";

/**
 * Presidio dei biglietti emessi — l'unico punto in cui il progetto chiede
 * «esistono biglietti emessi per questo titolo?».
 *
 * Attraverso questo servizio i controlli del §4.5 e del §4.7 —
 *
 *   - `setSessions` rifiuta la rimozione di una sessione se esistono biglietti
 *     emessi per quel titolo;
 *   - `resolveOrphanSessions` distingue i titoli venduti dagli invenduti;
 *   - la rimozione di uno scaglione già venduto è rifiutata;
 *
 * — sono **effettivi dalla fase D1**. Fino al passo 24 del §2 il modello `Ticket`
 * non esisteva e questo servizio dichiarava `0` nel log, perché nessun chiamante
 * doveva credere di aver verificato qualcosa che non era verificabile. Ora è la
 * query reale, e **nessun servizio chiamante è stato toccato**: era esattamente
 * lo scopo dell'innesto.
 *
 * «Vivi» comprende i biglietti **trasferiti**: un biglietto passato di mano è un
 * biglietto valido, e togliere una sessione a un titolo già venduto lederebbe il
 * nuovo titolare esattamente come avrebbe leso il primo.
 */
@Service()
export class TicketIssuanceGuardService {
    constructor(private readonly ticketRepository: TicketRepository) {}

    /** Numero di biglietti vivi emessi per il titolo indicato. */
    public async countIssuedTickets(ticketTypeId: number, tx?: Prisma.TransactionClient): Promise<number> {
        const count = await this.ticketRepository.countLiveByTicketType(ticketTypeId, tx);
        Log.debug(`[TicketIssuanceGuard Service]: ticket type (id ${ticketTypeId}) has ${count} live ticket(s) issued`);
        return count;
    }

    /** True quando il titolo ha già biglietti emessi e non è più liberamente modificabile. */
    public async hasIssuedTickets(ticketTypeId: number, tx?: Prisma.TransactionClient): Promise<boolean> {
        return (await this.countIssuedTickets(ticketTypeId, tx)) > 0;
    }
}
