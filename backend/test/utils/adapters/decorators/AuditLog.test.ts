import { configureServiceTest } from "fastify-decorators/testing";
import { UserService } from "@services/UserService";
import { getPrismaClient } from "@utils/adapters/prisma";
import { requestStorage } from "@utils/adapters/requestContext";
import { Level, Log, Prisma } from "@prisma/client";
import { UserCreateDTO } from "@DTOs/user/UserCreateDTO";

/**
 * Tests the @AuditLog aspect (src/utils/adapters/decorators/AuditLog.ts).
 *
 * After the LogService injection was removed from services, the aspect resolves
 * the LogService from the DI container itself (getInstanceByToken). These tests
 * exercise a decorated service end-to-end and assert that:
 *   - a successful call persists an audit row (CREATE / UPDATE / DELETE),
 *   - entityId is taken from the configured `entityIdFrom`,
 *   - the current actor (AsyncLocalStorage) is stamped onto the row,
 *   - a throwing call still writes an ERROR row and re-throws.
 *
 * The aspect persists fire-and-forget (the write is NOT awaited by the wrapped
 * method), so every assertion polls the Log table until the row appears.
 */
describe("AuditLog aspect", () => {
    let userService: UserService;
    let godId: number;
    let seq = 0;

    const prisma = () => getPrismaClient();

    const uniqueDto = (): UserCreateDTO => {
        seq += 1;
        const tag = `audit_${godId}_${seq}`;
        return {
            username: tag,
            avatarUrl: "avatar.com",
            password: "secret",
            person: { name: "Aspect", surname: "Test", personType: "USER" },
            contact: { email: `${tag}@audit.test` },
        };
    };

    // Polls until a Log row matching `where` (and the optional `predicate`) shows up.
    const waitForLog = async (
        where: Prisma.LogWhereInput,
        predicate?: (log: Log) => boolean,
        timeoutMs = 5000,
    ): Promise<Log | null> => {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeoutMs) {
            const rows = await prisma().log.findMany({ where, orderBy: { id: "desc" } });
            const match = predicate ? rows.find(predicate) : rows[0];
            if (match) return match;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        return null;
    };

    const methodOf = (log: Log): string | undefined => (log.input as any)?.method;

    beforeAll(async () => {
        userService = await configureServiceTest({ service: UserService });
        const god = await userService.findOne({ username: "god" });
        expect(god).not.toBeNull();
        godId = god!.id;
    });

    it("writes a CREATE audit row when save() succeeds", async () => {
        const created = await userService.save(godId, uniqueDto());
        expect(created).toBeDefined();

        const log = await waitForLog(
            { entityName: Prisma.ModelName.User, entityId: created!.id },
            l => methodOf(l) === "save",
        );

        expect(log).not.toBeNull();
        expect(log!.level).toBe(Level.INFO);
        expect(log!.hasError).toBeFalsy();
        expect(log!.entityName).toBe("User");
        expect(log!.entityId).toBe(created!.id);
        expect(methodOf(log!)).toBe("save");
    });

    it("stamps the current actor taken from the request context", async () => {
        const created = await requestStorage.run(
            { actorId: godId, actorUsername: "god" },
            () => userService.save(godId, uniqueDto()),
        );

        const log = await waitForLog(
            { entityName: Prisma.ModelName.User, entityId: created!.id },
            l => methodOf(l) === "save",
        );

        expect(log).not.toBeNull();
        expect(log!.actionById).toBe(godId);
        expect(log!.actionByUsername).toBe("god");
    });

    it("writes an UPDATE row with entityId resolved from the call params", async () => {
        const created = await userService.save(godId, uniqueDto());

        const updated = await userService.updateById(godId, created!.id, { note: "audit-updated" });
        expect(updated).not.toBeNull();

        const log = await waitForLog(
            { entityName: Prisma.ModelName.User, entityId: created!.id },
            l => methodOf(l) === "updateById",
        );

        expect(log).not.toBeNull();
        expect(log!.level).toBe(Level.INFO);
        expect(log!.entityId).toBe(created!.id);
    });

    it("writes a DELETE row when safeDeleteById() succeeds", async () => {
        const created = await userService.save(godId, uniqueDto());

        await userService.safeDeleteById(godId, created!.id);

        const log = await waitForLog(
            { entityName: Prisma.ModelName.User, entityId: created!.id },
            l => methodOf(l) === "safeDeleteById",
        );

        expect(log).not.toBeNull();
        expect(log!.entityId).toBe(created!.id);
    });

    it("writes an ERROR row and re-throws when the wrapped method fails", async () => {
        const missingId = 999_999;

        await expect(
            userService.updateById(godId, missingId, { note: "nope" }),
        ).rejects.toBeDefined();

        const log = await waitForLog({
            entityName: Prisma.ModelName.User,
            entityId: missingId,
            hasError: true,
        });

        expect(log).not.toBeNull();
        expect(log!.level).toBe(Level.ERROR);
        expect(log!.hasError).toBe(true);
    });
});
