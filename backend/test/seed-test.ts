import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { mapPrismaErrorToConsoleError } from "@utils/adapters/prisma";
import {
    ContactOptionalDefaultsSchema,
    PersonOptionalDefaultsSchema,
} from "@prisma-gen/zod";
import { LOGGER } from "@utils/adapters/winston";
import { seed_roles } from "./seed/seed_roles";
import { PrismaClient } from "@prisma/client";
import { seed_users } from "./seed/seed_users";
import { seed_permissions } from "../prisma/seed-data/seed_permissions";
import { seed_configs } from "../prisma/seed-data/seed_configs";

export async function seed(prisma: PrismaClient) {
    // Domain tables first (children before parents), then the foundation ones.
    // NOTE — this list is NOT derived from the schema: every new model must be
    // added here by hand, in child-before-parent order, or the next test run
    // fails on a foreign key. Phase B tables come first because they all hang off
    // Event, which in turn hangs off Organization and Venue.
    // Fase D1 — requisiti, biglietti, pass, check-in (e i gusci del checkout).
    // CheckIn è Restrict da Ticket, Session e Registration: va per primo.
    // Ticket è Restrict da Event e TicketType, SetNull da OrderLine/PassIssuance:
    // va prima di tutti e quattro. TicketTransfer è Cascade da Ticket ma si
    // cancella esplicitamente, così l'ordine resta leggibile.
    await prisma.checkIn.deleteMany();
    await prisma.ticketTransfer.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.passIssuance.deleteMany();
    await prisma.requirementOutcome.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.orderLine.deleteMany();
    await prisma.order.deleteMany();
    await prisma.purchase.deleteMany();

    // Fase C — il motore di capienza. QuotaConsumption discende da CapacityQuota e
    // Registration; Registration è Restrict da Event, quindi va PRIMA dell'evento.
    await prisma.quotaConsumption.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.couple.deleteMany();
    await prisma.capacityQuota.deleteMany();

    await prisma.priceTier.deleteMany();
    await prisma.ticketTypeSession.deleteMany();
    await prisma.ticketType.deleteMany();
    await prisma.eventCast.deleteMany();
    await prisma.eventRequirement.deleteMany();
    await prisma.eventService.deleteMany();
    await prisma.session.deleteMany();
    // FiscalDeclaration is Restrict on Organization, Event and User: it must go
    // before all three, and it is the reason Event cannot be truncated first.
    await prisma.fiscalDeclaration.deleteMany();
    await prisma.event.deleteMany();

    await prisma.venue.deleteMany();
    await prisma.artist.deleteMany();
    await prisma.refundPolicy.deleteMany();
    await prisma.organizationMember.deleteMany();
    await prisma.dancerProfile.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.eventType.deleteMany();
    await prisma.requirementType.deleteMany();
    await prisma.serviceType.deleteMany();

    await prisma.file.deleteMany();
    await prisma.address.deleteMany();
    await prisma.log.deleteMany();
    await prisma.roleToUser.deleteMany();
    await prisma.user.deleteMany();
    await prisma.person.deleteMany();
    await prisma.contact.deleteMany();
    await prisma.permissionConfig.deleteMany();
    await prisma.hiddenComponentConfig.deleteMany();
    await prisma.config.deleteMany();
    await prisma.role.deleteMany();

    try {
        for (const role of seed_roles) {
            await prisma.role.upsert({
                where: { name: role.name },
                update: role,
                create: role,
            });
        }
    } catch (err) {
        LOGGER.error("Error while seeding roles: ")
        mapPrismaErrorToConsoleError(err as PrismaClientKnownRequestError);
    }

    try {
        for (const user of seed_users) {
            await prisma.user.create({
                data: {
                    username: user.dto.username,
                    password: user.dto.password,
                    avatarUrl: user.dto.avatarUrl,
                    note: user.dto.note,
                    // Come nel seed di sviluppo: questi account non nascono dal
                    // percorso d'iscrizione, quindi nessuno confermerà mai il
                    // loro indirizzo. Senza, ogni test che fa un accesso
                    // fallirebbe con `EMAIL_NOT_CONFIRMED`.
                    emailVerifiedAt: new Date(),
                    ...(user.dto.roles?.length ? {
                        roles: {
                            createMany: {
                                data: user.dto.roles ?? []
                            }
                        }
                    } : {}),
                    person: {
                        create: {
                            ...PersonOptionalDefaultsSchema.omit({ id: true, contactId: true }).parse(user.dto.person),
                            contact: {
                                create: {
                                    ...ContactOptionalDefaultsSchema.parse(user.dto.contact)
                                }
                            }
                        }
                    }
                }
            });
        }

    } catch (err) {
        LOGGER.error("Error while seeding users: ")
        mapPrismaErrorToConsoleError(err as PrismaClientKnownRequestError);
    }

    // Same source of truth as the dev seed (prisma/seed-data) for permissions/configs.
    try {
        for (const permission of seed_permissions) {
            await prisma.permissionConfig.upsert({
                where: { action_entity_scope_roleName: permission },
                update: {},
                create: permission,
            });
        }
    } catch (err) {
        LOGGER.error("Error while seeding permissions: ")
        mapPrismaErrorToConsoleError(err as PrismaClientKnownRequestError);
    }

    try {
        for (const config of seed_configs) {
            await prisma.config.upsert({
                where: { name: config.name },
                update: {},
                create: config,
            });
        }
    } catch (err) {
        LOGGER.error("Error while seeding configs: ")
        mapPrismaErrorToConsoleError(err as PrismaClientKnownRequestError);
    }

    LOGGER.info("Seed completed");
}
