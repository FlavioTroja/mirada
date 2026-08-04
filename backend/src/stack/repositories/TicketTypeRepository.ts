import { Service } from "fastify-decorators";
import { PriceTier, Prisma, TicketType, TicketTypeVisibility } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, relationOrganizationScopeWhere } from "@utils/helpers/organizationScope";

/** Titolo con l'elenco esplicito delle sessioni incluse e gli scaglioni di prezzo. */
export type TicketTypeWithSessions = TicketType & {
    sessions: { id: number; sessionId: number; ticketTypeId: number }[];
    priceTiers: PriceTier[];
};

@Service()
export class TicketTypeRepository extends BaseRepository<"ticketType"> {
    constructor() {
        super("ticketType");
    }

    async findByEvent(eventId: number, options?: FindOptions, tx?: Prisma.TransactionClient): Promise<TicketType[]> {
        return this.findMany({ eventId, deleted: false }, { ...options, orderBy: { sortOrder: "asc" } }, tx);
    }

    /** Sblocco di un titolo `CODE_RESTRICTED` (`RF-EVT-7`). */
    async findByAccessCode(accessCode: string, tx?: Prisma.TransactionClient): Promise<TicketType | null> {
        return this.findOne({ accessCode, deleted: false }, undefined, tx);
    }

    /** Titolo con l'elenco esplicito delle sessioni incluse (§4.7). */
    async findWithSessions(id: number, tx?: Prisma.TransactionClient): Promise<TicketTypeWithSessions | null> {
        return this.exec(() =>
            this.getDelegate(tx).findFirst({
                where: { id, deleted: false },
                include: { sessions: true, priceTiers: { orderBy: { sortOrder: "asc" } } },
            })
        ) as Promise<TicketTypeWithSessions | null>;
    }

    /**
     * Tutti i titoli dell'evento **con** l'elenco esplicito delle sessioni e gli
     * scaglioni, in **una sola query**.
     *
     * Esiste per `POST /api/public/events/:id/availability`, che il §7 D-H
     * dichiara «l'endpoint più interrogato in apertura vendite»: risolvere il
     * prezzo titolo per titolo costerebbe due query per titolo a ogni giro di
     * polling, moltiplicate per ogni visitatore anonimo della scheda.
     */
    async findWithSessionsAndTiersByEvent(
        eventId: number,
        onlyPublic = false,
        tx?: Prisma.TransactionClient,
    ): Promise<TicketTypeWithSessions[]> {
        return this.exec(() =>
            this.getDelegate(tx).findMany({
                where: {
                    eventId,
                    deleted: false,
                    ...(onlyPublic && { visibility: TicketTypeVisibility.PUBLIC }),
                },
                include: { sessions: true, priceTiers: { orderBy: { sortOrder: "asc" } } },
                orderBy: { sortOrder: "asc" },
            })
        ) as Promise<TicketTypeWithSessions[]>;
    }

    /** Titoli che includono la sessione indicata — base di `RF-EVT-24` e `RF-EVT-35`. */
    async findIncludingSession(sessionId: number, tx?: Prisma.TransactionClient): Promise<TicketType[]> {
        return this.findMany({ deleted: false, sessions: { some: { sessionId } } }, undefined, tx);
    }

    /** Titoli dell'evento che NON includono la sessione indicata (`RF-EVT-24`). */
    async findNotIncludingSession(eventId: number, sessionId: number, tx?: Prisma.TransactionClient): Promise<TicketType[]> {
        return this.findMany(
            { eventId, deleted: false, sessions: { none: { sessionId } } },
            { orderBy: { sortOrder: "asc" } },
            tx,
        );
    }

    /** §1.5 — lo scope passa dall'evento. */
    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.TicketTypeWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<TicketType | null> {
        return this.findOne({ AND: [query, relationOrganizationScopeWhere(scope, "event")] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.TicketTypeWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<TicketType>> {
        return this.paginate({ AND: [query, relationOrganizationScopeWhere(scope, "event")] }, options, tx);
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<TicketType> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
