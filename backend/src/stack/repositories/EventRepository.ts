import { Service } from "fastify-decorators";
import { Event, EventStatus, Prisma } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, organizationScopeWhere } from "@utils/helpers/organizationScope";

/** Stati che l'API pubblica del §4.5 può restituire — e nessun altro. */
export const PUBLICLY_VISIBLE_EVENT_STATUSES: EventStatus[] = [
    EventStatus.PUBLISHED,
    EventStatus.SALES_CLOSED,
];

@Service()
export class EventRepository extends BaseRepository<"event"> {
    constructor() {
        super("event");
    }

    async findBySlug(slug: string, options?: FindOptions, tx?: Prisma.TransactionClient): Promise<Event | null> {
        return this.findOne({ slug, deleted: false }, options, tx);
    }

    /**
     * Sorgente di `GET /api/public/events/:slug` (§4.5): senza autenticazione e
     * quindi senza scope di tenancy, ma ristretta ai soli stati pubblicabili.
     */
    async findPublishedBySlug(slug: string, options?: FindOptions, tx?: Prisma.TransactionClient): Promise<Event | null> {
        return this.findOne(
            { slug, deleted: false, status: { in: PUBLICLY_VISIBLE_EVENT_STATUSES } },
            options,
            tx,
        );
    }

    /**
     * Scheda evento pubblica completa (`RF-PUB-5`, `RF-PUB-6`): sessioni, cast,
     * titoli, requisiti, servizi, policy di rimborso, organizzatore.
     * I titoli `CODE_RESTRICTED` non compaiono: si sbloccano con il codice
     * (`RF-EVT-7`), non si leggono dalla scheda.
     */
    async findPublicCardBySlug(slug: string, tx?: Prisma.TransactionClient) {
        return this.exec(() =>
            this.getDelegate(tx).findFirst({
                where: { slug, deleted: false, status: { in: PUBLICLY_VISIBLE_EVENT_STATUSES } },
                include: {
                    organization: {
                        select: {
                            id: true,
                            name: true,
                            legalName: true,
                            website: true,
                            contactEmail: true,
                            logoFileId: true,
                        },
                    },
                    eventType: true,
                    venue: { include: { address: true } },
                    refundPolicy: true,
                    posterVerticalFile: true,
                    posterHorizontalFile: true,
                    posterSquareFile: true,
                    sessions: {
                        where: { deleted: false },
                        orderBy: [{ sortOrder: "asc" }, { startAt: "asc" }],
                    },
                    casts: {
                        where: { deleted: false },
                        include: { artist: true },
                        orderBy: { sortOrder: "asc" },
                    },
                    requirements: {
                        where: { deleted: false },
                        include: { requirementType: true },
                        orderBy: { sortOrder: "asc" },
                    },
                    services: {
                        where: { deleted: false },
                        orderBy: { sortOrder: "asc" },
                    },
                    ticketTypes: {
                        where: { deleted: false, visibility: "PUBLIC" },
                        include: {
                            sessions: true,
                            priceTiers: { orderBy: { sortOrder: "asc" } },
                        },
                        orderBy: { sortOrder: "asc" },
                    },
                },
            })
        );
    }

    async findByOrganization(organizationId: number, options?: FindOptions, tx?: Prisma.TransactionClient): Promise<Event[]> {
        return this.findMany({ organizationId, deleted: false }, options, tx);
    }

    /** Eventi in corso: è la lista da cui nasce il manifesto di check-in (§4.5). */
    async findRunningWithCheckIn(at: Date = new Date(), tx?: Prisma.TransactionClient): Promise<Event[]> {
        return this.findMany(
            {
                deleted: false,
                status: { in: [EventStatus.PUBLISHED, EventStatus.SALES_CLOSED, EventStatus.RUNNING] },
                startAt: { lte: at },
                endAt: { gte: at },
            },
            undefined,
            tx,
        );
    }

    /** §1.5 — lo scope di tenancy è obbligatorio e precede la query di dominio. */
    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.EventWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<Event | null> {
        return this.findOne({ AND: [query, organizationScopeWhere(scope)] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.EventWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<Event>> {
        return this.paginate({ AND: [query, organizationScopeWhere(scope)] }, options, tx);
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<Event> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
