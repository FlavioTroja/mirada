import { Service } from "fastify-decorators";
import { EventTypeFamily, Prisma, Prospect, ProspectStatus } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { getPrismaClient } from "@utils/adapters/prisma";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { OrganizationScope } from "@utils/helpers/organizationScope";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { ProspectRepository } from "@repositories/ProspectRepository";
import { EventRepository } from "@repositories/EventRepository";
import { RegistrationRepository } from "@repositories/RegistrationRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { ProspectCreateDTO } from "@DTOs/prospect/ProspectCreateDTO";
import { ProspectUpdateDTO } from "@DTOs/prospect/ProspectUpdateDTO";
import { ProspectQueryDTO } from "@DTOs/prospect/ProspectQueryDTO";
import { ProspectMarkContactedDTO } from "@DTOs/prospect/ProspectMarkContactedDTO";
import { ActivityService } from "@services/ActivityService";

/**
 * **I prospect dell'open day** — `19-prospect.md`.
 *
 * Chi viene a provare e non si iscrive è un contatto buono, e l'unico momento in
 * cui ricontattarlo ha senso è l'apertura del corso successivo. Qui si raccoglie,
 * si filtra e si segna; il messaggio lo scrive la segreteria, con i suoi mezzi.
 */
@Service()
export class ProspectService {
    constructor(
        private readonly prospectRepository: ProspectRepository,
        private readonly eventRepository: EventRepository,
        private readonly registrationRepository: RegistrationRepository,
        private readonly organizationScopeService: OrganizationScopeService,
        private readonly activityService: ActivityService,
    ) {}

    public async save(principalId: number, dto: ProspectCreateDTO): Promise<Prospect> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const course = await this.findCourseOrThrow(scope, dto.sourceEventId);
        // L'organizzazione è quella del corso: il client non la dichiara, e non
        // può dichiararne un'altra.
        this.organizationScopeService.assertWritable(scope, course.organizationId);

        const contact = this.normalizeContact(dto.email, dto.phone);
        this.assertReachable(contact.email, contact.phone);

        Log.info(`[Prospect Service]: recording prospect '${dto.name}' from the open day of course (id ${course.id})`);
        const prospect = await this.prospectRepository.save({
            organizationId: course.organizationId,
            sourceEventId: course.id,
            name: dto.name,
            surname: dto.surname || null,
            email: contact.email,
            phone: contact.phone,
            preferredRole: dto.preferredRole ?? null,
            note: dto.note ?? null,
            consentAt: new Date(),
        });
        Log.info(`[Prospect Service]: prospect recorded (id ${prospect.id}) for organization (id ${prospect.organizationId})`);
        await this.activityService.prospect(prospect);
        return prospect;
    }

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<Prospect | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        await this.reconcileConversions(scope);
        return this.prospectRepository.findOneInScope(scope, { id }, options);
    }

    public async paginate(principalId: number, query: ProspectQueryDTO, options: PaginateOptions): Promise<PaginateDatasourceDTO<Prospect>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        await this.reconcileConversions(scope);
        return this.prospectRepository.paginateInScope(scope, this.createQueryFromPayload(query), options);
    }

    public async updateById(principalId: number, id: number, dto: ProspectUpdateDTO): Promise<Prospect> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const prospect = await this.findByIdOrThrow(scope, id);
        this.organizationScopeService.assertWritable(scope, prospect.organizationId);

        const data: Prisma.ProspectUpdateInput = {
            name: dto.name,
            surname: dto.surname,
            preferredRole: dto.preferredRole,
            note: dto.note,
            status: dto.status,
        };

        if (dto.email !== undefined || dto.phone !== undefined) {
            const contact = this.normalizeContact(
                dto.email === undefined ? prospect.email : dto.email,
                dto.phone === undefined ? prospect.phone : dto.phone,
            );
            this.assertReachable(contact.email, contact.phone);
            data.email = contact.email;
            data.phone = contact.phone;
        }

        // La data del contatto la scrive il server, al passaggio: è ciò che dice
        // «l'abbiamo sentito il 3 ottobre», e un client non ha modo di saperlo
        // meglio del momento in cui la segreteria lo dichiara.
        if (dto.status === ProspectStatus.CONTACTED && prospect.status !== ProspectStatus.CONTACTED) {
            data.contactedAt = new Date();
        }

        Log.info(`[Prospect Service]: updating prospect (id ${id})${dto.status ? ` — status ${dto.status}` : ""}`);
        return this.prospectRepository.update({ id }, data);
    }

    /**
     * **Cancellazione vera**, non soft. È un dato personale raccolto col
     * consenso: chi chiede di essere tolto dall'elenco va tolto davvero, non
     * nascosto dietro una colonna `deleted` (`19-prospect.md` §3).
     */
    public async deleteById(principalId: number, id: number): Promise<Prospect> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const prospect = await this.findByIdOrThrow(scope, id);
        this.organizationScopeService.assertWritable(scope, prospect.organizationId);

        Log.info(`[Prospect Service]: deleting prospect (id ${id})`);
        return this.prospectRepository.deleteById(id);
    }

    /** Segna come contattati tutti quelli a cui si è appena scritto. */
    public async markContacted(principalId: number, dto: ProspectMarkContactedDTO): Promise<{ updated: number }> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const ids = [...new Set(dto.ids)];
        const found = await this.prospectRepository.findManyInScope(scope, { id: { in: ids } });
        if (found.length !== ids.length) {
            Log.warn(`[Prospect Service]: mark-contacted refused — ${ids.length - found.length} of ${ids.length} prospects not in the caller's scope`);
            throw new httpErrors.NotFound("Alcuni contatti non sono stati trovati.");
        }
        for (const prospect of found) {
            this.organizationScopeService.assertWritable(scope, prospect.organizationId);
        }

        Log.info(`[Prospect Service]: marking ${ids.length} prospects as contacted`);
        const updated = await this.prospectRepository.markContacted(ids, new Date());
        return { updated };
    }

    /**
     * **Il prospect che si iscrive smette di esserlo da solo** (`19` §4).
     *
     * Si confrontano le email con le iscrizioni vive presso la stessa
     * organizzazione, a corsi o eventi che finiscono dopo il giorno in cui il
     * contatto è stato raccolto: chi si è iscritto in ritardo al corso dell'open
     * day conta, chi era allievo tre anni fa no.
     *
     * ── Perché in lettura, e non all'iscrizione ─────────────────────────────
     * Un'iscrizione nasce da quattro strade — la segreteria, il checkout, la
     * porta, i canali esterni — e agganciarne una sola vorrebbe dire che le altre
     * tre non convertono **senza che nulla fallisca**, la trappola che questo
     * progetto ha già pagato più volte. Qui la domanda si fa nel momento in cui
     * qualcuno guarda l'elenco, che è l'unico momento in cui la risposta serve.
     *
     * Il costo è una query per organizzazione del chiamante, sui soli contatti
     * non ancora convertiti. Un'email sola, niente telefono: un numero digitato
     * in due modi diversi non si confronta, e un falso positivo toglierebbe
     * dall'elenco qualcuno da chiamare.
     */
    private async reconcileConversions(scope: OrganizationScope): Promise<void> {
        const pending = await this.prospectRepository.findUnconvertedWithEmail(scope);
        if (pending.length === 0) {
            return;
        }

        const byOrganization = new Map<number, Prospect[]>();
        for (const prospect of pending) {
            byOrganization.set(prospect.organizationId, [...(byOrganization.get(prospect.organizationId) ?? []), prospect]);
        }

        const conversions: { prospectId: number; registrationId: number; at: Date }[] = [];
        for (const [organizationId, prospects] of byOrganization) {
            const earliest = new Date(Math.min(...prospects.map(p => p.createdAt.getTime())));
            const emails = [...new Set(prospects.map(p => p.email!))];
            const registrations = await this.registrationRepository.findActiveByOrganizationAndEmails(organizationId, emails, earliest);

            for (const prospect of prospects) {
                const match = registrations.find(r =>
                    r.holderEmail.toLowerCase() === prospect.email && r.event.endAt >= prospect.createdAt,
                );
                if (match) {
                    conversions.push({ prospectId: prospect.id, registrationId: match.id, at: match.createdAt });
                }
            }
        }

        if (conversions.length === 0) {
            return;
        }

        Log.info(`[Prospect Service]: ${conversions.length} prospects found enrolled — marking them converted`);
        await getPrismaClient().$transaction(async prisma => {
            for (const c of conversions) {
                await this.prospectRepository.markConverted(c.prospectId, c.registrationId, c.at, prisma);
                Log.info(`[Prospect Service]: prospect (id ${c.prospectId}) converted by registration (id ${c.registrationId})`);
            }
        });
    }

    private async findCourseOrThrow(scope: OrganizationScope, eventId: number) {
        const event = await this.eventRepository.findOneInScope(scope, { id: eventId, deleted: false }, { populate: "eventType" });
        if (!event) {
            Log.warn(`[Prospect Service]: course (id ${eventId}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Corso non trovato.");
        }
        const family = (event as typeof event & { eventType?: { family: EventTypeFamily } }).eventType?.family;
        if (family !== EventTypeFamily.COURSE) {
            Log.warn(`[Prospect Service]: event (id ${eventId}) is not a course — prospects are refused`);
            throw new httpErrors.BadRequest("I prospect si raccolgono sugli open day dei corsi.");
        }
        return event;
    }

    private async findByIdOrThrow(scope: OrganizationScope, id: number): Promise<Prospect> {
        const prospect = await this.prospectRepository.findOneInScope(scope, { id });
        if (!prospect) {
            Log.warn(`[Prospect Service]: prospect (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Contatto non trovato.");
        }
        return prospect;
    }

    /** Il campo lasciato vuoto nel modulo arriva come stringa vuota: vale «nessuno». */
    private normalizeContact(email?: string | null, phone?: string | null) {
        return {
            email: email ? email.trim().toLowerCase() : null,
            phone: phone ? phone.trim() : null,
        };
    }

    private assertReachable(email: string | null, phone: string | null): void {
        if (!email && !phone) {
            throw new httpErrors.BadRequest("Serve almeno un recapito: email o telefono.");
        }
    }

    private createQueryFromPayload(payload: ProspectQueryDTO): Prisma.ProspectWhereInput {
        const valueQuery: Prisma.ProspectWhereInput[] = [
            createObjectWithoutThrow(payload.value, { name: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(payload.value, { surname: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(payload.value, { email: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(payload.value, { phone: { contains: payload.value } }),
            createObjectWithoutThrow(payload.value, { note: { contains: payload.value, mode: "insensitive" } }),
        ].filter(o => Object.values(o).length > 0);

        const query: Prisma.ProspectWhereInput[] = [
            createObjectWithoutThrow(valueQuery.length, { OR: valueQuery }),
            createObjectWithoutThrow(payload.sourceEventId, { sourceEventId: payload.sourceEventId }),
            createObjectWithoutThrow(payload.status, { status: payload.status }),
            payload.converted === undefined
                ? {}
                : { convertedRegistrationId: payload.converted ? { not: null } : null },
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
