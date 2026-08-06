import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, GET, POST } from "fastify-decorators";
import { z } from "zod";
import { EventService } from "@services/EventService";
import { TicketTypeService } from "@services/TicketTypeService";
import { TicketTypeUnlockDTO, TicketTypeUnlockSchema } from "@DTOs/ticket_type/TicketTypeUnlockDTO";
import { CapacityEngineService } from "@services/CapacityEngineService";
import { rateLimit } from "@utils/adapters/rateLimit";
import {
    EventAvailabilityRequestDTO,
    EventAvailabilityRequestSchema,
} from "@DTOs/availability/EventAvailabilityDTO";
import { PublicEventSearchService } from "@services/PublicEventSearchService";
import {
    PublicEventSearchDTO,
    PublicEventSearchSchema,
} from "@DTOs/public_event/PublicEventSearchDTO";

const SlugParamSchema = z.object({
    slug: z.string().min(1).describe("Event slug — globally unique"),
});

/**
 * Superficie pubblica del §3.7 — **senza autenticazione**, consumata dall'app
 * `www` in SSR e dal polling.
 *
 * Nessuna rotta porta `Authenticate()` né `HasPermission(...)`: è deliberato e non
 * va "corretto". La restrizione non è di permesso ma **di stato**: si
 * restituiscono solo eventi `PUBLISHED` o `SALES_CLOSED` (§4.5), e i titoli
 * `CODE_RESTRICTED` restano fuori dalla scheda finché non si presenta il codice.
 *
 * `POST /api/public/events/:id/availability` è la proiezione del motore di
 * capienza ed è **la sorgente del polling a 10–15 s** del pubblico anonimo, che
 * non ha WebSocket (§7 D-H). È l'endpoint più interrogato del sistema in apertura
 * vendite: per questo costa tre query e porta un **rate limiting** dichiarato.
 */
@Controller({
    route: "/public",
    tags: [{ name: "Public", description: "Unauthenticated public surface" }],
})
export class PublicController {
    constructor(
        private readonly eventService: EventService,
        private readonly ticketTypeService: TicketTypeService,
        private readonly capacityEngineService: CapacityEngineService,
        private readonly publicEventSearchService: PublicEventSearchService,
    ) {}

    /**
     * **La ricerca pubblica** (§3.7) — `POST /{plural}/` è la lista nel dialetto
     * §3.2, e la lista pubblica non fa eccezione.
     *
     * Il **rate limiting** è lo stesso presidio dell'endpoint di disponibilità e
     * per la stessa ragione: la rotta è pubblica, anonima, e in SSR ogni
     * visitatore ne è un chiamante. Il limite è però più stretto (dodici al
     * minuto contro trenta) perché qui **non c'è polling**: una ricerca è un atto
     * dell'utente, non un timer, e dodici ricerche al minuto sono già più di
     * quante una persona ne faccia. La query costa anche di più — full-text sul
     * cast e quote di capienza — quindi vale meno lasciarla correre.
     */
    @POST("/events/", {
        schema: {
            operationId: "searchPublicEvents",
            summary: "Search the published events",
            description: "Paginated public search over PUBLISHED events whose sales are still open. 'value' is full-text on title, description, venue name and cast names; 'from'/'to' filter on the OVERLAP with the event interval, so a festival already under way still shows up; 'role' restricts to the events that still have headroom for that dance role (RF-PUB-2). No authentication, rate limited.",
            body: PublicEventSearchSchema,
        },
        onRequest: [
            rateLimit({ name: "public-event-search", max: 12, windowMs: 60_000 }),
        ],
    })
    async search(
        req: FastifyRequest<{ Body: PublicEventSearchDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body;
        reply.status(200).send(await this.publicEventSearchService.search(query, options));
    }

    @GET("/events/:slug", {
        schema: {
            operationId: "findPublicEventBySlug",
            summary: "Get the public event card",
            description: "Returns the full public event card — sessions, cast, ticket types, requirements, services, refund policy and organizer — for PUBLISHED or SALES_CLOSED events only (RF-PUB-5, RF-PUB-6). No authentication.",
            params: SlugParamSchema,
        },
    })
    async getBySlug(
        req: FastifyRequest<{ Params: { slug: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventService.findPublicBySlug(req.params.slug));
    }

    /**
     * **La sorgente del polling** della scheda evento pubblica (`RF-PUB-8`,
     * `RF-EVT-26`).
     *
     * Il rate limiting non è una precauzione generica: con il polling a 10–15 s
     * dichiarato in §7 D-H, un client con l'intervallo sbagliato — o un solo
     * scraper — basta a saturare il pool di connessioni proprio nel minuto in cui
     * si vendono i biglietti. Trenta richieste al minuto per indirizzo lasciano
     * ampio margine al polling legittimo (4–6/minuto) e fermano il resto.
     */
    @POST("/events/:id/availability", {
        schema: {
            operationId: "getPublicEventAvailability",
            summary: "Get the live availability of an event",
            description: "Per-ticket-type and per-role availability plus the active price tier. Source of the 10-15s polling of the public event page (RF-PUB-8). No authentication, rate limited. Reserved quotas (complimentary, external channels) are subtracted from online sales and never appear here.",
            params: z.object({ id: z.string().describe("Must follow id") }),
            body: EventAvailabilityRequestSchema.optional(),
        },
        onRequest: [
            rateLimit({ name: "public-availability", max: 30, windowMs: 60_000 }),
        ],
    })
    async getAvailability(
        req: FastifyRequest<{ Params: { id: string }, Body?: EventAvailabilityRequestDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(
            await this.capacityEngineService.availability(+req.params.id, req.body?.role ?? null),
        );
    }

    @POST("/ticket-types/:id/unlock", {
        schema: {
            operationId: "unlockPublicTicketType",
            summary: "Unlock a CODE_RESTRICTED ticket type",
            description: "Reveals a code-restricted ticket type when the access code matches (RF-EVT-7). No authentication.",
            params: z.object({ id: z.string().describe("Must follow id") }),
            body: TicketTypeUnlockSchema,
        },
    })
    async unlockTicketType(
        req: FastifyRequest<{ Params: { id: string }, Body: TicketTypeUnlockDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.ticketTypeService.unlockByAccessCode(+req.params.id, req.body.accessCode));
    }
}
