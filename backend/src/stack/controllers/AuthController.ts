import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, GET, POST } from "fastify-decorators";
import { AuthService } from "@services/AuthService";
import { Authenticate } from "@middleware/Authenticate";
import { LoginResponseSchema } from "@DTOs/login/LoginResponseDTO";
import { LoginRequestDTO, LoginRequestSchema } from "@DTOs/login/LoginRequestDTO";
import { EmailConfirmationService } from "@services/EmailConfirmationService";
import { SsoService } from "@services/SsoService";
import { SsoConfigSchema, SsoLoginDTO, SsoLoginSchema } from "@DTOs/login/SsoLoginDTO";
import {
    ConfirmEmailRequestDTO,
    ConfirmEmailRequestSchema,
    ConfirmEmailResponseSchema,
    ResendConfirmationRequestDTO,
    ResendConfirmationRequestSchema,
    ResendConfirmationResponseSchema,
} from "@DTOs/email_confirmation/ConfirmEmailDTO";

@Controller({
    route: "/auth",
    tags: [{ name: "Auth", description: "Authorization" }],
})
export class AuthController {

    constructor(
        private readonly authService: AuthService,
        private readonly emailConfirmationService: EmailConfirmationService,
        private readonly ssoService: SsoService,
    ) {}

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

    @GET("/sso/config", {
        schema: {
            operationId: "ssoConfig",
            summary: "Identity provider settings for the sign-in page",
            description:
                "Public. Returns what the SPA needs to build the authorization request: the provider's authorization "
                + "endpoint, the client id and the scopes. Answers enabled=false — never an error — when the provider "
                + "is not configured or is unreachable, so the sign-in page falls back to username and password "
                + "instead of becoming unusable.",
            response: {
                200: SsoConfigSchema.describe("Identity provider settings, or enabled=false"),
            },
        },
    })
    async ssoConfig(req: FastifyRequest, reply: FastifyReply) {
        reply.status(200).send(await this.ssoService.config());
    }

    @POST("/sso", {
        schema: {
            operationId: "ssoLogin",
            summary: "Sign in through the identity provider",
            description:
                "Public. Takes the authorization code returned by Authentik together with the PKCE verifier, exchanges "
                + "it server-side, verifies the id_token signature against the provider's JWKS and answers with the "
                + "very same session token the password login issues. The account must already exist on mirada: this "
                + "route links an identity, it never creates a user.",
            body: SsoLoginSchema,
            response: {
                200: LoginResponseSchema.describe("Sign-in success"),
            },
        },
    })
    async ssoLogin(
        req: FastifyRequest<{ Body: SsoLoginDTO }>,
        reply: FastifyReply,
    ) {
        const user = await this.ssoService.login(req.body);
        // Lo STESSO payload dell'accesso con password (§3.1): da qui in poi le
        // due strade sono indistinguibili, ed è il punto di tutta la fase.
        reply
            .status(200)
            .send({ token: await reply.jwtSign(this.authService.toTokenPayload(user)) });
    }

    @POST("/confirm-email", {
        schema: {
            operationId: "confirmEmail",
            summary: "Confirm an email address",
            description:
                "Public. Verifies the signed token carried by the confirmation link, marks the address as verified "
                + "and returns a session token so the dancer lands logged in. Idempotent: a second click on the same "
                + "link answers 200 with justConfirmed=false instead of an error. Fails with EMAIL_NOT_CONFIRMED "
                + "when the token is malformed, expired (410) or no longer matches the account's address (409).",
            body: ConfirmEmailRequestSchema,
            response: {
                200: ConfirmEmailResponseSchema.describe("Address confirmed — the session token is ready to use"),
            },
        },
    })
    async confirmEmail(
        req: FastifyRequest<{ Body: ConfirmEmailRequestDTO }>,
        reply: FastifyReply,
    ) {
        const outcome = await this.emailConfirmationService.confirm(req.body.token);
        reply.status(200).send({
            token: await reply.jwtSign(this.authService.toTokenPayload(outcome.user)),
            justConfirmed: outcome.justConfirmed,
            next: outcome.next ?? null,
        });
    }

    @POST("/resend-confirmation", {
        schema: {
            operationId: "resendConfirmation",
            summary: "Send the confirmation link again",
            description:
                "Public. Sends a fresh confirmation link when the address belongs to an account that has never been "
                + "confirmed. Always answers 200 { ok: true }, whether or not the address exists: a response that "
                + "distinguished the two cases would let anyone test a list of addresses against the member base.",
            body: ResendConfirmationRequestSchema,
            response: {
                200: ResendConfirmationResponseSchema.describe("Request accepted — nothing is disclosed about the address"),
            },
        },
    })
    async resendConfirmation(
        req: FastifyRequest<{ Body: ResendConfirmationRequestDTO }>,
        reply: FastifyReply,
    ) {
        await this.emailConfirmationService.resend(req.body.email, req.body.eventSlug ?? null);
        reply.status(200).send({ ok: true });
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
