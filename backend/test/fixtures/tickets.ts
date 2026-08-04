import {
    CheckInKind,
    DanceRole,
    DeclaredDanceRole,
    PrismaClient,
    RegistrationChannel,
    RegistrationStatus,
    RequirementBlocking,
    RequirementKind,
    RequirementOutcomeStatus,
    RequirementVerification,
    Ticket,
    TicketStatus,
} from "@prisma/client";
import { randomBytes } from "node:crypto";
import { getPrismaClient } from "@utils/adapters/prisma";
import { encryptPasswordSync } from "@utils/helpers/crypto";

/**
 * Fixture della fase D1 — biglietti, ingressi, requisiti.
 *
 * Come in fase C: **dati reali su Postgres, nessun mock**. L'oggetto sotto
 * collaudo qui è l'indice unico parziale di `RB7` e la firma Ed25519, e un mock
 * di entrambi darebbe sempre la risposta che ci si aspetta invece di quella che
 * il sistema dà davvero.
 */

let sequence = 0;
const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++sequence}`;

export function newCode(): string {
    return randomBytes(16).toString("hex").toUpperCase();
}

/** Un'iscrizione confermata con il suo biglietto valido. */
export async function createTicketFor(input: {
    eventId: number;
    ticketTypeId: number;
    role?: DanceRole | null;
    holderName?: string;
    holderSurname?: string;
    holderEmail?: string | null;
    bearer?: boolean;
    status?: TicketStatus;
    channel?: RegistrationChannel;
    personUserId?: number | null;
    prisma?: PrismaClient;
}): Promise<{ ticket: Ticket; registrationId: number }> {
    const prisma = input.prisma ?? getPrismaClient();
    const tag = unique("tk");

    const registration = await prisma.registration.create({
        data: {
            eventId: input.eventId,
            personUserId: input.personUserId ?? null,
            holderName: input.holderName ?? "Nome",
            holderSurname: input.holderSurname ?? tag,
            holderEmail: input.holderEmail ?? `${tag}@test.it`,
            declaredRole: input.role === DanceRole.FOLLOWER
                ? DeclaredDanceRole.FOLLOWER
                : input.role === DanceRole.LEADER
                    ? DeclaredDanceRole.LEADER
                    : DeclaredDanceRole.FLEXIBLE,
            assignedRole: input.role ?? null,
            channel: input.channel ?? RegistrationChannel.ONLINE_SALE,
            status: RegistrationStatus.CONFIRMED,
            confirmedAt: new Date(),
        },
    });

    const ticket = await prisma.ticket.create({
        data: {
            eventId: input.eventId,
            ticketTypeId: input.ticketTypeId,
            registrationId: registration.id,
            code: newCode(),
            status: input.status ?? TicketStatus.VALID,
            holderName: input.holderName ?? "Nome",
            holderSurname: input.holderSurname ?? tag,
            holderEmail: input.bearer ? null : (input.holderEmail ?? `${tag}@test.it`),
            bearer: input.bearer ?? false,
            qrIssuedAt: new Date(),
        },
    });

    return { ticket, registrationId: registration.id };
}

/** Un ingresso già registrato — il «primo ingresso» dei casi `ALREADY_USED`. */
export async function createCheckIn(input: {
    ticketId: number;
    sessionId: number;
    registrationId: number;
    operatorUserId: number;
    deviceId?: string;
    scannedAt?: Date;
    offline?: boolean;
    conflictWithId?: number | null;
    prisma?: PrismaClient;
}) {
    const prisma = input.prisma ?? getPrismaClient();
    return prisma.checkIn.create({
        data: {
            ticketId: input.ticketId,
            sessionId: input.sessionId,
            registrationId: input.registrationId,
            operatorUserId: input.operatorUserId,
            kind: CheckInKind.OPERATOR,
            scannedAt: input.scannedAt ?? new Date(),
            deviceId: input.deviceId ?? "porta-1",
            offline: input.offline ?? false,
            conflictWithId: input.conflictWithId ?? null,
        },
    });
}

/** Un requisito bloccante **in ingresso**, con l'esito già registrato o assente. */
export async function createEntryRequirement(input: {
    eventId: number;
    label?: string;
    registrationId?: number;
    outcomeStatus?: RequirementOutcomeStatus | null;
    prisma?: PrismaClient;
}) {
    const prisma = input.prisma ?? getPrismaClient();

    const requirementType = await prisma.requirementType.create({
        data: { name: { it: "Dichiarazione" }, kind: RequirementKind.DECLARATION },
    });

    const requirement = await prisma.eventRequirement.create({
        data: {
            eventId: input.eventId,
            requirementTypeId: requirementType.id,
            label: { it: input.label ?? "Liberatoria fotografica" },
            text: { it: "CONTENUTO RISERVATO DEL REQUISITO — non deve mai uscire verso il check-in (RB12)" },
            mandatory: true,
            blocking: RequirementBlocking.ENTRY,
            verification: RequirementVerification.AUTOMATIC,
        },
    });

    if (input.registrationId && input.outcomeStatus) {
        await prisma.requirementOutcome.create({
            data: {
                registrationId: input.registrationId,
                eventRequirementId: requirement.id,
                status: input.outcomeStatus,
                value: { dichiarato: "DATO SENSIBILE DEL REQUISITO" },
                acceptedAt: new Date(),
                acceptedIp: "127.0.0.1",
            },
        });
    }

    return requirement;
}

/** Un utente reale con profilo da ballerino — il destinatario di un trasferimento. */
export async function createDancer(input: {
    nickname?: string;
    preferredRole?: "LEADER" | "FOLLOWER" | "BOTH";
    email?: string;
    prisma?: PrismaClient;
}) {
    const prisma = input.prisma ?? getPrismaClient();
    const tag = unique("dancer");
    const email = input.email ?? `${tag}@test.it`;

    const user = await prisma.user.create({
        data: {
            username: tag,
            password: encryptPasswordSync("secret"),
            person: {
                create: {
                    name: "Nuovo",
                    surname: "Titolare",
                    personType: "USER",
                    contact: { create: { email } },
                },
            },
        },
    });

    const profile = await prisma.dancerProfile.create({
        data: {
            userId: user.id,
            nickname: input.nickname ?? tag,
            preferredRole: input.preferredRole ?? "BOTH",
        },
    });

    return { user, profile, email };
}
