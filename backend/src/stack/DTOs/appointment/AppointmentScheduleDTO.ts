import { z } from "zod";
import { AppointmentOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";
import { RecurrenceSchema } from "@DTOs/calendar/RecurrenceDTO";

/**
 * `POST /appointments/schedule` — un impegno dello staff, anche in serie
 * (`20-calendario.md` §4.2, §5).
 *
 * `organizationId` è facoltativo: lo deriva il server quando il chiamante
 * appartiene a una sola organizzazione (`OrganizationScopeService.resolveOwner`).
 * `createdById` e `seriesId` li scrive il server.
 */
export const AppointmentScheduleSchema = withoutMetadata(AppointmentOptionalDefaultsSchema)
    .omit({
        organizationId: true,
        createdById: true,
        seriesId: true,
    })
    .extend({
        organizationId: z.number().int().optional(),
        title: z.string().trim().min(1, "Indica un titolo."),
        recurrence: RecurrenceSchema.optional(),
    });
export type AppointmentScheduleDTO = z.infer<typeof AppointmentScheduleSchema>;
