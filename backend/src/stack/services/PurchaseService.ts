import { Service } from "fastify-decorators";
import { Prisma, Purchase } from "@prisma/client";
import { Log } from "@utils/adapters/log";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { PurchaseQueryDTO } from "@DTOs/order/OrderQueryDTO";
import { PurchaseRepository } from "@repositories/PurchaseRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";

/**
 * `Purchase` — backend-brief §4.11. **Sola lettura via API**.
 *
 * L'acquisto è il livello a cui il partecipante vede *«il mio acquisto»*, mentre
 * l'organizzatore vede il proprio ordine e nient'altro (`RF-PAY-34`). Non esiste
 * un endpoint che lo crei: nasce solo dentro la transazione di
 * `POST /orders/reserve`, dove è garantito che abbia almeno un ordine e una
 * capienza impegnata. Un acquisto creabile da fuori sarebbe un acquisto vuoto.
 *
 * `totalAmount` e `totalPresaleRights` sono **calcolati dal server** e riscritti
 * a ogni variazione degli ordini che raggruppa (§4.11, §5).
 */
@Service()
export class PurchaseService {
    constructor(
        private readonly purchaseRepository: PurchaseRepository,
        private readonly organizationScopeService: OrganizationScopeService,
    ) {}

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<Purchase | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const purchase = await this.purchaseRepository.findOneVisible(scope, principalId, { id, deleted: false }, options);
        Log.debug(`[Purchase Service]: purchase (id ${id}) ${purchase ? "served" : "not visible"} to user (id ${principalId})`);
        return purchase;
    }

    public async paginate(
        principalId: number,
        query: PurchaseQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<Purchase>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.purchaseRepository.paginateVisible(
            scope,
            principalId,
            this.createQueryFromPayload(query),
            options,
        );
    }

    private createQueryFromPayload(payload: PurchaseQueryDTO): Prisma.PurchaseWhereInput {
        const query: Prisma.PurchaseWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(payload.buyerUserId, { buyerUserId: payload.buyerUserId }),
            // L'unico testo di un acquisto è il nome dei partecipanti sulle righe
            // dei suoi ordini: il `Json` si filtra con `string_contains`.
            createObjectWithoutThrow(payload.value, {
                orders: { some: { lines: { some: { attendees: { string_contains: payload.value ?? "" } } } } },
            }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
