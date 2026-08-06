import { Service } from "fastify-decorators";
import { Event, EventStatus, Prisma } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, organizationScopeWhere } from "@utils/helpers/organizationScope";

/** Stati che l'API pubblica del §4.5 può restituire — e nessun altro. */
export const PUBLICLY_VISIBLE_EVENT_STATUSES: EventStatus[] = [
    EventStatus.PUBLISHED,
    EventStatus.SALES_CLOSED,
];

/** Riga grezza della ricerca pubblica: ciò che la card del §3.7 disegna, e nulla più. */
export type PublicEventSearchRow = Prisma.EventGetPayload<{
    include: {
        organization: { select: { id: true, name: true } };
        eventType: { select: { id: true, slug: true, name: true } };
        venue: { select: { id: true, name: true, address: true } };
        posterVerticalFile: { select: { url: true } };
        ticketTypes: {
            select: {
                id: true,
                basePrice: true,
                saleOpensAt: true,
                saleClosesAt: true,
                priceTiers: true,
            };
        };
    };
}>;

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
                        include: {
                            // `artist: true` porta i soli campi scalari, e fra
                            // questi c'è `photoFileId` — un **id**, da cui
                            // nessun client può ricavare un URL. La scheda
                            // pubblica mostrava quindi le iniziali anche per gli
                            // artisti a cui l'organizzatore aveva caricato la
                            // foto: il dato c'era a database e non usciva
                            // dall'API. Le locandine dell'evento, poco più
                            // sopra, erano già incluse per esteso: qui mancava.
                            //
                            // Del file si estrae **solo `url`**: il resto
                            // (nome originale, dimensione, mime, chi l'ha
                            // caricato) è metadato di gestione e non ha ragione
                            // di comparire su un endpoint senza autenticazione.
                            artist: { include: { photoFile: { select: { url: true } } } },
                        },
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

    /**
     * `POST /api/public/events/` — **la ricerca pubblica paginata** (§3.7).
     *
     * ── Una query per pagina, non una per riga ───────────────────────────────
     * Il `value` full-text deve pescare anche nei **nomi del cast**, che è una
     * relazione: la si attraversa con `casts.some(artist.name contains …)`, cioè
     * un `EXISTS` correlato che PostgreSQL risolve dentro la stessa `SELECT`.
     * Il pericolo qui non è teorico — un giro di `findMany` per evento
     * trasformerebbe una pagina da dieci righe in undici query, sull'endpoint
     * che l'app `www` chiama in SSR a ogni ricerca.
     *
     * Le relazioni incluse sono **solo** quelle che la card disegna (§3.7):
     * tipo evento, location con indirizzo, organizzazione, locandina verticale e
     * i titoli **pubblici** con i loro scaglioni per il «da €». Niente sessioni,
     * niente cast, niente requisiti: quelli sono la scheda completa
     * (`GET /api/public/events/:slug`), non la riga di un elenco.
     *
     * `BaseRepository.paginate` non accetta un `include`, e questo finder ne ha
     * bisogno: la paginazione è quindi riscritta qui **con la stessa forma di
     * `PaginateDatasourceDTO`** del §3.3, nessun campo in più e nessuno in meno.
     */
    async searchPublicCards(
        where: Prisma.EventWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<PublicEventSearchRow>> {
        const limit = options.limit ?? 10;
        const page = options.page ?? 1;

        return this.exec(async () => {
            const docs = await this.getDelegate(tx).findMany({
                where,
                include: {
                    organization: { select: { id: true, name: true } },
                    eventType: { select: { id: true, slug: true, name: true } },
                    venue: { select: { id: true, name: true, address: true } },
                    posterVerticalFile: { select: { url: true } },
                    ticketTypes: {
                        where: { deleted: false, visibility: "PUBLIC" },
                        select: {
                            id: true,
                            basePrice: true,
                            saleOpensAt: true,
                            saleClosesAt: true,
                            priceTiers: { orderBy: { sortOrder: "asc" } },
                        },
                    },
                },
                // Ordinamento di serie: il prossimo evento per primo. È ciò che
                // un elenco di eventi significa quando nessuno chiede altro.
                orderBy: this.searchOrderBy(options.sort),
                skip: (page - 1) * limit,
                take: limit,
            });

            const totalDocs = await this.getDelegate(tx).count({ where });
            const totalPages = Math.ceil(totalDocs / limit) || 0;

            return {
                docs: docs as unknown as PublicEventSearchRow[],
                totalDocs,
                totalPages,
                page,
                limit,
                hasPrevPage: page > 1,
                hasNextPage: page < totalPages,
                prevPage: page > 1 ? page - 1 : 0,
                nextPage: page < totalPages ? page + 1 : 0,
            };
        });
    }

    private searchOrderBy(sort?: Record<string, string>): Prisma.EventOrderByWithRelationInput[] {
        const entries = Object.entries(sort ?? {});
        if (!entries.length) {
            return [{ startAt: "asc" }, { id: "asc" }];
        }
        return entries.map(([field, direction]) => ({
            [field]: direction === "desc" ? "desc" : "asc",
        })) as Prisma.EventOrderByWithRelationInput[];
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

    /**
     * Gli id degli eventi il cui **testo** contiene `value`, senza distinzione fra
     * maiuscole e minuscole.
     *
     * ── Perché una query grezza e non un `where` di Prisma ────────────────────
     * `title`, `description` e i nomi di sessioni e titoli sono campi **`Json`**
     * (`I18nText`), e il filtro `string_contains` di Prisma sui percorsi JSON
     * **non accetta `mode: "insensitive"`**: è sensibile alle maiuscole e non c'è
     * modo di renderlo altrimenti dall'API tipizzata. Il risultato era che
     * «Piazzolla» trovava il festival e «piazzolla» no — e «trani» non trovava
     * Trani. In un campo di ricerca nessuno scrive con la maiuscola.
     *
     * Le colonne normali — nome della location, nome dell'artista — non hanno il
     * problema, ed è per questo che il difetto si vedeva solo su alcune parole.
     *
     * ── Costo ────────────────────────────────────────────────────────────────
     * **Una** query che restituisce soli id, poi usati come `id IN (…)`. Non è
     * una query per riga: è la stessa forma della pre-query delle quote che il
     * servizio già esegue. Per un catalogo grande la strada giusta sarà un
     * indice full-text (`tsvector`), ma richiede una colonna materializzata e
     * un trigger: `ILIKE` è la scelta corretta finché gli eventi sono migliaia.
     */
    async findIdsMatchingText(value: string, tx?: Prisma.TransactionClient): Promise<number[]> {
        const needle = `%${value}%`;
        return this.exec(async () => {
            const rows = await (tx ?? getPrismaClient()).$queryRaw<{ id: number }[]>`
                SELECT DISTINCT e."id"
                  FROM "Event" e
                  LEFT JOIN "Venue"        v  ON v."id" = e."venueId"
                  LEFT JOIN "EventCast"    ec ON ec."eventId" = e."id" AND ec."deleted" = false
                  LEFT JOIN "Artist"       a  ON a."id" = ec."artistId"
                  LEFT JOIN "Session"      s  ON s."eventId" = e."id" AND s."deleted" = false
                                                 AND s."cancelledAt" IS NULL
                  LEFT JOIN "TicketType"   tt ON tt."eventId" = e."id" AND tt."deleted" = false
                                                 AND tt."visibility" = 'PUBLIC'
                 WHERE e."deleted" = false
                   AND (
                        e."title"       ->> 'it' ILIKE ${needle}
                     OR e."title"       ->> 'en' ILIKE ${needle}
                     OR e."description" ->> 'it' ILIKE ${needle}
                     OR e."description" ->> 'en' ILIKE ${needle}
                     OR v."name"                 ILIKE ${needle}
                     OR a."name"                 ILIKE ${needle}
                     OR s."name"        ->> 'it' ILIKE ${needle}
                     OR s."name"        ->> 'en' ILIKE ${needle}
                     OR tt."name"       ->> 'it' ILIKE ${needle}
                     OR tt."name"       ->> 'en' ILIKE ${needle}
                   )
            `;
            return rows.map(r => r.id);
        });
    }
}
