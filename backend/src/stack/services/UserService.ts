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
import { generateRandomString } from "@utils/helpers/crypto";
import { regionForProvince } from "@utils/helpers/italianProvinces";
import { FileService } from "@services/FileService";
import { MailService } from "@mail/MailService";
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
                private readonly mailService: MailService) {}

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
            });

            const rolesDTO = userCreationDTOSplit.roles(user.id) ?? [];
            for (const roleDTO of rolesDTO) {
                await this.roleToUserRepository.save(roleDTO);
            }

            return this.userRepository.findById(user?.id!, { populate: "person person.contact person.addresses" }, prisma);
        }) as Promise<UserWithRelations | null>;
    }

    public async register(dto: UserRegisterDTO): Promise<UserWithRelations | null> {
        const existingUser = await this.userRepository.findOne({ username: dto.username });
        if (existingUser) {
            throw new BadRequest("Attenzione! Username già in uso");
        }

        const existingContact = await this.contactRepository.findOne({ email: dto.email });
        if (existingContact) {
            throw new BadRequest("Attenzione! Email già in uso");
        }

        const transformer = new UserRegistrationDTOTransformer();
        const split = transformer.transform(dto);

        const created = await getPrismaClient().$transaction(async prisma => {
            const savedContact = await this.contactRepository.save(split.contact(), prisma);
            const savedPerson = await this.personRepository.save(split.person(savedContact.id!), prisma);
            const savedUser = await this.userRepository.save({
                ...split.user(savedPerson.id!),
                wsCode: generateRandomString(6),
            }, prisma);

            await this.roleToUserRepository.save({ roleName: RoleName.DANCER, userId: savedUser.id! }, prisma);

            Log.info(`[User Service]: self-registered dancer '${savedUser.username}' (id ${savedUser.id}) — Contact, Person and User created in one transaction, role DANCER assigned (§3.7, AS2)`);

            return this.userRepository.findById(savedUser.id!, {populate: "person person.contact"}, prisma);
        }) as UserWithRelations;

        // Il benvenuto parte **dopo il commit** (`RF-COM-1`): dentro la
        // transazione, un rollback lascerebbe in mano al ballerino la conferma
        // di un account che non esiste — e un'email non si richiama indietro.
        await this.mailService.sendWelcome(dto.email, {
            firstName: dto.firstName,
            username: dto.username,
        });

        return created;
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
