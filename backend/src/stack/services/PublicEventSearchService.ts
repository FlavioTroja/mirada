import { Service } from "fastify-decorators";
import { CapacityQuota, DanceRole, EventStatus, EventTypeFamily, Prisma, QuotaScope, TicketTypeVisibility } from "@prisma/client";
import { Log } from "@utils/adapters/log";
import { PaginateOptions } from "@utils/helpers/exz";
import { selectActiveTier } from "@utils/helpers/priceTier";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { EventRepository, PublicEventSearchRow } from "@repositories/EventRepository";
import { CapacityQuotaRepository } from "@repositories/CapacityQuotaRepository";
import { CapacityEngineService } from "@services/CapacityEngineService";
import { PublicEventQueryDTO } from "@DTOs/public_event/PublicEventSearchDTO";
import { PublicEventCardDTO } from "@DTOs/public_event/PublicEventCardDTO";
import { I18nText } from "@utils/helpers/i18nText";

/**
 * # `POST /api/public/events/` — la ricerca pubblica (backend-brief §3.7)
 *
 * Paginata, **senza autenticazione**, consumata dall'app `www` in SSR.
 * Restituisce **solo** eventi `PUBLISHED` con vendita aperta.
 *
 * ── I tre punti su cui il comportamento di serie non basta ───────────────────
 *
 * **1. `value` è full-text anche sul cast**, che è una relazione. Si attraversa
 * con un `some` — un `EXISTS` correlato, dentro la stessa `SELECT` — mai con un
 * giro di query per evento: una pagina da dieci righe deve costare **due query**
 * (righe + conteggio), non undici.
 *
 * **2. `from`/`to` filtrano sulla SOVRAPPOSIZIONE con l'intervallo dell'evento.**
 * Due intervalli `[a,b]` e `[c,d]` si sovrappongono quando `a <= d && b >= c`, e
 * la traduzione è `startAt <= to && endAt >= from`. Filtrare su `startAt` — che è
 * ciò che si scrive per distrazione — farebbe **sparire un festival di quattro
 * settimane dalla ricerca «questa settimana» proprio mentre è in corso**, cioè
 * nell'unico momento in cui qualcuno lo cerca davvero.
 *
 * **3. `role` restringe a ciò che ha ancora capienza PER QUEL RUOLO** — è la
 * ricerca che un tanghero fa davvero (`RF-PUB-2`). Un evento pieno di follower e
 * aperto ai leader deve comparire a un leader e **non** a una follower. La
 * decisione non è un conteggio inventato qui dentro: sono le stesse due regole
 * del motore di capienza —
 *   - `headroom(quota) = limit + overbookAllowance − consumed` sulle quote
 *     limitanti di ambito evento (sala e ruolo);
 *   - `evaluateToleranceGate`, che è **letteralmente la funzione del motore**,
 *     chiamata su una richiesta di una unità di quel ruolo.
 * Un `ROLE_ON_HOLD` non è un esaurito: è un blocco temporaneo (§3.3). Ma per chi
 * cerca *adesso* un evento in cui iscriversi *adesso*, la differenza non c'è —
 * la card non è vendibile a quel ruolo in questo momento, e resta fuori. Lo
 * `soldOut` della card la distingue comunque, e la scheda completa la spiega.
 *
 * ── Costo totale ─────────────────────────────────────────────────────────────
 * Tre query per pagina: le quote di ambito evento dei candidati (solo se `role`
 * è dato o serve la disponibilità sintetica), le righe, il conteggio. Nessuna
 * query per riga, mai.
 */
@Service()
export class PublicEventSearchService {
    constructor(
        private readonly eventRepository: EventRepository,
        private readonly capacityQuotaRepository: CapacityQuotaRepository,
        private readonly capacityEngineService: CapacityEngineService,
    ) {}

    public async search(
        query: PublicEventQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<PublicEventCardDTO>> {
        const now = new Date();
        const base = await this.buildWhere(query, now);

        // ── Le quote di ambito evento dei candidati, in UNA query ────────────
        // Servono per due cose insieme: escludere gli eventi senza capienza per
        // il ruolo cercato, e comporre la disponibilità sintetica di ogni card.
        // Caricarle una volta sola è ciò che tiene la pagina a costo costante.
        const eventQuotas = await this.capacityQuotaRepository.findEventScopeQuotasForEvents(base);
        const quotasByEvent = this.groupByEvent(eventQuotas);

        let where: Prisma.EventWhereInput = base;

        if (query.role) {
            const excluded = this.eventsWithoutRoomForRole(quotasByEvent, query.role);
            if (excluded.length) {
                where = { AND: [base, { id: { notIn: excluded } }] };
            }
            Log.info(
                `[PublicEventSearch Service]: role facet ${query.role} excludes ${excluded.length} event(s) `
                + "with no headroom for that dance role (RF-PUB-2)",
            );
        }

        const page = await this.eventRepository.searchPublicCards(where, options);

        Log.info(
            `[PublicEventSearch Service]: public search returned ${page.docs.length} of ${page.totalDocs} event(s) `
            + `— page ${page.page}/${page.totalPages || 1}, facets: ${this.describeFacets(query)}`,
        );

        return {
            ...page,
            docs: page.docs.map(row => this.toCard(row, quotasByEvent.get(row.id) ?? [], now)),
        };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Il filtro
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * ── «`PUBLISHED` con vendita aperta», e cosa significa esattamente ───────
     *
     * Il §3.7 è netto sullo stato: **solo `PUBLISHED`**. `SALES_CLOSED` — che
     * l'endpoint della scheda singola ammette (§4.5) — resta fuori: una card in
     * un elenco di eventi acquistabili che non si può acquistare è una promessa
     * mancata.
     *
     * A questo si aggiungono due condizioni di fatto:
     *  - `salesCloseAt` nullo o **futuro**: è il criterio `DATE` di `RF-EVT-40`
     *    letto sul dato, senza attendere che qualcuno esegua la transizione;
     *  - `endAt >= adesso`: un evento **finito** non è in vendita, qualunque cosa
     *    dica il suo stato.
     *
     * ── Ciò che deliberatamente NON si applica ───────────────────────────────
     * Il criterio `EVENT_START` di `RF-EVT-40` («la vendita chiude all'inizio»)
     * **non** è tradotto in un `startAt > adesso`, e la scelta va dichiarata
     * perché è una tensione interna al brief: lo stesso §3.7 prescrive che un
     * **festival già iniziato compaia** in una ricerca «questa settimana», e le
     * due cose non possono essere entrambe vere. Vince la prescrizione esplicita
     * della ricerca. La chiusura per `EVENT_START` resta dov'era: nella
     * transizione di stato di `EventService.closeSales`, che porta l'evento a
     * `SALES_CLOSED` — e a quel punto la card esce dall'elenco per via dello
     * stato, non per via di una data.
     */
    private async buildWhere(query: PublicEventQueryDTO, now: Date): Promise<Prisma.EventWhereInput> {
        const conditions: Prisma.EventWhereInput[] = [
            { deleted: false },
            { status: EventStatus.PUBLISHED },
            { OR: [{ salesCloseAt: null }, { salesCloseAt: { gt: now } }] },
            { endAt: { gte: now } },
            // ── I corsi non stanno sul sito pubblico ─────────────────────────
            // Decisione del 4 settembre 2026: un corso trimestrale si compila in
            // segreteria, e la sua iscrizione non passa dal checkout. Una scheda
            // pubblica prometterebbe un acquisto che non esiste — e la promessa
            // si scopre rotta nel punto peggiore, cioè quando qualcuno ci prova.
            //
            // Il filtro sta QUI e non su una capacità del tipo perché la
            // famiglia è il dato che dice dove una cosa vive; se domani un corso
            // dovrà comparire, si cambia la famiglia di quel tipo e non questa
            // riga.
            { eventType: { family: EventTypeFamily.EVENT } },
        ];

        // Il filtro testuale non è un `OR` di `where`: i campi `title`,
        // `description` e i nomi di sessioni e titoli sono `Json`, e il
        // `string_contains` di Prisma sui percorsi JSON **è sensibile alle
        // maiuscole** — «Piazzolla» trovava il festival, «piazzolla» no, e
        // «trani» non trovava Trani. La ricerca passa quindi da una query di soli
        // id con `ILIKE` (`EventRepository.findIdsMatchingText`), che copre in un
        // colpo titolo, descrizione, location, cast, **programma** e titoli
        // d'ingresso — in un festival le parole che una persona cerca stanno nel
        // programma, non nel titolo dell'evento.
        if (query.value) {
            const ids = await this.eventRepository.findIdsMatchingText(query.value);
            conditions.push({ id: { in: ids } });
        }

        // Geografia: passa dalla location, che è dove l'indirizzo vive.
        // `region` è **derivata e indicizzata** (§3.4): è per questo che il filtro
        // per regione è una condizione e non un calcolo.
        const address: Prisma.AddressWhereInput = {};
        if (query.city) address.city = { equals: query.city, mode: "insensitive" };
        if (query.province) address.province = { equals: query.province, mode: "insensitive" };
        if (query.region) address.region = { equals: query.region, mode: "insensitive" };
        if (query.country) address.country = { equals: query.country, mode: "insensitive" };
        if (Object.keys(address).length) {
            conditions.push({ venue: { address } });
        }

        if (query.eventTypeId) {
            conditions.push({ eventTypeId: query.eventTypeId });
        }

        // SOVRAPPOSIZIONE, non `startAt`: `[startAt, endAt] ∩ [from, to] ≠ ∅`.
        if (query.to) {
            conditions.push({ startAt: { lte: query.to } });
        }
        if (query.from) {
            conditions.push({ endAt: { gte: query.from } });
        }

        return { AND: conditions };
    }

    /**
     * Gli eventi che **non** hanno più posto per quel ruolo, e che quindi escono
     * dai risultati. Due cause, entrambe del motore di capienza:
     *  - una quota **limitante** di ambito evento senza residuo — la sala piena o
     *    il ruolo esaurito;
     *  - il **cancello di tolleranza** chiuso per quel ruolo, valutato con la
     *    funzione del motore su una richiesta di una unità.
     *
     * **Assenza di quota è assenza di vincolo** (`05` §4): un evento senza quote
     * configurate compare a chiunque, e non è un caso d'errore.
     */
    private eventsWithoutRoomForRole(
        quotasByEvent: Map<number, CapacityQuota[]>,
        role: DanceRole,
    ): number[] {
        const excluded: number[] = [];

        for (const [eventId, quotas] of quotasByEvent) {
            // Le quote riservate (accrediti, canali esterni) sono sottratte alla
            // vendita online e non descrivono la disponibilità pubblica (`05` §2.1).
            const online = quotas.filter(q => q.reservedFor === null);

            const applicable = online.filter(q =>
                q.limiting && (q.role === null || q.role === role),
            );
            const saturated = applicable.some(q => this.headroom(q) <= 0);

            const gate = this.capacityEngineService.evaluateToleranceGate(online, {
                leader: role === DanceRole.LEADER ? 1 : 0,
                follower: role === DanceRole.FOLLOWER ? 1 : 0,
            });

            if (saturated || !gate.passes) {
                excluded.push(eventId);
            }
        }

        return excluded;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // La card
    // ═════════════════════════════════════════════════════════════════════════

    private toCard(row: PublicEventSearchRow, quotas: CapacityQuota[], now: Date): PublicEventCardDTO {
        const online = quotas.filter(q => q.reservedFor === null);
        const room = online.find(q => q.role === null);
        const leader = online.find(q => q.role === DanceRole.LEADER);
        const follower = online.find(q => q.role === DanceRole.FOLLOWER);

        // «da €»: minimo fra i titoli pubblici **in vendita adesso**, valutato con
        // `selectActiveTier` — la stessa funzione che blocca il prezzo in
        // checkout. Due implementazioni diverse produrrebbero prima o poi un
        // elenco che promette un prezzo che il carrello non conferma.
        const prices = row.ticketTypes
            .filter(ticketType =>
                (!ticketType.saleOpensAt || ticketType.saleOpensAt <= now)
                && (!ticketType.saleClosesAt || ticketType.saleClosesAt >= now),
            )
            .map(ticketType => selectActiveTier(ticketType.priceTiers, ticketType.basePrice, now).price);

        return {
            id: row.id,
            slug: row.slug,
            title: row.title as unknown as I18nText,
            startAt: row.startAt,
            endAt: row.endAt,
            eventType: {
                id: row.eventType.id,
                slug: row.eventType.slug,
                name: row.eventType.name as unknown as I18nText,
            },
            venue: {
                id: row.venue.id,
                name: row.venue.name,
                city: row.venue.address?.city ?? null,
                province: row.venue.address?.province ?? null,
                region: row.venue.address?.region ?? null,
                country: row.venue.address?.country ?? null,
            },
            organization: { id: row.organization.id, name: row.organization.name },
            posterVerticalUrl: row.posterVerticalFile?.url ?? null,
            priceFrom: prices.length ? Math.min(...prices) : null,
            availability: {
                soldOut: online.some(q => q.limiting && this.headroom(q) <= 0),
                remaining: room ? Math.max(0, this.headroom(room)) : null,
                roles: {
                    leader: leader ? Math.max(0, this.headroom(leader)) : null,
                    follower: follower ? Math.max(0, this.headroom(follower)) : null,
                },
                rolesOnHold: {
                    leader: !this.capacityEngineService.evaluateToleranceGate(online, { leader: 1, follower: 0 }).passes,
                    follower: !this.capacityEngineService.evaluateToleranceGate(online, { leader: 0, follower: 1 }).passes,
                },
            },
        };
    }

    // ═════════════════════════════════════════════════════════════════════════

    private headroom(quota: CapacityQuota): number {
        return quota.limit + quota.overbookAllowance - quota.consumed;
    }

    private groupByEvent(quotas: CapacityQuota[]): Map<number, CapacityQuota[]> {
        const map = new Map<number, CapacityQuota[]>();
        for (const quota of quotas) {
            if (quota.scope !== QuotaScope.EVENT) {
                continue;
            }
            const bucket = map.get(quota.eventId);
            if (bucket) {
                bucket.push(quota);
            } else {
                map.set(quota.eventId, [quota]);
            }
        }
        return map;
    }

    private describeFacets(query: PublicEventQueryDTO): string {
        const facets = [
            query.value && `value='${query.value}'`,
            query.city && `city='${query.city}'`,
            query.province && `province='${query.province}'`,
            query.region && `region='${query.region}'`,
            query.country && `country='${query.country}'`,
            query.eventTypeId && `eventTypeId=${query.eventTypeId}`,
            query.from && `from=${query.from.toISOString()}`,
            query.to && `to=${query.to.toISOString()}`,
            query.role && `role=${query.role}`,
        ].filter(Boolean);
        return facets.length ? facets.join(", ") : "none";
    }
}
