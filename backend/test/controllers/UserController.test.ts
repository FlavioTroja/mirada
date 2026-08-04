import { login } from "../helpers";

const app = (globalThis as any).__TEST_APP__;

describe("UserController", () => {
    it("should create a new user", async () => {
        const godToken = await login(app, "god", "god");

        const res = await app.inject({
            method: "POST",
            url: "/api/users/create",
            headers: {
                authorization: godToken,
            },
            payload: {
                username: "test_user_controller",
                avatarUrl: "avatar.com",
                note: "Note",
                password: "My Password is",
                person: {
                    name: "TestControllerName",
                    surname: "TestControllerSurname",
                    personType: "USER",
                },
                contact: {
                    email: "testcontroller@test.com",
                },
            },
        });

        expect(res.statusCode).toBe(200);

        const body = res.json();
        expect(body.username).toBe("test_user_controller");
        expect(body.note).toBe("Note");
    });
});
