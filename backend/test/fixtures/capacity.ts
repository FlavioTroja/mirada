import { CapacityQuota, DanceRole, DeclaredDanceRole, Event, EventTypeFamily, PrismaClient, QuotaReservedFor, QuotaScope, RegistrationChannel, RegistrationStatus } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";

/**
 * Fixture del motore di capienza — costruisce con dati **reali** su Postgres lo
 * scenario di ciascun caso di `05-modello-capienza.md` §13.
 *
 * Niente mock: la regola 1 di `.claude/rules/testing.md` non ammette eccezioni, e
 * qui sarebbe comunque autolesionista — l'oggetto sotto collaudo è
 * l'aggiornamento condizionato di PostgreSQL, che un mock riprodurrebbe sempre
 * "giusto" e mai come si comporta davvero sotto lock.
 */

let sequence = 0;
const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++sequence}`;

export type CapacityScenario = {
    event: Event;
    sessionIds: number[];
    ticketTypeId: number;
    serviceId: number;
    organizationId: number;
};

/** Un evento completo: organizzazione, sala, tipo, sessioni, titolo, servizio. */
export async function createEventScenario(options: {
    sessions?: number;
    /** La famiglia del tipo evento. `COURSE` serve a provare che i corsi non escano in pubblico. */
    family?: EventTypeFamily;
    prisma?: PrismaClient;
} = {}): Promise<CapacityScenario> {
    const prisma = options.prisma ?? getPrismaClient();
    const sessionCount = options.sessions ?? 1;

    const address = await prisma.address.create({ data: { city: "Roma", country: "IT" } });

    const organization = await prisma.organization.create({
        data: {
            name: unique("org"),
            legalName: "Mirada Test S.r.l.",
            legalForm: "SRL",
            contactEmail: `${unique("org")}@test.it`,
            status: "APPROVED",
            payoutStatus: "ENABLED",
        },
    });

    const venue = await prisma.venue.create({
        data: { name: unique("venue"), addressId: address.id, organizationId: organization.id, capacity: 220 },
    });

    const eventType = await prisma.eventType.create({
        data: {
            name: { it: "Marathon" },
            slug: unique("marathon"),
            family: options.family ?? EventTypeFamily.EVENT,
            capMultiSession: true,
            capRoleQuotas: true,
            capCouple: true,
        },
    });

    const event = await prisma.event.create({
        data: {
            organizationId: organization.id,
            eventTypeId: eventType.id,
            venueId: venue.id,
            title: { it: "Evento di collaudo" },
            slug: unique("evento"),
            description: { it: "Collaudo del motore di capienza" },
            startAt: new Date(Date.now() + 86_400_000),
            endAt: new Date(Date.now() + 172_800_000),
            contentLanguage: "it",
            status: "PUBLISHED",
            publishedAt: new Date(),
        },
    });

    const sessionIds: number[] = [];
    for (let index = 0; index < sessionCount; index += 1) {
        const session = await prisma.session.create({
            data: {
                eventId: event.id,
                name: { it: `Sessione ${index + 1}` },
                startAt: new Date(Date.now() + 86_400_000 + index * 3_600_000),
                endAt: new Date(Date.now() + 86_400_000 + (index + 1) * 3_600_000),
                sortOrder: index,
            },
        });
        sessionIds.push(session.id);
    }

    const ticketType = await prisma.ticketType.create({
        data: {
            eventId: event.id,
            name: { it: "Full Pass" },
            basePrice: 9_000,
            sessions: { create: sessionIds.map(sessionId => ({ sessionId })) },
        },
    });

    const serviceType = await prisma.serviceType.create({
        data: { name: { it: "Cena" }, attributesSchema: {} },
    });

    const eventService = await prisma.eventService.create({
        data: {
            eventId: event.id,
            serviceTypeId: serviceType.id,
            name: { it: "Cena di gala" },
            price: 2_500,
        },
    });

    return {
        event,
        sessionIds,
        ticketTypeId: ticketType.id,
        serviceId: eventService.id,
        organizationId: organization.id,
    };
}

/** Crea una quota già in uno stato dato — è il modo in cui il §13 descrive gli scenari. */
export async function createQuota(input: {
    eventId: number;
    scope: QuotaScope;
    scopeId?: number | null;
    role?: DanceRole | null;
    limit: number;
    consumed?: number;
    limiting?: boolean;
    reservedFor?: QuotaReservedFor | null;
    imbalanceTolerance?: number | null;
    overbookAllowance?: number;
    publiclyVisible?: boolean;
    prisma?: PrismaClient;
}): Promise<CapacityQuota> {
    const prisma = input.prisma ?? getPrismaClient();
    return prisma.capacityQuota.create({
        data: {
            eventId: input.eventId,
            scope: input.scope,
            scopeId: input.scopeId ?? null,
            role: input.role ?? null,
            limit: input.limit,
            consumed: input.consumed ?? 0,
            limiting: input.limiting ?? true,
            reservedFor: input.reservedFor ?? null,
            imbalanceTolerance: input.imbalanceTolerance ?? null,
            overbookAllowance: input.overbookAllowance ?? 0,
            publiclyVisible: input.publiclyVisible ?? true,
        },
    });
}

/**
 * Le due quote di ruolo appaiate di ambito evento, con la stessa tolleranza —
 * `05` §2.1 la vuole coerente fra le due.
 */
export async function createRoleQuotas(input: {
    eventId: number;
    leaderLimit: number;
    followerLimit: number;
    leaderConsumed?: number;
    followerConsumed?: number;
    tolerance?: number | null;
}): Promise<{ leader: CapacityQuota; follower: CapacityQuota }> {
    const leader = await createQuota({
        eventId: input.eventId,
        scope: QuotaScope.EVENT,
        role: DanceRole.LEADER,
        limit: input.leaderLimit,
        consumed: input.leaderConsumed ?? 0,
        imbalanceTolerance: input.tolerance ?? null,
    });
    const follower = await createQuota({
        eventId: input.eventId,
        scope: QuotaScope.EVENT,
        role: DanceRole.FOLLOWER,
        limit: input.followerLimit,
        consumed: input.followerConsumed ?? 0,
        imbalanceTolerance: input.tolerance ?? null,
    });
    return { leader, follower };
}

export async function createRegistration(input: {
    eventId: number;
    declaredRole: DeclaredDanceRole;
    channel?: RegistrationChannel;
    status?: RegistrationStatus;
    coupleId?: number | null;
    prisma?: PrismaClient;
}) {
    const prisma = input.prisma ?? getPrismaClient();
    const tag = unique("reg");
    return prisma.registration.create({
        data: {
            eventId: input.eventId,
            holderName: "Nome",
            holderSurname: tag,
            holderEmail: `${tag}@test.it`,
            declaredRole: input.declaredRole,
            channel: input.channel ?? RegistrationChannel.ONLINE_SALE,
            status: input.status ?? RegistrationStatus.TO_CONFIRM,
            coupleId: input.coupleId ?? null,
        },
    });
}

/** Lettura secca del contatore, senza passare dal servizio sotto collaudo. */
export async function readConsumed(quotaId: number): Promise<number> {
    const quota = await getPrismaClient().capacityQuota.findUniqueOrThrow({ where: { id: quotaId } });
    return quota.consumed;
}

export async function countConsumptions(quotaId: number): Promise<number> {
    return getPrismaClient().quotaConsumption.count({ where: { capacityQuotaId: quotaId } });
}
