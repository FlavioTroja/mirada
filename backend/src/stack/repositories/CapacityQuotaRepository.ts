import { Service } from "fastify-decorators";
import { CapacityQuota, DanceRole, Prisma, QuotaScope } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { getPrismaClient } from "@utils/adapters/prisma";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, relationOrganizationScopeWhere } from "@utils/helpers/organizationScope";

/** Coordinate di identità di una quota — la terna unica del `05` §2.1. */
export type QuotaIdentity = {
    scope: QuotaScope;
    scopeId: number | null;
    role: DanceRole | null;
};

@Service()
export class CapacityQuotaRepository extends BaseRepository<"capacityQuota"> {
    constructor() {
        super("capacityQuota");
    }

    /**
     * Tutte le quote dell'evento, **ordinate per id crescente**.
     *
     * L'ordinamento non è cosmetico: è l'ordine in cui il motore tocca i
     * contatori ed è **l'unica difesa contro i deadlock** quando due ordini
     * toccano lo stesso insieme di quote in ordine diverso (§4.8 nota 1).
     */
    async findByEvent(eventId: number, tx?: Prisma.TransactionClient): Promise<CapacityQuota[]> {
        return this.findMany({ eventId, deleted: false }, { orderBy: { id: "asc" } }, tx);
    }

    /**
     * `findApplicable(eventId, scopeIds[], role)` (§4.8) — le quote candidate a
     * un'iscrizione, in un solo giro di database.
     *
     * Restituisce, sempre ordinate per id crescente:
     *  - le quote di ambito `EVENT` (capienza della sala, ruoli, contingenti riservati);
     *  - le quote di `SESSION` / `TICKET_TYPE` / `SERVICE` il cui `scopeId` è fra quelli indicati.
     *
     * La selezione fine — quali di queste si applicano davvero — è del servizio:
     * il repository non conosce il canale di vendita né gli accrediti.
     */
    async findApplicable(
        eventId: number,
        scopeIds: { sessionIds?: number[]; ticketTypeIds?: number[]; serviceIds?: number[] },
        tx?: Prisma.TransactionClient,
    ): Promise<CapacityQuota[]> {
        const branches: Prisma.CapacityQuotaWhereInput[] = [{ scope: QuotaScope.EVENT }];

        if (scopeIds.sessionIds?.length) {
            branches.push({ scope: QuotaScope.SESSION, scopeId: { in: scopeIds.sessionIds } });
        }
        if (scopeIds.ticketTypeIds?.length) {
            branches.push({ scope: QuotaScope.TICKET_TYPE, scopeId: { in: scopeIds.ticketTypeIds } });
        }
        if (scopeIds.serviceIds?.length) {
            branches.push({ scope: QuotaScope.SERVICE, scopeId: { in: scopeIds.serviceIds } });
        }

        return this.findMany(
            { eventId, deleted: false, OR: branches },
            { orderBy: { id: "asc" } },
            tx,
        );
    }

    /** La quota che porta esattamente quella identità, o `null` se non è configurata. */
    async findByIdentity(
        eventId: number,
        identity: QuotaIdentity,
        tx?: Prisma.TransactionClient,
    ): Promise<CapacityQuota | null> {
        return this.findOne(
            {
                eventId,
                deleted: false,
                scope: identity.scope,
                scopeId: identity.scopeId,
                role: identity.role,
            },
            undefined,
            tx,
        );
    }

    /**
     * **L'AGGIORNAMENTO CONDIZIONATO** — il cuore del motore (§4.8, `05` §5).
     *
     * ```sql
     * UPDATE "CapacityQuota"
     *    SET consumed = consumed + :quantity
     *  WHERE id = :id
     *    AND consumed + :quantity <= "limit" + "overbookAllowance"
     * ```
     *
     * Restituisce **il numero di righe toccate**: `0` significa esaurito.
     *
     * Verifica e impegno sono **una sola operazione**. Non va sostituito da un
     * `SELECT` seguito da un `UPDATE` per nessun motivo: leggere prima e scrivere
     * dopo è la modalità con cui si vendono posti inesistenti. Sotto
     * `READ COMMITTED` PostgreSQL, quando due transazioni colpiscono la stessa
     * riga, la seconda attende il rilascio del lock e **rivaluta la condizione
     * sulla versione aggiornata**: è ciò che rende esatto il caso T23 (cinquanta
     * acquisti simultanei su dieci posti).
     *
     * `updatedAt` è scritto a mano perché `@updatedAt` di Prisma è client-side e
     * non arriva su una query grezza.
     */
    async lockAndIncrement(quotaId: number, quantity: number, tx?: Prisma.TransactionClient): Promise<number> {
        const client = tx ?? getPrismaClient();
        return this.exec(() =>
            client.$executeRaw`
                UPDATE "CapacityQuota"
                   SET "consumed" = "consumed" + ${quantity},
                       "updatedAt" = NOW()
                 WHERE "id" = ${quotaId}
                   AND "consumed" + ${quantity} <= "limit" + "overbookAllowance"
            `
        );
    }

    /**
     * Incremento **incondizionato**, per le quote `limiting = false`: contano i
     * posti e **non bloccano** la vendita (`05` §3). Il contatore può quindi
     * superare il limite, ed è esattamente ciò che il caso T11 pretende — il
     * cruscotto lo segnala, la vendita prosegue.
     *
     * È anche la strada dell'emissione manuale di pass, mai bloccata dalle quote
     * (`RB20`).
     */
    async incrementUnconditionally(quotaId: number, quantity: number, tx?: Prisma.TransactionClient): Promise<number> {
        const client = tx ?? getPrismaClient();
        return this.exec(() =>
            client.$executeRaw`
                UPDATE "CapacityQuota"
                   SET "consumed" = "consumed" + ${quantity},
                       "updatedAt" = NOW()
                 WHERE "id" = ${quotaId}
            `
        );
    }

    /**
     * Decremento del rilascio (`05` §8). Il chiamante ha già letto i
     * `QuotaConsumption` dell'iscrizione: qui si decrementa **esattamente quel**
     * contatore, mai «a occhio».
     *
     * `GREATEST(..., 0)` non è una licenza ad arrotondare: è la rete che impedisce
     * a una deriva di diventare un contatore negativo, che il vincolo di tabella
     * `CapacityQuota_consumed_non_negative` rifiuterebbe comunque.
     */
    async decrement(quotaId: number, quantity: number, tx?: Prisma.TransactionClient): Promise<number> {
        const client = tx ?? getPrismaClient();
        return this.exec(() =>
            client.$executeRaw`
                UPDATE "CapacityQuota"
                   SET "consumed" = GREATEST("consumed" - ${quantity}, 0),
                       "updatedAt" = NOW()
                 WHERE "id" = ${quotaId}
            `
        );
    }

    /** §1.5 — lo scope passa dall'evento: `CapacityQuota` non porta `organizationId`. */
    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.CapacityQuotaWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<CapacityQuota | null> {
        return this.findOne({ AND: [query, relationOrganizationScopeWhere(scope, "event")] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.CapacityQuotaWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<CapacityQuota>> {
        return this.paginate({ AND: [query, relationOrganizationScopeWhere(scope, "event")] }, options, tx);
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<CapacityQuota> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
