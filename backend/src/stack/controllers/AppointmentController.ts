import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import httpErrors from "http-errors";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import { AppointmentService } from "@services/AppointmentService";
import { AppointmentScheduleDTO, AppointmentScheduleSchema } from "@DTOs/appointment/AppointmentScheduleDTO";
import { AppointmentUpdateDTO, AppointmentUpdateSchema } from "@DTOs/appointment/AppointmentUpdateDTO";
import { AppointmentSeriesUpdateDTO, AppointmentSeriesUpdateSchema } from "@DTOs/appointment/AppointmentSeriesUpdateDTO";
import { SeriesScopeQueryDTO, SeriesScopeQuerySchema } from "@DTOs/calendar/SeriesScopeDTO";
import { CalendarRangeDTO, CalendarRangeSchema } from "@DTOs/calendar/CalendarRangeDTO";

/**
 * Gli impegni dello staff sul calendario — `20-calendario.md` §4.2. L'isolamento
 * fra organizzazioni sta nei finder di repository (§1.5).
 *
 * Non c'è `POST /create`: si crea con `POST /schedule`, che accetta anche la
 * ripetizione e restituisce sempre l'elenco delle occorrenze — una o molte.
 */
@Controller({
    route: "/appointments",
    tags: [{ name: "Appointments", description: "Staff appointments on the organizer's calendar" }],
})
export class AppointmentController {
    constructor(private readonly appointmentService: AppointmentService) {}

    @POST("/schedule", {
        schema: {
            operationId: "scheduleAppointments",
            summary: "Schedule Appointments",
            description: "Creates one staff appointment or a weekly series (recurrence: weekdays + until or count, local clock time). Returns every occurrence created. At most 104.",
            body: AppointmentScheduleSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.APPOINTMENT, PermissionScope.ALL),
        ],
    })
    async schedule(
        req: FastifyRequest<{ Body: AppointmentScheduleDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.appointmentService.schedule(+req.user.id, req.body));
    }

    @POST("/calendar", {
        schema: {
            operationId: "findAppointmentsCalendar",
            summary: "Appointments in a calendar period",
            description: "Staff appointments that overlap [from, to), with their venue name. At most 45 days per call.",
            body: CalendarRangeSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.APPOINTMENT, PermissionScope.ALL),
        ],
    })
    async calendar(
        req: FastifyRequest<{ Body: CalendarRangeDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.appointmentService.findCalendar(+req.user.id, req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findAppointment",
            summary: "Get Appointment from id",
            description: "Returns a single appointment by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.APPOINTMENT, PermissionScope.SINGLE),
        ],
    })
    async findById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const appointment = await this.appointmentService.findById(+req.user.id, +req.params.id, req.query);
        if (!appointment) {
            throw new httpErrors.NotFound("Appuntamento non trovato.");
        }
        reply.status(200).send(appointment);
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateAppointment",
            summary: "Update Appointment",
            description: "Updates this appointment only. Sending seriesId: null detaches it from its series (\"only this one\").",
            params: exz.pathId,
            body: AppointmentUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.APPOINTMENT, PermissionScope.SINGLE),
        ],
    })
    async update(
        req: FastifyRequest<{ Params: { id: string }, Body: AppointmentUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.appointmentService.updateById(+req.user.id, +req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteAppointment",
            summary: "Delete Appointment",
            description: "Soft-deletes this appointment only.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.APPOINTMENT, PermissionScope.SINGLE),
        ],
    })
    async delete(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.appointmentService.safeDeleteById(+req.user.id, +req.params.id));
    }

    @PATCH("/:id/series", {
        schema: {
            operationId: "updateAppointmentSeries",
            summary: "Update an Appointment series",
            description: "Applies the change to this occurrence and the following ones (FOLLOWING) or to the whole series (ALL); each occurrence keeps its own day. Moving the day is refused.",
            params: exz.pathId,
            body: AppointmentSeriesUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.APPOINTMENT, PermissionScope.SINGLE),
        ],
    })
    async updateSeries(
        req: FastifyRequest<{ Params: { id: string }, Body: AppointmentSeriesUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.appointmentService.updateSeries(+req.user.id, +req.params.id, req.body));
    }

    @DELETE("/:id/series", {
        schema: {
            operationId: "deleteAppointmentSeries",
            summary: "Delete an Appointment series",
            description: "Soft-deletes this occurrence and the following ones (FOLLOWING) or the whole series (ALL). Occurrences already over are skipped and counted.",
            params: exz.pathId,
            querystring: SeriesScopeQuerySchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.APPOINTMENT, PermissionScope.SINGLE),
        ],
    })
    async deleteSeries(
        req: FastifyRequest<{ Params: { id: string }, Querystring: SeriesScopeQueryDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.appointmentService.deleteSeries(+req.user.id, +req.params.id, req.query.scope));
    }
}
