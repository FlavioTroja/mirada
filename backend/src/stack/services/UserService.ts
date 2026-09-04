import { Service } from "fastify-decorators";
import { UserRepository } from "@repositories/UserRepository";
import { Prisma, RoleName, User } from "@prisma/client";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import httpErrors, { BadRequest, InternalServerError, NotFound } from "http-errors";
import { hasPermission, hasPermissionOrThrow } from "@utils/adapters/permission";
import { UserWithRelations } from "@prisma-gen/zod";
import { UserCreateDTO } from "@DTOs/user/UserCreateDTO";
import { getPrismaClient } from "@utils/adapters/prisma";
import { PersonRepository } from "@repositories/PersonRepository";
import { RoleToUserRepository } from "@repositories/RoleToUserRepository";
import { AddressRepository } from "@repositories/AddressRepository";
import { ContactRepository } from "@repositories/ContactRepository";
import { UserCreationDTOTransformer } from "@transformers//UserCreationDTOTransformer";
import { UserRegistrationDTOTransformer } from "@transformers//UserRegistrationDTOTransformer";
import { UserRegisterDTO } from "@DTOs/user/UserRegisterDTO";
import { UserUpdateDTO } from "@DTOs/user/UserUpdateDTO";
import { Log } from "@utils/adapters/log";
import { UserQueryDTO } from "@DTOs/user/UserQueryDTO";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionScope } from "@enums/PermissionScope";
import { RoleToUserUpdateDTO } from "@DTOs/role_to_user/RoleToUserUpdateDTO";
import { splitLinkableEntities } from "@utils/helpers/mergeEntities";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { encryptPasswordSync, generateRandomString } from "@utils/helpers/crypto";
import { regionForProvince } from "@utils/helpers/italianProvinces";
import { FileService } from "@services/FileService";
import { EmailConfirmationService } from "@services/EmailConfirmationService";
import { domainError } from "@utils/helpers/domainError";
import { DomainErrorCode } from "@enums/DomainErrorCode";
import { MultipartFile } from "@fastify/multipart";
import { AuditLog } from "@utils/adapters/decorators/AuditLog";
import { LogOp } from "@utils/adapters/decorators/LogOp";

@Service()
export class UserService {
    constructor(private readonly userRepository: UserRepository,
                private readonly personRepository: PersonRepository,
                private readonly roleToUserRepository: RoleToUserRepository,
                private readonly addressRepository: AddressRepository,
                private readonly contactRepository: ContactRepository,
                private readonly fileService: FileService,
                private readonly emailConfirmationService: EmailConfirmationService) {}

    @AuditLog({ op: LogOp.CREATE, entity: Prisma.ModelName.User })
    public async save(principalId: number, dto: UserCreateDTO) {
        const transformer = new UserCreationDTOTransformer();

        if (dto.roles?.length) {
            await hasPermissionOrThrow(principalId, { action: PermissionAction.CREATE, entity: PermissionResource.ROLE_TO_USER, scope: PermissionScope.ALL})
            if (dto.roles.find(role => role.roleName === "GOD")) {
                await hasPermissionOrThrow(principalId, { action: PermissionAction.CREATE, entity: PermissionResource.ROLE_TO_USER, scope: PermissionScope.GOD})
            }
        }

        if (!dto.person && (!!dto.contact || !!dto.addresses?.length)) {
            throw new BadRequest("Attenzione! Per specificare i contatti di una persona bisogna inserire una persona!");
        }

        const userCreationDTOSplit = transformer.transform(dto);

        return getPrismaClient().$transaction(async prisma => {
            const savedContact = await this.contactRepository.save(userCreationDTOSplit.contact());

            const personDTO = userCreationDTOSplit.person(savedContact.id!);
            const savedPerson = await this.personRepository.save(personDTO);

            const addressesDTO = userCreationDTOSplit.addresses(savedPerson.id) ?? [];
            for (const addressDTO of addressesDTO) {
                // §3.4 — la regione si deriva dalla provincia su ogni strada che
                // scrive un indirizzo, non solo su `POST /addresses/create`.
                await this.addressRepository.save({ ...addressDTO, region: regionForProvince(addressDTO.province) });
            }

            const userDTO = userCreationDTOSplit.user(savedPerson.id!);
            const user = await this.userRepository.save({
                ...userDTO,
                wsCode: generateRandomString(6),
                // **Nasce già confermato**, al contrario di `register`.
                //
                // Questa è la strada amministrativa: un operatore del
                // back-office che iscrive una persona che ha davanti o di cui
                // conosce l'indirizzo. Nessuna email di conferma parte da qui —
                // e quindi lasciare il campo nullo non produrrebbe un account
                // «da verificare», ma un account che **nessuno potrà mai
                // usare**, in attesa di un link che non esisterà mai.
                //
                // La conferma via email ha senso dove serve davvero: sul
                // percorso pubblico d'iscrizione, dove l'indirizzo lo digita
                // uno sconosciuto e nessuno lo ha verificato.
                emailVerifiedAt: new Date(),
            });

            const rolesDTO = userCreationDTOSplit.roles(user.id) ?? [];
            for (const roleDTO of rolesDTO) {
                await this.roleToUserRepository.save(roleDTO);
            }

            return this.userRepository.findById(user?.id!, { populate: "person person.contact person.addresses" }, prisma);
        }) as Promise<UserWithRelations | null>;
    }

    /**
     * Auto-registrazione dal percorso d'iscrizione (`AS2`, §3.7).
     *
     * ── L'account nasce **non confermato** ────────────────────────────────────
     * `emailVerifiedAt` resta nullo e l'accesso è rifiutato finché non arriva il
     * clic sul tasto nell'email. Il posto si prenota dopo: su questa piattaforma
     * il biglietto **è** l'email, e un indirizzo digitato male non è un campo
     * sbagliato ma un QR d'ingresso che non raggiungerà mai nessuno.
     *
     * ── I due rifiuti non sono lo stesso rifiuto ─────────────────────────────
     * Prima erano due `BadRequest` con frasi diverse, e il sito li mostrava
     * identici: un riquadro rosso dentro «Crea un account». Chi aveva già un
     * account leggeva «Email già in uso» e restava fermo lì, perché nulla gli
     * diceva che la cosa da fare era **accedere**. Ora portano un codice stabile
     * e l'interfaccia può proporre l'azione giusta invece del testo dell'errore.
     */
    public async register(
        dto: UserRegisterDTO,
    ): Promise<{ user: UserWithRelations | null; confirmationSent: boolean }> {
        const existingUser = await this.userRepository.findOne({ username: dto.username });
        if (existingUser) {
            Log.warn(`[User Service]: registration refused — username '${dto.username}' is taken`);
            throw domainError(
                DomainErrorCode.USERNAME_TAKEN,
                "Questo nome utente è già occupato. Scegline un altro.",
            );
        }

        const email = dto.email.trim().toLowerCase();

        // ── La rivendicazione — `16-anagrafica-unica.md` §4 ──────────────────
        // Un contatto con questo indirizzo può esistere **senza** un'utenza
        // dietro: è la persona che una scuola ha censito iscrivendola a un
        // corso. Trattarla come «hai già un account» sarebbe due volte
        // sbagliato — la frase è falsa, e manda ad accedere a un account che
        // non esiste, cioè in un vicolo cieco da cui non si esce da soli.
        //
        // ⚠️ `RB33` è rispettata anche qui, per una strada diversa dall'SSO:
        // questo percorso NON valorizza `emailVerifiedAt`, quindi l'utenza
        // nasce incapace di accedere finché non si preme il collegamento nella
        // casella. Chi rivendica deve comunque dimostrare l'indirizzo — solo
        // che qui la prova arriva dopo la creazione invece che prima.
        const rivendicabile = await this.personRepository.findClaimableByEmail(email);

        if (!rivendicabile) {
            const existingContact = await this.contactRepository.findOne({ email });
            if (existingContact) {
                Log.warn(`[User Service]: registration refused — '${email}' already belongs to an account`);
                throw domainError(
                    DomainErrorCode.EMAIL_ALREADY_REGISTERED,
                    "Questo indirizzo ha già un account su Mirada. Accedi per iscriverti all'evento.",
                );
            }
        }

        const transformer = new UserRegistrationDTOTransformer();
        const split = transformer.transform(dto);

        const created = await getPrismaClient().$transaction(async prisma => {
            let personId: number;
            if (rivendicabile) {
                // Si aggancia, non si riscrive (`RB32`): i propri dati li
                // corregge la persona dall'area personale, non questo percorso.
                Log.info(
                    `[User Service]: '${email}' claims the existing anagraphic (person id ${rivendicabile.id}) `
                    + "created without an account — attaching instead of creating a new one",
                );
                personId = rivendicabile.id;
            } else {
                const savedContact = await this.contactRepository.save(split.contact(), prisma);
                const savedPerson = await this.personRepository.save(split.person(savedContact.id!), prisma);
                personId = savedPerson.id!;
            }

            const savedUser = await this.userRepository.save({
                ...split.user(personId),
                wsCode: generateRandomString(6),
            }, prisma);

            await this.roleToUserRepository.save({ roleName: RoleName.DANCER, userId: savedUser.id! }, prisma);

            Log.info(
                `[User Service]: self-registered dancer '${savedUser.username}' (id ${savedUser.id}) — `
                + (rivendicabile
                    ? `User created on the CLAIMED anagraphic (person id ${rivendicabile.id})`
                    : "Contact, Person and User created in one transaction")
                + ", role DANCER assigned (§3.7, AS2)",
            );

            return this.userRepository.findById(savedUser.id!, {populate: "person person.contact"}, prisma);
        }) as UserWithRelations;

        // L'email parte **dopo il commit** (`RF-COM-1`): dentro la transazione,
        // un rollback lascerebbe in mano al ballerino il link di conferma di un
        // account che non esiste — e un'email non si richiama indietro.
        //
        // Parte la **conferma**, non il benvenuto: il benvenuto è spostato a
        // dopo il clic, perché prima di allora l'account non serve a nulla e due
        // email nello stesso minuto si annullano a vicenda nella casella.
        const confirmationSent = await this.emailConfirmationService.sendConfirmation(
            created,
            email,
            dto.firstName,
            { eventSlug: dto.eventSlug ?? null },
        );

        // L'esito risale al chiamante invece di essere ingoiato: «controlla la
        // posta» va detto solo quando l'email è partita davvero. Non si lancia —
        // l'account è creato e un errore HTTP lo renderebbe irraggiungibile
        // anche al rinvio.
        return { user: created, confirmationSent };
    }

    public async findByIdWithPermission(principalId: number, wantedUserId: number, options?: FindOptions): Promise<User | null> {

        if (principalId !== wantedUserId) {
            await hasPermissionOrThrow(principalId, { action: PermissionAction.READ, entity: PermissionResource.USER, scope: PermissionScope.OTHERS});
        }
        const wantedUser = await this.userRepository.findById(wantedUserId, { ...options, populate: options?.populate ? options.populate + " roles" : "roles" });

        if ((wantedUser as UserWithRelations).roles.find(r => r.roleName === "GOD")) {
            await hasPermissionOrThrow(principalId, { action: PermissionAction.READ, entity: PermissionResource.USER, scope: PermissionScope.GOD});
        }

        return wantedUser;
    }

    public async findById( wantedUserId: number, options?: FindOptions): Promise<User | null> {
        return await this.userRepository.findById(wantedUserId, options);
    }

    public async findOne(query: Prisma.UserWhereInput, options?: FindOptions): Promise<User | null> {
        return await this.userRepository.findOne(query, options);
    }

    /**
     * Riservato al login (`AuthService`): è l'unico percorso che legge l'hash
     * della password, omesso dal client Prisma su tutti gli altri (§3.1).
     */
    /**
     * **L'utenza che nasce dal fornitore di identità**, al primo accesso di chi
     * su mirada non c'era ancora.
     *
     * Non passa da `save` né da `register`, e per motivi diversi. `save` è la
     * strada amministrativa e pretende un `principalId` con i permessi: qui non
     * c'è nessun amministratore, c'è una persona che si sta iscrivendo da sola.
     * `register` è la strada del ballerino e crea una password, manda l'email di
     * conferma e attende un clic: tutte cose che qui sarebbero di troppo, perché
     * l'indirizzo l'ha già dimostrato Authentik.
     *
     * ── La password che nessuno conosce ─────────────────────────────────────
     * `User.password` non è nullable, e renderlo tale vorrebbe dire che ogni
     * percorso che confronta una password debba ricordarsi del caso «assente».
     * Si scrive invece l'impronta di una stringa casuale che **non esiste
     * altrove**: la colonna resta onesta, e l'accesso con password per questa
     * utenza semplicemente non può riuscire. Chi vorrà usarlo passerà dal
     * recupero password, che è il posto giusto per assegnarsene una.
     */
    public async createFromSso(params: {
        sub: string;
        email: string;
        name?: string | null;
    }): Promise<UserWithRelations> {
        const email = params.email.trim().toLowerCase();
        const [nome, ...resto] = (params.name ?? "").trim().split(/\s+/).filter(Boolean);
        const cognome = resto.join(" ");

        // Lo username deriva dall'indirizzo, che è univoco. Se è occupato — due
        // persone con `mario@` su domini diversi — si accoda un progressivo
        // invece di fallire: il nome utente è un'etichetta, non un'identità, e
        // quella vera è il `sub`.
        const base = (email.split("@")[0] || "utente").replace(/[^a-z0-9._-]/gi, "").toLowerCase() || "utente";
        let username = base;
        for (let i = 2; await this.userRepository.findOne({ username }); i++) {
            username = `${base}${i}`;
        }

        Log.info(`[User Service]: creating account from SSO identity for '${email}' as '${username}'`);

        const created = await getPrismaClient().$transaction(async prisma => {
            // ── La rivendicazione — `16-anagrafica-unica.md` §4 ──────────────
            // Questa persona può essere già CENSITA senza avere un'utenza: una
            // scuola l'ha iscritta a un corso digitandone l'indirizzo, e da
            // allora esiste una `Person` con quel `Contact`. `Contact.email` è
            // unico su tutta la piattaforma, quindi creare qui un contatto
            // nuovo violerebbe il vincolo — e lo violerebbe sul percorso di
            // REGISTRAZIONE, cioè la prima cosa che una persona fa.
            //
            // ⚠️ Si aggancia, **non si riscrive** (`RB32`). Il nome che arriva
            // dal fornitore d'identità non è più autorevole di quello che
            // qualcuno ha già scritto: sono entrambi ipotesi, e la persona
            // corregge il proprio dall'area personale. Sovrascrivere qui
            // significherebbe che l'ultimo arrivato ha sempre ragione.
            const rivendicabile = await this.personRepository.findClaimableByEmail(email, prisma);

            let personId: number;
            if (rivendicabile) {
                Log.info(
                    `[User Service]: '${email}' claims the existing anagraphic (person id ${rivendicabile.id}) `
                    + "created without an account — attaching instead of creating a new one",
                );
                personId = rivendicabile.id;
            } else {
                const contact = await this.contactRepository.save({ email }, prisma);
                const person = await this.personRepository.save(
                    {
                        name: nome || email.split("@")[0] || "Organizzatore",
                        surname: cognome || "",
                        personType: "USER",
                        contact: { connect: { id: contact.id } },
                    } as never,
                    prisma,
                );
                personId = person.id;
            }

            return this.userRepository.save(
                {
                    username,
                    password: encryptPasswordSync(generateRandomString(32)),
                    wsCode: generateRandomString(6),
                    authentikSub: params.sub,
                    // L'indirizzo l'ha già dimostrato il fornitore di identità:
                    // chiedere in più il clic su un'email di conferma sarebbe
                    // pretendere due volte la stessa prova.
                    emailVerifiedAt: new Date(),
                    person: { connect: { id: personId } },
                } as never,
                prisma,
            );
        });

        Log.info(`[User Service]: account created from SSO identity '${username}' (id ${created.id})`);

        return (await this.userRepository.findOneForAuthentication(
            { id: created.id },
            { populate: "roles" },
        )) as unknown as UserWithRelations;
    }

    public async findOneForAuthentication(query: Prisma.UserWhereInput, options?: FindOptions) {
        return await this.userRepository.findOneForAuthentication(query, options);
    }

    public async paginate(principalId: number, query: UserQueryDTO, options: PaginateOptions): Promise<PaginateDatasourceDTO<User> | null> {

        const excludeGod = !await hasPermission(principalId, { action: PermissionAction.READ, entity: PermissionResource.USER, scope: PermissionScope.GOD});

        const prismaQuery = this.createQueryFromPayload(query, excludeGod);

        return await this.userRepository.paginateNotDeleted(prismaQuery, options);
    }

    public async paginateTrashCan(principalId: number, query: UserQueryDTO, options: PaginateOptions): Promise<PaginateDatasourceDTO<User> | null> {

        const excludeGod = !await hasPermission(principalId, { action: PermissionAction.READ, entity: PermissionResource.USER, scope: PermissionScope.GOD});

        const prismaQuery = this.createQueryFromPayload(query, excludeGod);

        return await this.userRepository.paginate(prismaQuery, options);
    }

    @AuditLog({ op: LogOp.UPDATE, entity: Prisma.ModelName.User, entityIdFrom: ctx => ctx.functionParams[1] as number })
    public async updateById(principalId: number, userToUpdateId: number, dto: UserUpdateDTO): Promise<User | null> {

        // const userToUpdate = await this.userRepository.findById(userToUpdateId, { populate: "roles.role" }) as UserWithRelations;

        if (principalId === userToUpdateId) {
            await hasPermissionOrThrow(principalId, { action: PermissionAction.UPDATE, entity: PermissionResource.USER, scope: PermissionScope.OWN})
        }
        // TODO pass them into RoleToUser service
        // if (dto.roles?.length) {
        //     await hasPermissionOrThrow(principalId, { action: PermissionAction.UPDATE, entity: PermissionResource.ROLE_TO_USER, scope: PermissionScope.ALL})
        // }
        // if (dto.roles?.find(r => r.roleName === "GOD") || userToUpdate.roles?.find(r => r.roleName === "GOD")) {
        //     await hasPermissionOrThrow(principalId, { action: PermissionAction.UPDATE, entity: PermissionResource.ROLE_TO_USER, scope: PermissionScope.GOD})
        // }

        return await this.userRepository.update({ id: userToUpdateId }, dto);
    }

    @AuditLog({ op: LogOp.DELETE, entity: Prisma.ModelName.User, entityIdFrom: ctx => ctx.functionParams[1] as number })
    public async safeDeleteById(principalId: number, targetUserId: number): Promise<User | null> {

        if (principalId === targetUserId) {
            throw new httpErrors.BadRequest("Attenzione! Non è possibile autoeliminarsi, non ti arrendere!")
        }

        const userToDelete = await this.userRepository.findById(targetUserId, { populate: "roles.role" }) as UserWithRelations;

        if (userToDelete.roles.find(r => r.roleName === RoleName.GOD)) {
            await hasPermissionOrThrow(principalId, { action: PermissionAction.DELETE, entity: PermissionResource.USER, scope: PermissionScope.GOD });
        }

        return await this.userRepository.safeDeleteById(targetUserId);
    }

    public async deleteById(id: number): Promise<User | null> {
        return await this.userRepository.deleteById(id);
    }

    public async changeUserPassword(principalId: number, userId: number, newPassword: string): Promise<User | null> {
        const user = await this.findByIdWithPermission(principalId, userId);

        if (!user) {
            return null;
        }

        if (!newPassword) {
            throw new httpErrors.BadRequest("La password non può essere vuota");
        }

        return await this.userRepository.updatePasswordById(userId, newPassword);
    }

    async updateUserRoles(principalId: number, userId: number, newRoles: RoleToUserUpdateDTO) {
        if (userId === principalId) {
            await hasPermissionOrThrow(principalId, { action: PermissionAction.UPDATE, entity: PermissionResource.PERSON, scope: PermissionScope.OWN });
        } else {
            await hasPermissionOrThrow(principalId, { action: PermissionAction.UPDATE, entity: PermissionResource.PERSON, scope: PermissionScope.ALL });
        }

        if (newRoles.find(r => r.roleName === RoleName.GOD)) {
            await hasPermissionOrThrow(principalId, { action: PermissionAction.CREATE, entity: PermissionResource.ROLE_TO_USER, scope: PermissionScope.GOD})
        }

        const existingRoles = newRoles.filter(r => r.id !== -1);

        if (existingRoles.length) {
            const dbRoles = await this.roleToUserRepository.findMany({
                id: { in: existingRoles.map(r => r.id) }
            });

            if (dbRoles.length !== existingRoles.length) {
                throw new NotFound("Attenzione! Uno o più ruoli specificati non esistono");
            }

            const foreignRole = dbRoles.find(r => r.userId !== userId);
            if (foreignRole) {
                throw new InternalServerError("Attenzione! Uno o più ruoli specificati appartengono ad un altro utente");
            }
        }

        const { toCreate, toDisconnect, toUpdate } = splitLinkableEntities(newRoles);

        return getPrismaClient().$transaction(async prisma => {
            for (const role of toCreate) {
                await this.roleToUserRepository.save({ roleName: role.roleName, userId }, prisma);
            }

            for (const role of toDisconnect) {
                await this.roleToUserRepository.deleteById(role.id!, prisma);
            }

            for (const role of toUpdate) {
                await this.roleToUserRepository.update({ id: role.id },  role, undefined, undefined, prisma);
            }

            return this.userRepository.findById(userId, { populate: "roles" }, prisma);
        });
    }

    @AuditLog({ op: LogOp.UPDATE, entity: Prisma.ModelName.User, entityIdFrom: ctx => ctx.functionParams[1] as number })
    public async updateUserLogo(principalId: number, userId: number, file: MultipartFile): Promise<User | null> {

        if (principalId === userId) {
            await hasPermissionOrThrow(principalId, { action: PermissionAction.UPDATE, entity: PermissionResource.USER, scope: PermissionScope.OWN });
        }

        const user = await this.userRepository.findById(userId);
        if (!user) {
            return null;
        }

        Log.info(`[${UserService.name}][updateUserLogo][${userId}] caricamento nuovo logo`);
        const newLogo = await this.fileService.uploadImage({ file });

        try {
            const updated = await this.userRepository.update({ id: userId }, { logoFileId: newLogo.id });

            if (user.logoFileId) {
                Log.info(`[${UserService.name}][updateUserLogo][${userId}] rimozione logo precedente (fileId=${user.logoFileId})`);
                await this.fileService.deleteFileById(user.logoFileId);
            }

            Log.info(`[${UserService.name}][updateUserLogo][${userId}] logo aggiornato (fileId=${newLogo.id})`);
            return updated;
        } catch (err) {
            // rollback: il file è stato creato ma l'aggiornamento utente è fallito
            await this.fileService.deleteFileById(newLogo.id).catch(() => {});
            throw err;
        }
    }

    public async findAllByRoles(roles: RoleName[]): Promise<User[]> {
        return await this.userRepository.findMany({
            roles: {
                some: {
                    roleName: { in: roles }
                }
            }
        });
    }

    private createQueryFromPayload(payload: UserQueryDTO, excludeGod: boolean): Prisma.UserWhereInput {
        const valueQuery: Prisma.UserWhereInput[] = [
            createObjectWithoutThrow(payload.value, { username: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(payload.value, { person: { contact: { email: { contains: payload.value, mode: "insensitive" } } } }),
        ].filter(o => Object.values(o).length > 0);

        const rolesQuery: Prisma.UserWhereInput[] = [
            createObjectWithoutThrow(!!payload.roles?.length, { roles: { some: { roleName: { in: payload.roles } } } }),
        ]

        const queryGOD: Prisma.UserWhereInput[] = [
            createObjectWithoutThrow(excludeGod, { roles: { every: { roleName: { notIn: [ RoleName.GOD ] } } } }),
        ];


        const query: Prisma.UserWhereInput[] = [
            createObjectWithoutThrow(queryGOD.length, { OR: queryGOD }),
            createObjectWithoutThrow(valueQuery.length, { OR: valueQuery }),
            createObjectWithoutThrow(rolesQuery.length, { OR: rolesQuery }),
        ].filter(o => Object.values(o).length > 0);

        return {
            AND: query.length > 0 ? query : undefined,
        };
    };
}
