import { Service } from "fastify-decorators";
import { Prisma, Ticket, TicketStatus } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, relationOrganizationScopeWhere } from "@utils/helpers/organizationScope";

/**
 * Biglietti che **esistono ancora come titolo**: sono questi a bloccare la
 * rimozione di una sessione da un titolo già venduto (§4.7) e a comparire nel
 * manifest di check-in.
 *
 * `TRANSFERRED` è compreso: un biglietto passato di mano è un biglietto vivo, e
 * l'eventuale rimozione di una sessione lederebbe il nuovo titolare esattamente
 * come avrebbe leso il primo.
 */
export const LIVE_TICKET_STATUSES: TicketStatus[] = [TicketStatus.VALID, TicketStatus.TRANSFERRED];

export type TicketWithContext = Prisma.TicketGetPayload<{
    include: {
        ticketType: { include: { sessions: true } };
        registration: true;
        event: true;
    };
}>;

@Service()
export class TicketRepository extends BaseRepository<"ticket"> {
    constructor() {
        super("ticket");
    }

    /**
     * La chiave di ricerca di `POST /tickets/verify`. Il `code` è unico su tutta
     * la piattaforma: la verifica non ha bisogno di sapere l'evento in anticipo, e
     * infatti `WRONG_EVENT` è uno dei cinque esiti proprio perché il biglietto si
     * trova comunque.
     */
    async findByCode(code: string, tx?: Prisma.TransactionClient): Promise<Ticket | null> {
        return this.findOne({ code, deleted: false }, undefined, tx);
    }

    /** Il biglietto con tutto ciò che serve a decidere un ingresso, in una query sola. */
    async findByCodeWithContext(code: string, tx?: Prisma.TransactionClient): Promise<TicketWithContext | null> {
        return this.exec(() =>
            this.getDelegate(tx).findFirst({
                where: { code, deleted: false },
                include: {
                    ticketType: { include: { sessions: true } },
                    registration: true,
                    event: true,
                },
            }),
        ) as Promise<TicketWithContext | null>;
    }

    async findByIdWithContext(id: number, tx?: Prisma.TransactionClient): Promise<TicketWithContext | null> {
        return this.exec(() =>
            this.getDelegate(tx).findFirst({
                where: { id, deleted: false },
                include: {
                    ticketType: { include: { sessions: true } },
                    registration: true,
                    event: true,
                },
            }),
        ) as Promise<TicketWithContext | null>;
    }

    /** Tutti i biglietti vivi di un evento, con il contesto: è la sorgente del manifest (`RF-CHK-2`). */
    async findLiveByEventWithContext(eventId: number, tx?: Prisma.TransactionClient): Promise<TicketWithContext[]> {
        return this.exec(() =>
            this.getDelegate(tx).findMany({
                where: { eventId, deleted: false, status: { in: LIVE_TICKET_STATUSES } },
                include: {
                    ticketType: { include: { sessions: true } },
                    registration: true,
                    event: true,
                },
                orderBy: { id: "asc" },
            }),
        ) as Promise<TicketWithContext[]>;
    }

    async findByEvent(eventId: number, tx?: Prisma.TransactionClient): Promise<Ticket[]> {
        return this.findMany({ eventId, deleted: false }, { orderBy: { id: "asc" } }, tx);
    }

    async findByRegistration(registrationId: number, tx?: Prisma.TransactionClient): Promise<Ticket[]> {
        return this.findMany({ registrationId, deleted: false }, { orderBy: { id: "asc" } }, tx);
    }

    /**
     * Il conteggio su cui si regge il presidio del §4.7: *non si rimuove una
     * sessione da un titolo con biglietti emessi*.
     */
    async countLiveByTicketType(ticketTypeId: number, tx?: Prisma.TransactionClient): Promise<number> {
        return this.count(
            { ticketTypeId, deleted: false, status: { in: LIVE_TICKET_STATUSES } },
            tx,
        );
    }

    async countLiveByEvent(eventId: number, tx?: Prisma.TransactionClient): Promise<number> {
        return this.count({ eventId, deleted: false, status: { in: LIVE_TICKET_STATUSES } }, tx);
    }

    /** §1.5 — lo scope passa dall'evento: `Ticket` non porta `organizationId`. */
    /**
     * §1.5 su un'entità a **due proprietari**, esattamente come `Order`: il
     * biglietto è al tempo stesso una riga dell'organizzazione che lo ha emesso
     * e **il biglietto di una persona**.
     *
     * Prima la visibilità passava solo per l'organizzazione, e la conseguenza
     * era che un ballerino non vedeva il **proprio** biglietto: lo scope di un
     * `DANCER` è vuoto, quindi `POST /tickets/:id/transfer` rispondeva «non
     * trovato» proprio a chi la rotta esiste per servire. Il trasferimento del
     * nominativo (`RF-TCK`) era di fatto riservato al Super Admin.
     *
     * La forma è quella già collaudata su `OrderRepository.visibilityWhere`, e
     * non è un caso: il problema è lo stesso e merita la stessa soluzione.
     */
    static visibilityWhere(scope: OrganizationScope, userId: number): Prisma.TicketWhereInput {
        const own: Prisma.TicketWhereInput = { registration: { personUserId: userId } };
        if (scope === null) {
            return {};
        }
        if (!scope.length) {
            return own;
        }
        return { OR: [own, { event: { organizationId: { in: scope } } }] };
    }

    /** Visibilità **di sola organizzazione** — per i percorsi di back-office. */
    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.TicketWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<Ticket | null> {
        return this.findOne({ AND: [query, relationOrganizationScopeWhere(scope, "event")] }, options, tx);
    }

    /** Visibilità completa: l'organizzazione **oppure** il proprio biglietto. */
    async findOneVisible(
        scope: OrganizationScope,
        userId: number,
        query: Prisma.TicketWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<Ticket | null> {
        return this.findOne({ AND: [query, TicketRepository.visibilityWhere(scope, userId)] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.TicketWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<Ticket>> {
        return this.paginate({ AND: [query, relationOrganizationScopeWhere(scope, "event")] }, options, tx);
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<Ticket> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
