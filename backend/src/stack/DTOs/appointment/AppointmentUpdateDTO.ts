import { z } from "zod";
import { AppointmentPartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * Solo scalari della propria riga — regola 11 di `controllers.md`.
 *
 * L'organizzazione e l'autore non cambiano. `seriesId` accetta solo `null`: è
 * «solo questo» del calendario, che fa uscire la riga dalla serie.
 */
export const AppointmentUpdateSchema = withoutMetadata(AppointmentPartialSchema)
    .omit({
        organizationId: true,
        createdById: true,
    })
    .extend({
        title: z.string().trim().min(1, "Indica un titolo.").optional(),
        seriesId: z.null().optional(),
    });
export type AppointmentUpdateDTO = z.infer<typeof AppointmentUpdateSchema>;
