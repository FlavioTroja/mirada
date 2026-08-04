import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, GET, POST } from "fastify-decorators";
import { AuthService } from "@services/AuthService";
import { Authenticate } from "@middleware/Authenticate";
import { LoginResponseSchema } from "@DTOs/login/LoginResponseDTO";
import { LoginRequestDTO, LoginRequestSchema } from "@DTOs/login/LoginRequestDTO";

@Controller({
    route: "/auth",
    tags: [{ name: "Auth", description: "Authorization" }],
})
export class AuthController {

    constructor(private readonly authService: AuthService) {}

    @POST("/login", {
        schema: {
            operationId: "Login",
            summary: "Login with username and password",
            body: LoginRequestSchema,
            response: {
                200: LoginResponseSchema.describe("Login success"),
            },
        }
    })
    async login(
        req: FastifyRequest<{ Body: LoginRequestDTO }>,
        reply: FastifyReply
    ) {
        const user = await this.authService.login(req.body);
        // §3.1 — si firma il payload **minimo** `{ id, username, wsCode, roles }`.
        // Non `{ ...user }`: quello spandeva l'intera riga utente, hash bcrypt
        // compreso, dentro un blob base64 conservato in `localStorage`.
        reply
            .status(200)
            .send({ token: await reply.jwtSign(this.authService.toTokenPayload(user)) });
    }

    @GET("/profile", {
        schema: {
            operationId: "getProfile",
            summary: "Get ME",
            security: [
                {
                    apiKey: []
                }
            ]
        },
        onRequest: [
            Authenticate(),
        ],
    })
    async getProfile(req: FastifyRequest, reply: FastifyReply) {
        reply.status(200).send(await this.authService.getProfile(req.user));
    }
}
