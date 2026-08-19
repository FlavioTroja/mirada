import fastify, { FastifyReply, FastifyRequest } from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUI from "@fastify/swagger-ui";
import fastifyHelmet from "@fastify/helmet";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import * as process from "process";
import { Log } from "@utils/adapters/log";
import { hasZodFastifySchemaValidationErrors, jsonSchemaTransform, serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod";
import { bootstrap, getInstanceByToken } from "fastify-decorators";
import { AuthController } from "@controllers/AuthController";
import { ZodError } from "zod";
import { FastifyApplication } from "../types";
import { UserController } from "@controllers/UserController";
import { HttpError } from "http-errors";
import { FileController } from "@controllers/FileController";
import { LogController } from "@controllers/LogController";
import { AddressController } from "@controllers/AddressController";
import { GoogleMapsApiController } from "@controllers/GoogleApiController";
import { initializeWebSocketServer, closeWebSocketServer } from "@websocket/server/WebSocketServer";
import { ConfigController } from "@controllers/ConfigController";
import { HiddenComponentConfigController } from "@controllers/HiddenComponentConfigController";
import { PersonController } from "@controllers/PersonController";
import { ContactController } from "@controllers/ContactController";
import { CronController } from "@controllers/CronController";
import { requestStorage } from "@utils/adapters/requestContext";
import { isDomainError } from "@utils/helpers/domainError";
import { ArtistController } from "@controllers/ArtistController";
import { DancerProfileController } from "@controllers/DancerProfileController";
import { EventTypeController } from "@controllers/EventTypeController";
import { OrganizationController } from "@controllers/OrganizationController";
import { PlatformController } from "@controllers/PlatformController";
import { OrganizationMemberController } from "@controllers/OrganizationMemberController";
import { OrganizationInvitationController } from "@controllers/OrganizationInvitationController";
import { RefundPolicyController } from "@controllers/RefundPolicyController";
import { RequirementTypeController } from "@controllers/RequirementTypeController";
import { ServiceTypeController } from "@controllers/ServiceTypeController";
import { VenueController } from "@controllers/VenueController";
import { EventController } from "@controllers/EventController";
import { EventCastController } from "@controllers/EventCastController";
import { EventRequirementController } from "@controllers/EventRequirementController";
import { EventServiceController } from "@controllers/EventServiceController";
import { FiscalDeclarationController } from "@controllers/FiscalDeclarationController";
import { PublicController } from "@controllers/PublicController";
import { SessionController } from "@controllers/SessionController";
import { TicketTypeController } from "@controllers/TicketTypeController";
import { CapacityQuotaController } from "@controllers/CapacityQuotaController";
import { QuotaConsumptionController } from "@controllers/QuotaConsumptionController";
import { RegistrationController } from "@controllers/RegistrationController";
import { CoupleController } from "@controllers/CoupleController";
import { RequirementOutcomeController } from "@controllers/RequirementOutcomeController";
import { TicketController } from "@controllers/TicketController";
import { TicketTransferController } from "@controllers/TicketTransferController";
import { PassIssuanceController } from "@controllers/PassIssuanceController";
import { CheckInController } from "@controllers/CheckInController";
import { OrderController } from "@controllers/OrderController";
import { PurchaseController } from "@controllers/PurchaseController";
import { ReservationController } from "@controllers/ReservationController";
import { PaymentController } from "@controllers/PaymentController";
import { ReservationExpiryJob } from "@utils/adapters/cron/ReservationExpiryJob";

export class APIServer {
    private readonly server: FastifyApplication;

    public get instance(): FastifyApplication {
        return this.server;
    }

    constructor() {
        const app = fastify({
            logger: process.env.NODE_ENV === 'development',
            disableRequestLogging: true,
            pluginTimeout: 100000,
        })
        this.server = app.withTypeProvider<ZodTypeProvider>();
        this.setupMultipart();
        this.serveStaticInDev();

        this.configureAuthentication();
        this.configureRequestContext();

        this.addSecurityConfiguration();
        this.configureSwagger();
        this.configureCors();
        this.registerController();
        this.registerCronJobs();

        this.setupFastifyConfiguration();

        this.setupWebSocketServer();
    }

    public async start(host: string = process.env.HOST!, port: number = +process.env.PORT!, nodeEnv: string = process.env.NODE_ENV!) {
        try {
            await this.server.ready();
            this.server.swagger();
            await this.server.listen({ host, port: port })
                .then(() => Log.info(`API Server up and running in ${nodeEnv} environment on port ${port}!`));
            const docsHost = host === "0.0.0.0" ? "localhost" : host;
            Log.info(`Swagger docs available at http://${docsHost}:${port}/docs`);
        } catch (err) {
            this.server.log.error(err);
            process.exit(1);
        }
    }

    public async stop() {
        closeWebSocketServer();
        return new Promise<boolean>(resolve => {
            if (this.server) {
                this.server.close(() => resolve(true));
            } else {
                return resolve(true);
            }
        });
    }

    private setupFastifyConfiguration() {
        Log.info("Setup Fastify Configuration!");

        this.server.setValidatorCompiler(validatorCompiler);
        this.server.setSerializerCompiler(serializerCompiler);
        this.server.setErrorHandler(
            (error: Error, req: FastifyRequest, reply: FastifyReply) => {
                // backend-brief §3.3 — gli errori di validazione DEVONO uscire come
                // `400 { error: "ZodError", message, issues }`: il frontend mappa
                // `issues[].path` sui campi del form.
                //
                // `fastify-type-provider-zod` NON rilancia un `ZodError` grezzo: lo
                // avvolge in un errore di validazione di Fastify, quindi il solo
                // `instanceof ZodError` non scattava e ogni corpo non valido usciva
                // come 500 con un messaggio concatenato e nessun `issues`.
                // Verificato: `POST /api/venues/create {"name":123}` → 500.
                if (hasZodFastifySchemaValidationErrors(error)) {
                    reply.status(400).send({
                        error: "ZodError",
                        message: "Schema validation error",
                        issues: error.validation.map(v => ({
                            // `createValidationError` appiattisce l'issue Zod:
                            // `path` → `instancePath` ("/name"), `code` → `keyword`,
                            // e `params` conserva il resto (expected, received, …).
                            path: v.instancePath.split("/").filter(Boolean),
                            code: v.keyword,
                            message: v.message,
                            ...v.params,
                        })),
                    });
                    return;
                }

                if (error instanceof ZodError) {
                    reply.status(400).send({
                        error: "ZodError",
                        message: "Schema validation error",
                        issues: error.issues,
                    });
                    return;
                }

                if (error instanceof HttpError) {
                    // backend-brief §3.3 — gli errori di dominio portano un `code`
                    // stabile (SOLD_OUT, PAYOUT_NOT_ENABLED, …) che il frontend deve
                    // distinguere (RF-PAY-17). Gli altri conservano lo statusCode.
                    const domain = isDomainError(error) ? error : undefined;
                    return reply.status(error.statusCode).send({
                        error: "HttpError",
                        code: domain?.domainCode ?? error.statusCode,
                        message: error.message,
                        ...(domain?.payload && { payload: domain.payload }),
                        ...(process.env.NODE_ENV === "development" && {
                            stack: error.stack,
                        }),
                    });
                }

                reply.status(500).send({
                    error: error.name,
                    message: error.message,
                    details: (error as any).details,
                });
            }
        );
    }

    private configureRequestContext() {
        Log.info("Setup Request Context (AsyncLocalStorage)!");
        // preHandler runs AFTER route-level Authenticate() has populated request.user.
        // Using the (req, reply, done) signature lets enterWith run synchronously
        // so the store is bound to the current async resource and propagates to the handler.
        this.server.addHook("preHandler", (request, _reply, done) => {
            const user = (request as any).user;
            requestStorage.enterWith({
                actorId: user?.id,
                actorUsername: user?.username,
            });
            done();
        });
    }

    private configureAuthentication() {
        Log.info("Setup Authenticator!");
        this.server.register(fastifyJwt, {
            secret: process.env.JWT_SECRET!,
            sign: {
                expiresIn: process.env.NODE_ENV === "production" ? "1d" : "30d"
            }
        });
    }

    private addSecurityConfiguration() {
        this.server.register(fastifyHelmet, {
            contentSecurityPolicy: {
                directives: {
                    ...fastifyHelmet.contentSecurityPolicy.getDefaultDirectives(),
                    "script-src": ["'self'", "'unsafe-inline'"],
                },
            },
            crossOriginOpenerPolicy: {
                policy: "unsafe-none",
            },
        });
    }

    private configureCors() {
        Log.info("Setup CORS configuration!");
        this.server.register(fastifyCors, {
            origin: process.env.NODE_ENV !== "production"
                ? [
                    "*",
                    // "http://localhost:4200"
                ]
                : [
                    // List of URLs allowed to call the API in production env from browsers
                    // "https://google.com",
                ],
            methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        });
    }

    private configureSwagger() {
        Log.info("Setup SWAGGER!");

        this.server.register(fastifySwagger, {
            openapi: {
                info: {
                    title: "",
                    description: process.env.npm_package_version!,
                    version: process.env.npm_package_version!,
                },
                components: {
                    securitySchemes: {
                        apiKey: {
                            type: "apiKey",
                            description: "Bearer token",
                            name: "Authorization",
                            in: "header",
                        },
                        xApiKey: {
                            type: "apiKey",
                            description: "Key for master-slave server communication",
                            name: "x-api-key",
                            in: "header",
                        },
                    },
                },
            },
            transform: jsonSchemaTransform,
            hideUntagged: true
        });

        this.server.register(fastifySwaggerUI, {
            routePrefix: "/docs",
            staticCSP:
                "default-src 'self'; base-uri 'self'; font-src 'self' https: data:; frame-ancestors 'self'; img-src 'self' data: validator.swagger.io; object-src 'none'; script-src 'self' 'unsafe-inline'; script-src-attr 'none'; style-src 'self' fonts.googleapis.com; upgrade-insecure-requests;",
            theme: {
                title: "mirada-backend API",
            },
            initOAuth: undefined,
            uiConfig: {
                persistAuthorization: true,
            }
        });

    }

    private registerController() {
        Log.info("Load All Controllers!");
        // Log.info(resolve(__dirname, "controllers"));

        this.server.register(bootstrap, {
            // directory: resolve(__dirname, "controllers"),
            // mask: /\.controller\./,
            controllers: [
                AddressController,
                AuthController,
                ConfigController,
                CronController,
                FileController,
                HiddenComponentConfigController,
                LogController,
                UserController,
                GoogleMapsApiController,
                PersonController,
                ContactController,
                // --- Mirada Tango, fase A ---
                ArtistController,
                DancerProfileController,
                EventTypeController,
                OrganizationController,
                PlatformController,
                OrganizationMemberController,
                OrganizationInvitationController,
                RefundPolicyController,
                RequirementTypeController,
                ServiceTypeController,
                VenueController,
                // --- Mirada Tango, fase B ---
                EventController,
                EventCastController,
                EventRequirementController,
                EventServiceController,
                FiscalDeclarationController,
                PublicController,
                SessionController,
                TicketTypeController,
                CapacityQuotaController,
                QuotaConsumptionController,
                RegistrationController,
                CoupleController,
                // --- Mirada Tango, fase D1 ---
                RequirementOutcomeController,
                TicketController,
                TicketTransferController,
                PassIssuanceController,
                CheckInController,
                // --- Mirada Tango, fase D2 — checkout (passi 18→22) ---
                OrderController,
                PurchaseController,
                ReservationController,
                PaymentController,
            ].sort((curr, next) => curr.name < next.name ? -1 : 1 ),
            prefix: "/api"
        });
    }

    private registerCronJobs() {
        Log.info("Register Cron Jobs!");

        // Nella suite di test il tempo non passa davvero e il database viene
        // troncato fra un file e l'altro: un tick al minuto che rilascia
        // prenotazioni mentre un test le sta osservando renderebbe la suite non
        // deterministica. Il job resta comunque collaudabile: la rotta manuale
        // `POST /api/cron/release-expired-reservations` esegue lo stesso metodo.
        if (process.env.NODE_ENV === "test") {
            Log.info("Cron jobs are not scheduled in the test environment — use POST /api/cron/<job> instead.");
            return;
        }

        // §4.11, `RF-PAY-24`, rischio `R1b`: senza questa passata, in apertura
        // vendite i posti restano bloccati da ordini abbandonati.
        ReservationExpiryJob.runJob(this.server);
    }

    private setupWebSocketServer() {
        Log.info("Starting WebSocket...");
        initializeWebSocketServer(this.server.server);
    }


    private setupMultipart() {
        Log.info("Setup Multipart Configuration!");

        this.server.register(fastifyMultipart);
    }

    private serveStaticInDev() {
        if (process.env.NODE_ENV !== "development") {
            return;
        }

        Log.info("Serving public/ statically (dev only)!");

        this.server.register(fastifyStatic, {
            root: path.join(process.cwd(), "public"),
            prefix: "/",
            decorateReply: false,
            setHeaders: res => {
                res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
            },
        });
    }
}
