import { Service } from "fastify-decorators";
import { Person, PersonType, Prisma } from "@prisma/client";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { BaseRepository } from "@repositories/BaseRepository";
import { getPaginationMetadata, getPopulateOptions, setPaginationAndPopulation } from "@utils/adapters/prisma";
import { PersonWithRelations } from "@prisma-gen/zod";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";

@Service()
export class PersonRepository extends BaseRepository<"person"> {

    constructor() {
        super("person");
    }

    public async findByIds(personIds: number[], options?: FindOptions, tx?: Prisma.TransactionClient): Promise<Person[]> {
        return this.exec(() =>
            this.getDelegate(tx).findMany({
                where: { id: { in: personIds } },
                include: options?.populate ? getPopulateOptions(options.populate) : undefined,
            })
        );
    }

    public async findByIdAndType(id: number, personType: PersonType, options?: FindOptions, tx?: Prisma.TransactionClient): Promise<Person | null> {
        return this.exec(() =>
            this.getDelegate(tx).findUniqueOrThrow({
                where: { id, personType } as Prisma.PersonWhereUniqueInput,
                include: options?.populate ? getPopulateOptions(options.populate) : undefined,
            })
        );
    }

    public async findByUserIdAndType(userId: number, personType: PersonType, options?: FindOptions, tx?: Prisma.TransactionClient): Promise<Person | null> {
        return this.exec(() =>
            this.getDelegate(tx).findFirstOrThrow({
                where: { userId, personType } as Prisma.PersonWhereInput,
                include: options?.populate ? getPopulateOptions(options.populate) : undefined,
            })
        );
    }

    public async findByEmail(email: string, tx?: Prisma.TransactionClient): Promise<Person> {
        return this.exec(() =>
            this.getDelegate(tx).findFirstOrThrow({
                where: {
                    contact: {
                        OR: [
                            { email: { equals: email, mode: "insensitive" } },
                            { pec: { equals: email, mode: "insensitive" } }
                        ]
                    }
                },
                include: { contact: true }
            })
        );
    }

    public override async paginate(query: Prisma.PersonWhereInput, options: PaginateOptions, tx?: Prisma.TransactionClient, personIds?: number[]): Promise<PaginateDatasourceDTO<Person>> {
        return this.exec(async () => {
            const opts = setPaginationAndPopulation(options);
            if (personIds?.length) {
                opts.include = {
                    ...(opts.include ?? {}),
                    patientPreferredOperators: true,
                    patientTutors: true,
                }
            }

            const docs = await this.getDelegate(tx).findMany({
                where: query,
                ...opts,
            });
            const totalDocs = await this.count(query, tx);
            return {
                docs,
                ...getPaginationMetadata(options, totalDocs),
            } as PaginateDatasourceDTO<Person>;
        });
    }

    public async deleteByIdAndType(id: number, personType: PersonType, tx?: Prisma.TransactionClient): Promise<Person | null> {
        return this.exec(() =>
            this.getDelegate(tx).delete({
                where: { id, personType }
            })
        );
    }

    // private normalizeUserDTO(person: PersonWithRelations, user: UserCreationFromPersonDTO | UserUpdateFromPersonDTO) {
        // const userDTO = {
        //     ...user,
        //     password: user.password,
        //     username: user.username || "",
        //     email: user.email || "",
        // }
        //
        // if (user.password) {
        //     userDTO.password = encryptPasswordSync(user.password);
        // }
        //
        // if (!user.username && person.name && person.surname) {
        //     userDTO.username = usernameFromFullName(person.name, person.surname);
        // } else if (!user.username) {
        //     throw new httpErrors.BadRequest("Nome e cognome devono essere specificati se si crea un account associato.");
        // }
        //
        // if (!user.email && (person.contact?.email || person.contact?.pec)) {
        //     userDTO.email = person.contact.email! || person.contact.pec!;
        // } else if (!user.email && !person.contact?.email && !person.contact?.pec) {
        //     throw new httpErrors.BadRequest("L'indirizzo email o PEC devono essere specificate nel contatto se si crea un account associato.");
        // }
        //
        // if (!user.avatarUrl && person.avatarUrl) {
        //     userDTO.avatarUrl = person.avatarUrl;
        // }
        //
        // return userDTO;
    // }

    async findByTargets(targets: PersonType[], tx?: Prisma.TransactionClient): Promise<PersonWithRelations[]> {
        return this.exec(() =>
            this.getDelegate(tx).findMany({
                where: {
                    personType: { in: targets },
                },
                include: {
                    user: { include: { roles: true } },
                    contact: true,
                }
            }) as Promise<PersonWithRelations[]>
        );
    }

    async findAll(tx?: Prisma.TransactionClient): Promise<PersonWithRelations[]> {
        return this.exec(() =>
            this.getDelegate(tx).findMany({
                include: {
                    user: { include: { roles: true } },
                    contact: true,
                }
            }) as Promise<PersonWithRelations[]>
        );
    }

    async revokeUserCredentialsByIdAndType(id: number, personType: PersonType, tx?: Prisma.TransactionClient): Promise<Person> {
        return this.exec(() =>
            this.getDelegate(tx).update({
                where: { id, personType },
                data: {
                    user: { delete: true }
                },
            })
        );
    }

    async findById(id: number, options?: FindOptions, tx?: Prisma.TransactionClient) {
        return this.exec(() =>
            this.getDelegate(tx).findUniqueOrThrow({
                where: { id },
                include: options?.populate ? getPopulateOptions(options.populate) : undefined,
            })
        )
    }
}