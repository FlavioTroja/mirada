import { configureServiceTest } from "fastify-decorators/testing";
import { UserService } from "@services/UserService";
import { User } from "@prisma-gen/zod";
import { UserCreateDTO } from "@DTOs/user/UserCreateDTO";

describe("UserService", () => {
    let userService: UserService;
    let godUser: User;

    beforeAll(async () => {
        userService = await configureServiceTest({ service: UserService });

        const found = await userService.findOne({ username: "god" });
        expect(found).not.toBeNull();
        godUser = found!;
    });

    it("should find a user by username", async () => {
        const user = await userService.findOne({ username: "god" });

        expect(user).not.toBeNull();
        expect(user!.username).toBe("god");
        expect(user!.id).toBe(godUser.id);
    });

    it("should create a new user", async () => {
        const dto: UserCreateDTO = {
            username: "test_user",
            avatarUrl: "avatar.com",
            note: "Note",
            password: "My Password is",
            person: {
                name: "TestName",
                surname: "TestSurname",
                personType: "USER",
            },
            contact: {
                email: "test@test.com",
            },
        };

        const newUser = await userService.save(godUser.id, dto);

        expect(newUser).toBeDefined();
        expect(newUser?.username).toBe("test_user");
        expect(newUser?.note).toBe("Note");
    });
});
