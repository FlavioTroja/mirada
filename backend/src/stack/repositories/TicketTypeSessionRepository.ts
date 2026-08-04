import { Service } from "fastify-decorators";
import { Prisma, TicketTypeSession } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";

/**
 * Figlio posseduto (§2, §3.4): nessun controller proprio, si scrive solo con
 * `PATCH /ticket-types/:id/sessions`. Come `RoleToUser` — la sub-risorsa di
 * riferimento del template — non porta soft delete: la rimozione dall'elenco
 * esplicito è una cancellazione reale della riga.
 */
@Service()
export class TicketTypeSessionRepository extends BaseRepository<"ticketTypeSession"> {
    constructor() {
        super("ticketTypeSession");
    }

    async findByTicketType(ticketTypeId: number, tx?: Prisma.TransactionClient): Promise<TicketTypeSession[]> {
        return this.findMany({ ticketTypeId }, undefined, tx);
    }

    async findBySession(sessionId: number, tx?: Prisma.TransactionClient): Promise<TicketTypeSession[]> {
        return this.findMany({ sessionId }, undefined, tx);
    }
}
