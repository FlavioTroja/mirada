import { configureServiceTest } from "fastify-decorators/testing";
import { AuthService } from "@services/AuthService";
import { UserService } from "@services/UserService";
import { User } from "@prisma-gen/zod";
import { UserCreateDTO } from "@DTOs/user/UserCreateDTO";

const PASSWORD = "Sup3rSecret!";

describe("AuthService.login — SaaS account gates", () => {
    let authService: AuthService;
    let userService: UserService;
    let godUser: User;

    const baseDto = (suffix: string): UserCreateDTO => ({
        username: `login_${suffix}`,
        password: PASSWORD,
        person: { name: "Test", surname: suffix, personType: "USER" },
        contact: { email: `login_${suffix}@test.com` },
    });

    beforeAll(async () => {
        authService = await configureServiceTest({ service: AuthService });
        userService = await configureServiceTest({ service: UserService });

        const found = await userService.findOne({ username: "god" });
        expect(found).not.toBeNull();
        godUser = found!;
    });

    it("allows login for an enabled, non-expired, already-active user", async () => {
        await userService.save(godUser.id, baseDto("valid"));

        const user = await authService.login({ usernameOrEmail: "login_valid", password: PASSWORD });

        expect(user).toBeDefined();
        expect(user.username).toBe("login_valid");
    });

    it("rejects login with wrong password (401)", async () => {
        await expect(
            authService.login({ usernameOrEmail: "login_valid", password: "wrong" })
        ).rejects.toMatchObject({ statusCode: 401 });
    });

    it("rejects login for a disabled account (401)", async () => {
        await userService.save(godUser.id, { ...baseDto("disabled"), enabled: false });

        await expect(
            authService.login({ usernameOrEmail: "login_disabled", password: PASSWORD })
        ).rejects.toMatchObject({ statusCode: 401, message: "Account disabilitato." });
    });

    it("rejects login for an account not yet active (future activatedAt) (401)", async () => {
        const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
        await userService.save(godUser.id, { ...baseDto("future"), activatedAt: future });

        await expect(
            authService.login({ usernameOrEmail: "login_future", password: PASSWORD })
        ).rejects.toMatchObject({ statusCode: 401, message: "Account non ancora attivo." });
    });

    it("rejects login for an expired account (past expiresAt) (401)", async () => {
        const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
        await userService.save(godUser.id, { ...baseDto("expired"), expiresAt: past });

        await expect(
            authService.login({ usernameOrEmail: "login_expired", password: PASSWORD })
        ).rejects.toMatchObject({ statusCode: 401, message: "Account scaduto." });
    });

    it("rejects login for a soft-deleted account (401)", async () => {
        const created = await userService.save(godUser.id, baseDto("deleted"));
        await userService.safeDeleteById(godUser.id, created!.id);

        await expect(
            authService.login({ usernameOrEmail: "login_deleted", password: PASSWORD })
        ).rejects.toMatchObject({ statusCode: 401, message: "Account non più attivo." });
    });
});
