import { FastifyApplication } from "../types";

export async function login(app: FastifyApplication, username: string, password: string) {
    const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { usernameOrEmail: username, password },
    });
    if (res.statusCode !== 200) {
        throw new Error(`Failed to login as ${username}: ${res.statusCode} ${res.body}`);
    }
    return `Bearer ${res.json().token}`;
}
