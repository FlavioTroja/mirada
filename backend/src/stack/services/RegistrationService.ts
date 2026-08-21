import { Service } from "fastify-decorators";
import { Event, Prisma, Registration, RegistrationStatus } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { getPrismaClient } from "@utils/adapters/prisma";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { RegistrationRepository } from "@repositories/RegistrationRepository";
import { EventRepository } from "@repositories/EventRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { CapacityEngineService, CommitOutcome } from "@services/CapacityEngineService";
import { RegistrationNotifierService } from "@services/RegistrationNotifierService";
import { RegistrationCreateDTO } from "@DTOs/registration/RegistrationCreateDTO";
import { RegistrationUpdateDTO } from "@DTOs/registration/RegistrationUpdateDTO";
import { RegistrationQueryDTO } from "@DTOs/registration/RegistrationQueryDTO";
import { RegistrationRoleReassignDTO } from "@DTOs/registration/RegistrationRoleDTO";
import { MyRegistrationDTO, MyRegistrationsDTO } from "@DTOs/registration/MyRegistrationsDTO";

/**
 * La riga come torna dal repository con le relazioni popolate. È un tipo locale
 * perché Prisma non ne genera uno per una `populate` composta a runtime.
 */
type MyRegistrationRow = Registration & {
    event?: {
        id: number;
        slug: string;
        title: unknown;
        startAt: Date;
        endAt: Date;
        status: string;
        venue?: { name: string; address?: { city?: string | null } | null } | null;
        posterVerticalFile?: { url: string } | null;
    } | null;
    tickets?: {
        id: number;
        status: string;
        holderName: string;
        holderSurname: string;
        bearer: boolean;
        qrRevokedAt?: Date | null;
        deleted: boolean;
        ticketType?: { name: unknown } | null;
    }[];
};

/**
 * `Registration` — backend-brief §4.10.
 *
 * *Una iscrizione per persona per evento, con più biglietti collegati.*
 *
 * Due regole che il servizio deve far rispettare e che non sono di interfaccia:
 *  - `assignedRole` è **calcolato dal server**: la riassegnazione passa dal motore
 *    di capienza, che rilascia i consumi del vecchio ruolo e impegna quelli del
 *    nuovo con le stesse verifiche di un acquisto;
 *  - `status = TO_CONFIRM` **non blocca mai l'ingresso** (`RF-CPL-13`): il
 *    biglietto è valido, restano inattivi il profilo e le comunicazioni non
 *    essenziali. Nessun controllo di questo servizio può derivarne un divieto.
 */
@Service()
export class RegistrationService {
    constructor(
        private readonly registrationRepository: RegistrationRepository,
        private readonly eventRepository: EventRepository,
        private readonly organizationScopeService: OrganizationScopeService,
        private readonly capacityEngineService: CapacityEngineService,
        private readonly registrationNotifierService: RegistrationNotifierService,
    ) {}

    // ─────────────────────────────────────────────────────────────────────────
    // CRUD del dialetto (§3.2)
    // ─────────────────────────────────────────────────────────────────────────

    public async save(principalId: number, dto: RegistrationCreateDTO): Promise<Registration> {
        const event = await this.assertWritableEvent(principalId, dto.eventId);

        if (dto.personUserId) {
            const existing = await this.registrationRepository.findByEventAndPerson(dto.eventId, dto.personUserId);
            if (existing) {
                Log.warn(
                    `[Registration Service]: create refused on event (id ${dto.eventId}) — user (id ${dto.personUserId}) `
                    + `already has registration (id ${existing.id})`,
                );
                throw new httpErrors.BadRequest("Questa persona è già iscritta all'evento.");
            }
        }

        Log.info(`[Registration Service]: creating registration on event (id ${dto.eventId}) for '${dto.holderEmail}'`);
        const registration = await this.registrationRepository.save(dto as any);
        Log.info(`[Registration Service]: registration created (id ${registration.id})`);

        // §3.9 — dopo la scrittura, mai dentro: `registration/created` ai membri
        // dell'organizzazione, uno per uno, mai in broadcast per ruolo.
        await this.registrationNotifierService.registrationsCreated(event, [registration.id]);

        return registration;
    }

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<Registration | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.registrationRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async paginate(
        principalId: number,
        query: RegistrationQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<Registration>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.registrationRepository.paginateInScope(scope, this.createQueryFromPayload(query), options);
    }

    /**
     * **Le iscrizioni di chi chiede** — `GET /registrations/mine`, §3.7.
     *
     * ── Perché non passa dallo scope di organizzazione ───────────────────────
     * Lo scope del §1.5 isola un tenant dall'altro, e chi balla non è un tenant:
     * è la persona scritta nella riga. Un ballerino ha scope vuoto e con
     * `paginate` otterrebbe zero risultati — cioè la piattaforma gli nasconde le
     * sue stesse iscrizioni. Qui il filtro è la persona, e solo quella.
     *
     * ── Perché non tocca `paginate` ──────────────────────────────────────────
     * Sarebbe bastato aggiungere «oppure le mie» al filtro dell'elenco, come già
     * fanno `Order` e `Ticket`. Non qui: l'elenco iscritti è la schermata di
     * lavoro dell'organizzatore, e mescolarci le sue iscrizioni personali a
     * eventi altrui la sporcherebbe di righe che con il suo evento non c'entrano
     * nulla. Due letture diverse meritano due rotte diverse.
     *
     * ── Il taglio prossimi / passati ─────────────────────────────────────────
     * Sulla **fine** dell'evento, non sull'inizio: un festival cominciato ieri e
     * che finisce domani è ancora un evento a cui stai andando.
     */
    public async findMine(principalId: number): Promise<MyRegistrationsDTO> {
        // L'ordine non si chiede qui: i due elenchi vengono riordinati sotto
        // per data d'evento, che è l'unico ordine che significhi qualcosa a chi
        // guarda le proprie iscrizioni.
        const rows = await this.registrationRepository.findByPersonUser(principalId, {
            populate: "event event.venue event.venue.address event.posterVerticalFile tickets tickets.ticketType",
        });

        Log.info(`[Registration Service]: user (id ${principalId}) is reading their own ${rows.length} registration(s)`);

        const now = new Date();
        const upcoming: MyRegistrationDTO[] = [];
        const past: MyRegistrationDTO[] = [];

        for (const row of rows as MyRegistrationRow[]) {
            // Un'iscrizione senza evento non è mostrabile e non è un errore da
            // far vedere: l'evento è `Restrict`, quindi può succedere solo se
            // qualcuno ha smontato dati a mano.
            if (!row.event) {
                Log.warn(`[Registration Service]: registration (id ${row.id}) has no event — skipped`);
                continue;
            }
            const view = this.toMyRegistration(row);
            (new Date(row.event.endAt) < now ? past : upcoming).push(view);
        }

        // I prossimi dal più vicino, i passati dal più recente: in entrambi i
        // casi per primo ciò che sta più vicino a oggi.
        upcoming.sort((a, b) => +new Date(a.event.startAt) - +new Date(b.event.startAt));
        past.sort((a, b) => +new Date(b.event.endAt) - +new Date(a.event.endAt));

        return { upcoming, past };
    }

    private toMyRegistration(row: MyRegistrationRow): MyRegistrationDTO {
        const event = row.event!;
        return {
            id: row.id,
            status: row.status,
            declaredRole: row.declaredRole,
            assignedRole: row.assignedRole ?? null,
            confirmedAt: row.confirmedAt ?? null,
            isMinor: row.isMinor,
            event: {
                id: event.id,
                slug: event.slug,
                title: event.title,
                startAt: event.startAt,
                endAt: event.endAt,
                status: event.status,
                venueName: event.venue?.name ?? null,
                city: event.venue?.address?.city ?? null,
                posterUrl: event.posterVerticalFile?.url ?? null,
            },
            tickets: (row.tickets ?? [])
                .filter(ticket => !ticket.deleted)
                .map(ticket => ({
                    id: ticket.id,
                    status: ticket.status,
                    ticketTypeName: ticket.ticketType?.name ?? null,
                    holderName: ticket.holderName,
                    holderSurname: ticket.holderSurname,
                    bearer: ticket.bearer,
                    qrAvailable: !ticket.qrRevokedAt,
                })),
        };
    }

    public async updateById(principalId: number, id: number, dto: RegistrationUpdateDTO): Promise<Registration> {
        const registration = await this.findByIdOrThrow(principalId, id);
        const event = await this.assertWritableEvent(principalId, registration.eventId);

        Log.info(`[Registration Service]: updating registration (id ${id})`);
        const updated = await this.registrationRepository.update({ id }, dto as any);

        await this.registrationNotifierService.registrationUpdated(event, id, "UPDATED");
        return updated;
    }

    /**
     * La cancellazione **rilascia i consumi**: un'iscrizione che sparisce
     * lasciando il proprio posto impegnato è deriva pura fra contatori e realtà
     * (invariante I6, `05` §12).
     */
    public async safeDeleteById(principalId: number, id: number): Promise<Registration> {
        const registration = await this.findByIdOrThrow(principalId, id);
        const event = await this.assertWritableEvent(principalId, registration.eventId);

        Log.info(`[Registration Service]: soft deleting registration (id ${id}) and releasing its quota consumptions`);

        const deleted = await getPrismaClient().$transaction(async prisma => {
            await this.capacityEngineService.releaseRegistrations([id], prisma);
            return this.registrationRepository.safeDeleteById(id, prisma);
        });

        // Dopo il commit, come impone il §3.9: un frame emesso da una
        // transazione che poi rotola indietro annuncia un fatto che non e
        // avvenuto, e il client lo va a rileggere trovando il contrario.
        await this.registrationNotifierService.registrationUpdated(event, id, "DELETED");
        return deleted;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Transizioni (§4.10)
    // ─────────────────────────────────────────────────────────────────────────

    public async confirm(principalId: number, id: number): Promise<Registration> {
        const registration = await this.findByIdOrThrow(principalId, id);
        const event = await this.assertWritableEvent(principalId, registration.eventId);

        if (registration.status === RegistrationStatus.DECLINED) {
            Log.warn(`[Registration Service]: confirm refused for registration (id ${id}) — already declined`);
            throw new httpErrors.BadRequest("L'iscrizione è stata rifiutata e non può essere confermata.");
        }

        Log.info(`[Registration Service]: confirming registration (id ${id})`);
        const confirmed = await this.registrationRepository.update(
            { id },
            { status: RegistrationStatus.CONFIRMED, confirmedAt: new Date() },
        );

        await this.registrationNotifierService.registrationUpdated(event, id, "CONFIRMED");
        return confirmed;
    }

    /**
     * `RB24` — il rifiuto rende il biglietto **privo di titolare e lo restituisce
     * alla disponibilità dell'acquirente**: l'iscrizione esce dai contatori, il
     * posto torna in vendita, e i dati del terzo escono dalla piattaforma salvo la
     * traccia contabile obbligatoria.
     */
    public async decline(principalId: number, id: number): Promise<Registration> {
        const registration = await this.findByIdOrThrow(principalId, id);
        const event = await this.assertWritableEvent(principalId, registration.eventId);

        if (registration.status === RegistrationStatus.DECLINED) {
            Log.warn(`[Registration Service]: decline refused for registration (id ${id}) — already declined`);
            throw new httpErrors.BadRequest("L'iscrizione è già stata rifiutata.");
        }

        Log.info(`[Registration Service]: declining registration (id ${id}) and releasing its quota consumptions`);

        const declined = await getPrismaClient().$transaction(async prisma => {
            await this.capacityEngineService.releaseRegistrations([id], prisma);
            return this.registrationRepository.update(
                { id },
                { status: RegistrationStatus.DECLINED, declinedAt: new Date() },
                undefined,
                undefined,
                prisma,
            );
        });

        await this.registrationNotifierService.registrationUpdated(event, id, "DECLINED");
        return declined;
    }

    /**
     * `POST /registrations/:id/reassign-role` — rilascio del vecchio ruolo e
     * impegno del nuovo **nella stessa transazione**. Se il nuovo ruolo è saturo
     * l'operazione è rifiutata con `SOLD_OUT` e **nulla cambia**.
     */
    public async reassignRole(
        principalId: number,
        id: number,
        dto: RegistrationRoleReassignDTO,
    ): Promise<CommitOutcome> {
        const registration = await this.findByIdOrThrow(principalId, id);
        const event = await this.assertWritableEvent(principalId, registration.eventId);

        const outcome = await this.capacityEngineService.reassignRole(id, dto.role, {
            ticketTypeId: dto.ticketTypeId ?? null,
            serviceIds: dto.serviceIds ?? [],
        });

        await this.registrationNotifierService.registrationUpdated(event, id, "ROLE_REASSIGNED");
        return outcome;
    }

    // ─────────────────────────────────────────────────────────────────────────

    private async assertWritableEvent(principalId: number, eventId: number): Promise<Event> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const event = await this.eventRepository.findOneInScope(scope, { id: eventId, deleted: false });
        if (!event) {
            Log.warn(`[Registration Service]: event (id ${eventId}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Evento non trovato.");
        }
        this.organizationScopeService.assertWritable(scope, event.organizationId);
        return event;
    }

    private async findByIdOrThrow(principalId: number, id: number): Promise<Registration> {
        const registration = await this.findById(principalId, id);
        if (!registration) {
            Log.warn(`[Registration Service]: registration (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Iscrizione non trovata.");
        }
        return registration;
    }

    private createQueryFromPayload(payload: RegistrationQueryDTO): Prisma.RegistrationWhereInput {
        const query: Prisma.RegistrationWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(payload.eventId, { eventId: payload.eventId }),
            createObjectWithoutThrow(payload.assignedRole, { assignedRole: payload.assignedRole }),
            createObjectWithoutThrow(payload.status, { status: payload.status }),
            createObjectWithoutThrow(payload.channel, { channel: payload.channel }),
            createObjectWithoutThrow(payload.coupleId, { coupleId: payload.coupleId }),
            createObjectWithoutThrow(payload.value, {
                OR: [
                    { holderName: { contains: payload.value ?? "", mode: "insensitive" as const } },
                    { holderSurname: { contains: payload.value ?? "", mode: "insensitive" as const } },
                    { holderEmail: { contains: payload.value ?? "", mode: "insensitive" as const } },
                ],
            }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
