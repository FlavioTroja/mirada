import { Service } from "fastify-decorators";
import { EventStatus, OrgMemberRole, PayoutStatus } from "@prisma/client";
import { Log } from "@utils/adapters/log";
import { OrganizationRepository } from "@repositories/OrganizationRepository";
import { EventRepository } from "@repositories/EventRepository";
import { RegistrationRepository } from "@repositories/RegistrationRepository";
import { OrderRepository } from "@repositories/OrderRepository";
import { PlatformSummaryDTO } from "@DTOs/platform/PlatformSummaryDTO";

/** Stati in cui un evento è **pubblicamente visibile**: gli stessi del §4.5. */
const PUBLISHED_STATUSES: EventStatus[] = [
    EventStatus.PUBLISHED,
    EventStatus.SALES_CLOSED,
    EventStatus.RUNNING,
];

const PERIMETER_NOTE =
    "Riepilogo su tutte le organizzazioni e tutti i loro eventi. Le ISCRIZIONI sono quelle attive "
    + "(CONFIRMED, TO_CONFIRM) e misurano l'IMPEGNATO; il RICAVO viene dai soli ordini PAID e misura "
    + "il VENDUTO: le due grandezze divergono per tutta la durata di una prenotazione e non vanno "
    + "sommate (RB21). Refund NON è ancora costruita, quindi gli importi sono AL LORDO dei rimborsi. "
    + "I DIRITTI DI PREVENDITA sono il ricavo della piattaforma, distinto dal subtotale che spetta "
    + "agli organizzatori.";

const MISSING_ENTITIES = ["Refund"];

/**
 * `GET /platform/summary` — **il cruscotto di chi gestisce la piattaforma**.
 *
 * Vive in un servizio proprio e non dentro `EventDashboardService` perché
 * risponde a un'altra domanda. Il cruscotto d'evento serve a un organizzatore
 * che guarda *il suo* festival: quanti leader, quanti follower, quanta capienza
 * resta. Questo serve a chi possiede il prodotto e guarda *i clienti*: quanti
 * ce ne sono, quanti vendono, quanti sono fermi, quanti non possono ancora
 * incassare. Sono numeri che si somigliano e intenzioni che non si somigliano
 * affatto; fonderli in una pagina sola le renderebbe entrambe illeggibili.
 *
 * ── Nessuno scope di tenancy, e non è una dimenticanza ────────────────────────
 * Questo è l'**unico** servizio che legge deliberatamente attraverso tutte le
 * organizzazioni. È per questo che la rotta è chiusa a `GOD` con `HasRole` e non
 * con un permesso: `READ#ORGANIZATION#ALL` lo possiede anche un `OWNER`, e con
 * quello un titolare leggerebbe gli incassi dei concorrenti. Il §1.5 non
 * concede nemmeno un conteggio aggregato di un'organizzazione altrui.
 *
 * ── Costo ────────────────────────────────────────────────────────────────────
 * Quattro letture in tutto, nessuna per riga: organizzazioni con i membri,
 * eventi con l'organizzazione, iscrizioni raggruppate per evento, ordini
 * raggruppati per organizzazione. Un conteggio per evento avrebbe trasformato un
 * catalogo di cento eventi in centouno interrogazioni.
 */
@Service()
export class PlatformSummaryService {
    constructor(
        private readonly organizationRepository: OrganizationRepository,
        private readonly eventRepository: EventRepository,
        private readonly registrationRepository: RegistrationRepository,
        private readonly orderRepository: OrderRepository,
    ) {}

    public async build(): Promise<PlatformSummaryDTO> {
        Log.info("[PlatformSummary Service]: building platform summary");

        const [organizations, events, registrationsByEvent, totalsByOrganization] = await Promise.all([
            this.organizationRepository.findAllWithMembers(),
            this.eventRepository.findAllWithOrganization(),
            this.registrationRepository.countActiveByEvent(),
            this.orderRepository.paidTotalsByOrganization(),
        ]);

        const now = new Date();

        // ── Gli eventi, una riga per evento ──────────────────────────────────
        const eventsList = events.map(event => ({
            eventId: event.id,
            slug: event.slug,
            title: event.title,
            status: event.status,
            startAt: event.startAt,
            endAt: event.endAt,
            organizationId: event.organizationId,
            organizationName: event.organization.name,
            registrations: registrationsByEvent.get(event.id) ?? 0,
        }));

        // ── I clienti, con ciò che serve a capire se stanno funzionando ──────
        const byOrganization = organizations.map(organization => {
            const own = eventsList.filter(e => e.organizationId === organization.id);
            const totals = totalsByOrganization.get(organization.id);

            return {
                organizationId: organization.id,
                name: organization.name,
                status: organization.status,
                payoutStatus: organization.payoutStatus,
                owners: organization.members
                    .filter(member => member.role === OrgMemberRole.OWNER)
                    .map(member => ({
                        userId: member.user.id,
                        username: member.user.username,
                        fullName: member.user.person
                            ? `${member.user.person.name} ${member.user.person.surname}`.trim()
                            : member.user.username,
                    })),
                events: own.length,
                publishedEvents: own.filter(e => PUBLISHED_STATUSES.includes(e.status)).length,
                registrations: own.reduce((sum, e) => sum + e.registrations, 0),
                revenue: totals?.total ?? 0,
                presaleRights: totals?.presaleRights ?? 0,
            };
        });

        const summary: PlatformSummaryDTO = {
            generatedAt: now,

            organizations: {
                total: organizations.length,
                byStatus: this.tally(organizations.map(o => o.status)),
                payoutEnabled: organizations.filter(o => o.payoutStatus === PayoutStatus.ENABLED).length,
            },

            events: {
                total: events.length,
                byStatus: this.tally(events.map(e => e.status)),
                // In corso secondo il **calendario**, non secondo lo stato: un
                // evento può essere PUBLISHED e cominciare fra tre mesi, e uno
                // in corso è ciò che riguarda la piattaforma stasera.
                running: eventsList.filter(e => e.startAt <= now && e.endAt >= now).length,
                upcoming: eventsList.filter(e => e.startAt > now).length,
            },

            registrations: {
                total: [...registrationsByEvent.values()].reduce((sum, n) => sum + n, 0),
            },

            revenue: [...totalsByOrganization.values()].reduce(
                (acc, t) => ({
                    paidOrders: acc.paidOrders + t.paidOrders,
                    subtotal: acc.subtotal + t.subtotal,
                    presaleRights: acc.presaleRights + t.presaleRights,
                    total: acc.total + t.total,
                }),
                { paidOrders: 0, subtotal: 0, presaleRights: 0, total: 0 },
            ),

            byOrganization,
            eventsList,

            perimeter: { note: PERIMETER_NOTE, missingEntities: MISSING_ENTITIES },
        };

        Log.info(
            `[PlatformSummary Service]: platform summary ready — ${summary.organizations.total} organization(s), `
            + `${summary.events.total} event(s), ${summary.registrations.total} active registration(s)`,
        );
        return summary;
    }

    /** Conteggio per valore, con le sole chiavi presenti: uno zero inventato è rumore. */
    private tally(values: string[]): Record<string, number> {
        return values.reduce<Record<string, number>>((acc, value) => {
            acc[value] = (acc[value] ?? 0) + 1;
            return acc;
        }, {});
    }
}
