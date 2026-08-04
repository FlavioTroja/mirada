import { Service } from "fastify-decorators";
import { PriceTier, Prisma } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";

/**
 * Figlio posseduto (§2, §3.4): nessun controller proprio, si scrive solo con
 * `PATCH /ticket-types/:id/price-tiers`.
 */
@Service()
export class PriceTierRepository extends BaseRepository<"priceTier"> {
    constructor() {
        super("priceTier");
    }

    async findByTicketType(ticketTypeId: number, tx?: Prisma.TransactionClient): Promise<PriceTier[]> {
        return this.findMany({ ticketTypeId }, { orderBy: { sortOrder: "asc" } }, tx);
    }
}
