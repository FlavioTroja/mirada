import { Service } from "fastify-decorators";
import { Prisma, TicketTransfer } from "@prisma/client";
import { Log } from "@utils/adapters/log";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { TicketTransferRepository } from "@repositories/TicketTransferRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { TicketTransferQueryDTO } from "@DTOs/ticket_transfer/TicketTransferQueryDTO";

/**
 * `TicketTransfer` — **sola lettura** (§3.4, §4.12).
 *
 * Nessun `save`, nessun `update`, nessun `delete`: le righe nascono soltanto
 * dentro la transazione di `TicketService.transfer`, che è l'unico punto in cui
 * un biglietto cambia titolare. Uno storico che si può riscrivere non è uno
 * storico, ed è la ragione per cui questo servizio non espone scritture.
 */
@Service()
export class TicketTransferService {
    constructor(
        private readonly ticketTransferRepository: TicketTransferRepository,
        private readonly organizationScopeService: OrganizationScopeService,
    ) {}

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<TicketTransfer | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.ticketTransferRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async paginate(
        principalId: number,
        query: TicketTransferQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<TicketTransfer>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        Log.debug(`[TicketTransfer Service]: listing transfers for principal (id ${principalId})`);
        return this.ticketTransferRepository.paginateInScope(scope, this.createQueryFromPayload(query), options);
    }

    private createQueryFromPayload(payload: TicketTransferQueryDTO): Prisma.TicketTransferWhereInput {
        const query: Prisma.TicketTransferWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(payload.ticketId, { ticketId: payload.ticketId }),
            createObjectWithoutThrow(payload.fromUserId, { fromUserId: payload.fromUserId }),
            createObjectWithoutThrow(payload.toUserId, { toUserId: payload.toUserId }),
            createObjectWithoutThrow(payload.value, {
                previousCode: { contains: payload.value ?? "", mode: "insensitive" as const },
            }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
