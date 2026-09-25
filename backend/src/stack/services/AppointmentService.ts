import { Service } from "fastify-decorators";
import { Appointment, Prisma } from "@prisma/client";
import httpErrors from "http-errors";
import { randomUUID } from "node:crypto";
import { Log } from "@utils/adapters/log";
import { getPrismaClient } from "@utils/adapters/prisma";
import { FindOptions } from "@utils/helpers/exz";
import { expandWeekly, expansionErrorMessage, retime, sameLocalDay } from "@utils/helpers/recurrence";
import { AppointmentRepository } from "@repositories/AppointmentRepository";
import { VenueRepository } from "@repositories/VenueRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { CalendarBroadcastService } from "@services/CalendarBroadcastService";
import { AppointmentScheduleDTO } from "@DTOs/appointment/AppointmentScheduleDTO";
import { AppointmentUpdateDTO } from "@DTOs/appointment/AppointmentUpdateDTO";
import { AppointmentSeriesUpdateDTO } from "@DTOs/appointment/AppointmentSeriesUpdateDTO";
import { SeriesDeletionDTO, SeriesScope } from "@DTOs/calendar/SeriesScopeDTO";
import { CalendarRangeDTO } from "@DTOs/calendar/CalendarRangeDTO";

/**
 * **Gli impegni dello staff** che non sono né lezioni né eventi: la riunione, le
 * prove, la sala chiusa per pulizie (`20-calendario.md` §4.2).
 *
 * Stesse regole delle sessioni per la ripetizione (§5): righe vere legate da
 * `seriesId`, ora d'orologio locale, «questo e i successivi» e «tutti».
 */
@Service()
export class AppointmentService {
    constructor(
        private readonly appointmentRepository: AppointmentRepository,
        private readonly venueRepository: VenueRepository,
        private readonly organizationScopeService: OrganizationScopeService,
        private readonly calendarBroadcastService: CalendarBroadcastService,
    ) {}

    public async schedule(principalId: number, dto: AppointmentScheduleDTO): Promise<Appointment[]> {
        const { recurrence, ...base } = dto;
        const scope = await this.organizationScopeService.resolve(principalId);
        const organizationId = this.organizationScopeService.resolveRequiredOwner(scope, base.organizationId);

        this.assertDatesAreCoherent(base.startAt, base.endAt);
        await this.assertVenueIsVisible(principalId, base.venueId);

        const expansion = expandWeekly(base.startAt, base.endAt, recurrence);
        if (!expansion.ok) {
            Log.warn(`[Appointment Service]: schedule refused — recurrence ${expansion.reason}`);
            throw new httpErrors.BadRequest(expansionErrorMessage(expansion.reason));
        }
        const occurrences = expansion.occurrences;
        const seriesId = occurrences.length > 1 ? randomUUID() : null;

        Log.info(
            `[Appointment Service]: scheduling ${occurrences.length} appointment(s) '${base.title}' `
            + `for organization (id ${organizationId})` + (seriesId ? ` as series ${seriesId}` : ""),
        );

        const created = await getPrismaClient().$transaction(async prisma => {
            const out: Appointment[] = [];
            for (const occurrence of occurrences) {
                out.push(await this.appointmentRepository.save(
                    {
                        ...base,
                        organizationId,
                        createdById: principalId,
                        startAt: occurrence.startAt,
                        endAt: occurrence.endAt,
                        seriesId,
                    } as Prisma.AppointmentUncheckedCreateInput,
                    prisma,
                ));
            }
            return out;
        });

        Log.info(`[Appointment Service]: ${created.length} appointment(s) created (first id ${created[0]?.id})`);
        await this.announce(organizationId, created);
        return created;
    }

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<Appointment | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.appointmentRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async findCalendar(principalId: number, range: CalendarRangeDTO) {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.appointmentRepository.findCalendarInScope(scope, range.from, range.to);
    }

    /** «Solo questo»: la riga cambia da sola e, con `seriesId: null`, esce dalla serie. */
    public async updateById(principalId: number, id: number, dto: AppointmentUpdateDTO): Promise<Appointment> {
        const appointment = await this.findWritableOrThrow(principalId, id);
        this.assertDatesAreCoherent(dto.startAt ?? appointment.startAt, dto.endAt ?? appointment.endAt);
        await this.assertVenueIsVisible(principalId, dto.venueId);

        Log.info(`[Appointment Service]: updating appointment (id ${id})`);
        const updated = await this.appointmentRepository.update({ id }, dto as Prisma.AppointmentUncheckedUpdateInput);
        await this.announce(appointment.organizationId, [appointment, updated]);
        return updated;
    }

    public async safeDeleteById(principalId: number, id: number): Promise<Appointment> {
        const appointment = await this.findWritableOrThrow(principalId, id);

        Log.info(`[Appointment Service]: soft deleting appointment (id ${id})`);
        const deleted = await this.appointmentRepository.safeDeleteById(id);
        await this.announce(appointment.organizationId, [appointment]);
        return deleted;
    }

    public async updateSeries(principalId: number, id: number, dto: AppointmentSeriesUpdateDTO): Promise<Appointment[]> {
        const appointment = await this.findWritableOrThrow(principalId, id);
        const seriesId = this.assertInSeries(appointment);
        await this.assertVenueIsVisible(principalId, dto.venueId);

        const retiming = dto.startAt !== undefined || dto.endAt !== undefined;
        const template = { startAt: dto.startAt ?? appointment.startAt, endAt: dto.endAt ?? appointment.endAt };
        if (retiming) {
            this.assertDatesAreCoherent(template.startAt, template.endAt);
            if (!sameLocalDay(template.startAt, appointment.startAt)) {
                Log.warn(`[Appointment Service]: series update refused for appointment (id ${id}) — the day was moved`);
                throw new httpErrors.BadRequest(
                    "Una serie non si sposta di giorno: elimina gli appuntamenti e ricreali nel giorno nuovo.",
                );
            }
        }

        const targets = await this.appointmentRepository.findSeries(seriesId, this.seriesStart(dto.scope, appointment));
        Log.info(
            `[Appointment Service]: updating ${targets.length} appointment(s) of series ${seriesId} `
            + `(scope ${dto.scope}, from appointment id ${id})`,
        );

        const updated = await getPrismaClient().$transaction(async prisma => {
            const out: Appointment[] = [];
            for (const target of targets) {
                out.push(await this.appointmentRepository.update(
                    { id: target.id },
                    {
                        ...(dto.title !== undefined && { title: dto.title }),
                        ...(dto.note !== undefined && { note: dto.note }),
                        ...(dto.room !== undefined && { room: dto.room }),
                        ...(dto.venueId !== undefined && { venueId: dto.venueId }),
                        ...(retiming && retime(target.startAt, template)),
                    } as Prisma.AppointmentUncheckedUpdateInput,
                    undefined,
                    undefined,
                    prisma,
                ));
            }
            return out;
        });

        await this.announce(appointment.organizationId, [...targets, ...updated]);
        return updated;
    }

    /**
     * Elimina «questo e i successivi» o «tutti», **saltando** gli appuntamenti
     * già conclusi: eliminare una serie non cancella ciò che è già successo.
     */
    public async deleteSeries(principalId: number, id: number, scope: SeriesScope): Promise<SeriesDeletionDTO> {
        const appointment = await this.findWritableOrThrow(principalId, id);
        const seriesId = this.assertInSeries(appointment);

        const targets = await this.appointmentRepository.findSeries(seriesId, this.seriesStart(scope, appointment));
        const now = Date.now();
        const deletable = targets.filter(t => t.endAt.getTime() > now);
        const skippedPast = targets.length - deletable.length;

        Log.info(
            `[Appointment Service]: deleting ${deletable.length} appointment(s) of series ${seriesId} `
            + `(scope ${scope}) — skipping ${skippedPast} past`,
        );

        await getPrismaClient().$transaction(async prisma => {
            for (const target of deletable) {
                await this.appointmentRepository.safeDeleteById(target.id, prisma);
            }
        });

        await this.announce(appointment.organizationId, deletable);
        return { deleted: deletable.length, skippedPast, skippedWithCheckIns: 0 };
    }

    // ─────────────────────────────────────────────────────────────────────────

    private async findWritableOrThrow(principalId: number, id: number): Promise<Appointment> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const appointment = await this.appointmentRepository.findOneInScope(scope, { id, deleted: false });
        if (!appointment) {
            Log.warn(`[Appointment Service]: appointment (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Appuntamento non trovato.");
        }
        this.organizationScopeService.assertWritable(scope, appointment.organizationId);
        return appointment;
    }

    /** La sede viene dalla rubrica: dell'organizzazione del chiamante o di piattaforma. */
    private async assertVenueIsVisible(principalId: number, venueId: number | null | undefined): Promise<void> {
        if (venueId === undefined || venueId === null) {
            return;
        }
        const scope = await this.organizationScopeService.resolve(principalId);
        const venue = await this.venueRepository.findOneInScope(scope, { id: venueId, deleted: false });
        if (!venue) {
            Log.warn(`[Appointment Service]: venue (id ${venueId}) not visible to user (id ${principalId})`);
            throw new httpErrors.BadRequest("Sede non trovata.");
        }
    }

    private assertDatesAreCoherent(startAt: Date, endAt: Date): void {
        if (endAt.getTime() <= startAt.getTime()) {
            Log.warn(`[Appointment Service]: incoherent appointment dates — endAt does not follow startAt`);
            throw new httpErrors.BadRequest("La fine dell'appuntamento deve seguire l'inizio.");
        }
    }

    private assertInSeries(appointment: Appointment): string {
        if (!appointment.seriesId) {
            Log.warn(`[Appointment Service]: appointment (id ${appointment.id}) is not part of a series`);
            throw new httpErrors.BadRequest("Questo appuntamento non fa parte di una serie.");
        }
        return appointment.seriesId;
    }

    private seriesStart(scope: SeriesScope, appointment: Appointment): Date | undefined {
        return scope === "FOLLOWING" ? appointment.startAt : undefined;
    }

    private async announce(organizationId: number, spans: { startAt: Date; endAt: Date }[]): Promise<void> {
        await this.calendarBroadcastService.publishChanged(organizationId, "APPOINTMENT", spans);
    }
}
