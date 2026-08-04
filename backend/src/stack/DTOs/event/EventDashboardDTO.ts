import { z } from "zod";
import { DanceRoleSchema, EventStatusSchema } from "@prisma-gen/zod";

/**
 * `GET /events/:id/dashboard` — backend-brief §3.7 (`RF-BKO-1`, `RF-CPL-11`).
 *
 * ── `RB21`: ogni numero dichiara su quali dati è calcolato ────────────────────
 * Il cruscotto del brief chiede venduto per titolo, incasso netto, iscritti per
 * ruolo con sbilancio, coppie complete, servizi venduti, requisiti mancanti e
 * andamento. Nel perimetro attuale `Order`, `OrderLine`, `Payment`, `Ticket`,
 * `CheckIn` e `RequirementOutcome` **non esistono ancora** (§2, passi 17→27 non
 * costruiti): le voci che dipendono da loro **non sono inventate né azzerate in
 * silenzio**. Ogni sezione porta quindi `available`, l'elenco `basedOn` delle
 * entità su cui è davvero calcolata e, quando indisponibile, `requires` e
 * `reason`.
 *
 * La distinzione che il consumatore non deve mai perdere: ciò che il motore di
 * capienza registra è **impegnato** (`QuotaConsumption`), non **venduto e
 * incassato**. Finché `Order` e `Payment` non esistono le due cose non
 * coincidono, e questo DTO le tiene separate per nome.
 */

/** Entità di dominio su cui una sezione è realmente calcolata (`RB21`). */
export const DashboardDataSourceSchema = z.enum([
    "Event",
    "Registration",
    "CapacityQuota",
    "QuotaConsumption",
    "Couple",
    "TicketType",
    "EventService",
    "EventRequirement",
    "Session",
]);
export type DashboardDataSource = z.infer<typeof DashboardDataSourceSchema>;

const availableSection = <T extends z.ZodRawShape>(shape: T) =>
    z.object({
        available: z.literal(true),
        basedOn: DashboardDataSourceSchema.array(),
        note: z.string().optional(),
        ...shape,
    });

/** Sezione che il perimetro attuale non può calcolare: dichiarata, mai finta. */
export const UnavailableSectionSchema = z.object({
    available: z.literal(false),
    /** Entità di §2 ancora da costruire, senza le quali il numero non esiste. */
    requires: z.string().array(),
    reason: z.string(),
});
export type UnavailableSectionDTO = z.infer<typeof UnavailableSectionSchema>;

export const RoleQuotaSnapshotSchema = z.object({
    role: DanceRoleSchema,
    limit: z.number().int(),
    consumed: z.number().int(),
    remaining: z.number().int(),
    limiting: z.boolean(),
});

export const RegistrationsByRoleSchema = availableSection({
    leader: z.number().int(),
    follower: z.number().int(),
    /** Iscrizioni attive senza ruolo assegnato — `FLEXIBLE` non ancora risolto. */
    unassigned: z.number().int(),
    total: z.number().int(),
    declared: z.object({
        LEADER: z.number().int(),
        FOLLOWER: z.number().int(),
        FLEXIBLE: z.number().int(),
    }),
    /** `leader − follower`, con il segno: dice **quale** ruolo è in eccesso. */
    imbalance: z.number().int(),
    /** Tolleranza configurata sulle quote di ruolo di ambito EVENT. `null` = nessun cancello. */
    imbalanceTolerance: z.number().int().nullable(),
    roleQuotas: RoleQuotaSnapshotSchema.array(),
});

export const CapacitySnapshotSchema = availableSection({
    room: z
        .object({
            limit: z.number().int(),
            consumed: z.number().int(),
            remaining: z.number().int(),
        })
        .nullable(),
    quotas: z
        .object({
            id: z.number().int(),
            scope: z.string(),
            scopeId: z.number().int().nullable(),
            role: DanceRoleSchema.nullable(),
            reservedFor: z.string().nullable(),
            limit: z.number().int(),
            consumed: z.number().int(),
            remaining: z.number().int(),
            limiting: z.boolean(),
        })
        .array(),
});

export const CommittedByTicketTypeSchema = availableSection({
    items: z
        .object({
            ticketTypeId: z.number().int(),
            name: z.unknown(),
            basePrice: z.number().int(),
            /** `null` = nessuna quota di titolo configurata, quindi nessun contatore. */
            limit: z.number().int().nullable(),
            committed: z.number().int().nullable(),
            remaining: z.number().int().nullable(),
        })
        .array(),
});

export const CommittedServicesSchema = availableSection({
    items: z
        .object({
            eventServiceId: z.number().int(),
            name: z.unknown(),
            price: z.number().int(),
            limit: z.number().int().nullable(),
            committed: z.number().int().nullable(),
            remaining: z.number().int().nullable(),
        })
        .array(),
});

export const CouplesSchema = availableSection({
    /** Coppie non sciolte con esattamente due iscrizioni attive di ruolo complementare. */
    complete: z.number().int(),
    /** Coppie non sciolte che non soddisfano ancora quella condizione. */
    incomplete: z.number().int(),
    dissolved: z.number().int(),
    total: z.number().int(),
});

export const RequirementsSchema = availableSection({
    configured: z
        .object({
            eventRequirementId: z.number().int(),
            label: z.unknown(),
            mandatory: z.boolean(),
            blocking: z.string(),
            verification: z.string(),
        })
        .array(),
});

export const RegistrationsTrendSchema = availableSection({
    granularity: z.literal("DAY"),
    points: z
        .object({
            date: z.string(),
            count: z.number().int(),
            cumulative: z.number().int(),
        })
        .array(),
});

export const EventDashboardSchema = z.object({
    eventId: z.number().int(),
    slug: z.string(),
    status: EventStatusSchema,
    generatedAt: z.date(),

    /**
     * `RB21` — il perimetro su cui il cruscotto è calcolato, dichiarato in
     * risposta e non lasciato dedurre.
     */
    perimeter: z.object({
        note: z.string(),
        missingEntities: z.string().array(),
    }),

    sections: z.object({
        registrationsByRole: RegistrationsByRoleSchema,
        capacity: CapacitySnapshotSchema,
        committedByTicketType: CommittedByTicketTypeSchema,
        committedServices: CommittedServicesSchema,
        couples: CouplesSchema,
        requirements: RequirementsSchema,
        registrationsTrend: RegistrationsTrendSchema,

        soldByTicketType: UnavailableSectionSchema,
        netRevenue: UnavailableSectionSchema,
        missingRequirements: UnavailableSectionSchema,
        attendance: UnavailableSectionSchema,
    }),
});
export type EventDashboardDTO = z.infer<typeof EventDashboardSchema>;
