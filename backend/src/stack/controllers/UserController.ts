import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST, PUT } from "fastify-decorators";
import { UserService } from "@services/UserService";
import { FileService } from "@services/FileService";
import { Authenticate } from "@middleware/Authenticate";
import { exz, FindOptions } from "@utils/helpers/exz";
import httpErrors from "http-errors";
import { z } from "zod";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionScope } from "@enums/PermissionScope";
import { UserCreateDTO, UserCreateSchema } from "@DTOs/user/UserCreateDTO";
import { UserRegisterDTO, UserRegisterSchema } from "@DTOs/user/UserRegisterDTO";
import { UserUpdateDTO, UserUpdateSchema } from "@DTOs/user/UserUpdateDTO";
import { UserPaginateBodyInputSchema, UserPaginateDTO } from "@DTOs/user/UserQueryDTO";
import { PermissionResource } from "@enums/PermissionResource";
import { RoleToUserUpdateDTO, RoleToUserUpdateSchema } from "@DTOs/role_to_user/RoleToUserUpdateDTO";

@Controller({
    route: "/users",
    tags: [{ name: "Users", description: "User management" }],
})
export class UserController {
    constructor(private readonly userService: UserService) {}

    @POST("/create", {
        schema: {
            operationId: "createUser",
            summary: "Create User",
            body: UserCreateSchema,
            security: [
                {
                    apiKey: []
                }
            ],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.USER, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: UserCreateDTO }>,
        reply: FastifyReply
    ) {
        reply
            .status(200)
            .send(await this.userService.save(+req.user.id, req.body));
    }

    @POST("/register", {
        schema: {
            operationId: "registerUser",
            summary: "Register User",
            description:
                "Public self-registration endpoint. Creates Contact, Person and User in a single transaction and "
                + "assigns the DANCER role. The account is created UNCONFIRMED: it cannot log in or reserve a seat "
                + "until the dancer clicks the button in the confirmation mail. Answers 201 with "
                + "{ user, confirmationSent }; confirmationSent=false means the account exists but the mail did not "
                + "leave, so the caller must offer a resend instead of saying 'check your inbox'. Fails with "
                + "EMAIL_ALREADY_REGISTERED (the way out is logging in) or USERNAME_TAKEN (the way out is another name).",
            body: UserRegisterSchema,
        },
    })
    async register(
        req: FastifyRequest<{ Body: UserRegisterDTO }>,
        reply: FastifyReply
    ) {
        // **Non risponde più con un token di sessione**, e non è una dimenticanza:
        // l'account nasce non confermato, quindi non esiste ancora una sessione
        // da consegnare. Chi si è appena iscritto va nella casella di posta.
        reply
            .status(201)
            .send(await this.userService.register(req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findUser",
            summary: "Get User from id",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [
                {
                    apiKey: []
                }
            ],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.USER, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply
    ) {
        const user = await this.userService.findByIdWithPermission(+req.user.id, +req.params.id, req.query);
        if(!user) {
            throw new httpErrors.NotFound();
        }
        reply
            .status(200)
            .send(user);
    }

    @POST("/", {
        schema: {
            operationId: "paginateUser",
            summary: "Paginate User",
            body: UserPaginateBodyInputSchema,
            security: [
                {
                    apiKey: []
                }
            ],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.USER, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: UserPaginateDTO }>,
        reply: FastifyReply
    ) {
        const { query, options } = req.body;
        reply
            .status(200)
            .send(await this.userService.paginate(+req.user.id, query, options));
    }

    @POST("/trash", {
        schema: {
            operationId: "paginateUserTrashCan",
            summary: "Paginate Users' trash can",
            body: UserPaginateBodyInputSchema,
            security: [
                {
                    apiKey: []
                }
            ],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.USER, PermissionScope.TRASH),
        ],
    })
    async paginateTrashCan(
        req: FastifyRequest<{ Body: UserPaginateDTO }>,
        reply: FastifyReply
    ) {
        const { query, options } = req.body;
        reply
            .status(200)
            .send(await this.userService.paginateTrashCan(+req.user.id, query, options));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteUser",
            summary: "Delete User by id",
            params: exz.pathId,
            security: [
                {
                    apiKey: []
                }
            ],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.USER, PermissionScope.SINGLE),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        const user = await this.userService.safeDeleteById(+req.user.id, +req.params.id);
        if(!user) {
            throw new httpErrors.NotFound();
        }
        reply
            .status(200)
            .send(user);
    }

    @PATCH("/changePassword/:id", {
        schema: {
            operationId: "updateUserPassword",
            summary: "Update current User's password",
            params: exz.pathId,
            body: z.object({
                newPassword: z.string()
            }),
            security: [
                {
                    apiKey: []
                }
            ],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.PASSWORD, PermissionScope.SINGLE),
        ],
    })
    async updateUserPassword(
        req: FastifyRequest<{ Params: { id: string }, Body: { newPassword: string } }>,
        reply: FastifyReply
    ) {
        const user = await this.userService.changeUserPassword(+req.user.id, +(!!req.params.id ? req.params.id : req.user.id), req.body.newPassword);

        if(!user) {
            throw new httpErrors.NotFound();
        }

        reply.status(200)
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateUser",
            summary: "Update User from id",
            params: exz.pathId,
            body: UserUpdateSchema,
            security: [
                {
                    apiKey: []
                }
            ],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.USER, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: UserUpdateDTO }>,
        reply: FastifyReply
    ) {
        const user = await this.userService.updateById(+req.user.id, +req.params.id, req.body);
        if(!user) {
            throw new httpErrors.NotFound();
        }
        reply
            .status(200)
            .send(user);
    }

    @PATCH("/me", {
        schema: {
            operationId: "updateMe",
            summary: "Update User from id",
            body: UserUpdateSchema,
            security: [
                {
                    apiKey: []
                }
            ],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.USER, PermissionScope.OWN),
        ],
    })
    async updateMe(
        req: FastifyRequest<{ Body: UserUpdateDTO }>,
        reply: FastifyReply
    ) {
        const user = await this.userService.updateById(+req.user.id, +req.user.id, req.body);
        if(!user) {
            throw new httpErrors.NotFound();
        }
        reply
            .status(200)
            .send(user);
    }

    @PUT("/:id/logo", {
        schema: {
            operationId: "updateUserLogo",
            summary: "Update User logo",
            description: "Upload an image and set it as the User's logo (User → File). Replaces and deletes the previous logo if present. Accepts only image mime types.",
            params: exz.pathId,
            consumes: ["multipart/form-data"],
            produces: ["application/json"],
            security: [
                {
                    apiKey: []
                }
            ],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.USER, PermissionScope.SINGLE),
        ],
    })
    async updateUserLogo(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        const data = await req.file({ limits: { fileSize: FileService.MAX_FILE_SIZE } });
        if (!data) {
            throw httpErrors.BadRequest("Nessun file caricato.");
        }
        if (data.file.truncated) {
            throw httpErrors.BadRequest("La dimensione del file è troppo elevata!");
        }
        if (data.file.bytesRead && data.file.bytesRead < 0) {
            throw httpErrors.BadRequest("Non è stato possibile leggere il file caricato.");
        }

        const user = await this.userService.updateUserLogo(+req.user.id, +req.params.id, data);
        if (!user) {
            throw new httpErrors.NotFound();
        }

        reply
            .status(200)
            .send(user);
    }

    @PATCH("/:id/roles", {
        schema: {
            operationId: "updateUserRoles",
            summary: "Update current User's roles",
            params: exz.pathId,
            body: RoleToUserUpdateSchema,
            security: [
                {
                    apiKey: []
                }
            ],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.ROLE_TO_USER, PermissionScope.SINGLE),
        ],
    })
    async updateUserRoles(
        req: FastifyRequest<{ Params: { id: string }, Body: RoleToUserUpdateDTO }>,
        reply: FastifyReply
    ) {
        const user = await this.userService.updateUserRoles(+req.user.id, +req.params.id, req.body);

        if(!user) {
            throw new httpErrors.NotFound();
        }

        reply
            .status(200)
            .send(user);
    }
}
