import { PrismaClient } from '@prisma/client';
import { seed_roles } from "./seed-data/seed_roles";
import { LOGGER } from "@utils/adapters/winston";
import { seed_users } from "./seed-data/seed_users";
import { seed_permissions } from "./seed-data/seed_permissions";
import { seed_configs } from "./seed-data/seed_configs";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { mapPrismaErrorToConsoleError } from "@utils/adapters/prisma";
import {
    ContactOptionalDefaultsSchema,
    PersonOptionalDefaultsSchema,
} from "@prisma-gen/zod";
import { generateRandomString } from "@utils/helpers/crypto";

export async function seed(prisma: PrismaClient) {
    LOGGER.info("Started seeding from prisma/seed.ts");

    const userCount = await prisma.user.count();

    if (userCount !== 0) {
        LOGGER.warn(`Cannot seed users: there are already ${userCount} users. If you want to proceed delete them and their relations with roles`);
    }

    // Roles are upserted row by row (NOT gated on count === 0): adding a role to
    // seed_roles.ts must re-seed it on the next run, and re-running must be a no-op.
    try {
        LOGGER.info("Seeding roles");
        for (const role of seed_roles) {
            await prisma.role.upsert({
                where: { name: role.name },
                update: role,
                create: role,
            });
        }
        LOGGER.info("Seeding roles completed");
    } catch (err) {
        LOGGER.error("Error while seeding roles: ")
        mapPrismaErrorToConsoleError(err as PrismaClientKnownRequestError);
    }

    try {
        if (userCount === 0) {
            LOGGER.info("Seeding users");
            for (const user of seed_users) {
                if (user.isToBeSeeded) {
                    await prisma.user.create({
                        data: {
                            username: user.dto.username,
                            password: user.dto.password,
                            avatarUrl: user.dto.avatarUrl,
                            note: user.dto.note,
                            wsCode: generateRandomString(6),
                            // Gli account del seed nascono **già confermati**:
                            // non passano dal percorso d'iscrizione e nessuno
                            // riceverà mai un'email per loro. Senza questa
                            // riga, `god` e gli utenti di prova non potrebbero
                            // accedere — la stessa ragione per cui la
                            // migrazione popola le righe preesistenti.
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
            }
            LOGGER.info("Seeding users completed");
        } else {
            LOGGER.warn("No need to seed users");
        }

    } catch (err) {
        LOGGER.error("Error while seeding users: ")
        mapPrismaErrorToConsoleError(err as PrismaClientKnownRequestError);
    }

    // Permissions and configs are upserted row by row (NOT gated on count === 0), so
    // adding new rows to the seed-data files re-seeds them on the next run.
    try {
        LOGGER.info("Seeding permissions");
        for (const permission of seed_permissions) {
            await prisma.permissionConfig.upsert({
                where: { action_entity_scope_roleName: permission },
                update: {},
                create: permission,
            });
        }
        LOGGER.info("Seeding permissions completed");
    } catch (err) {
        LOGGER.error("Error while seeding permissions: ")
        mapPrismaErrorToConsoleError(err as PrismaClientKnownRequestError);
    }

    try {
        LOGGER.info("Seeding configs");
        for (const config of seed_configs) {
            await prisma.config.upsert({
                where: { name: config.name },
                update: {},
                create: config,
            });
        }
        LOGGER.info("Seeding configs completed");
    } catch (err) {
        LOGGER.error("Error while seeding configs: ")
        mapPrismaErrorToConsoleError(err as PrismaClientKnownRequestError);
    }

}
