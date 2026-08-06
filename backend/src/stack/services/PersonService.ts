import { Service } from "fastify-decorators";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PersonRepository } from "@repositories/PersonRepository";
import { AddressRepository } from "@repositories/AddressRepository";
import { Person, PersonType, Prisma } from "@prisma/client";
import { createFullTextQuery, createObjectWithoutThrow, FullTextOperator } from "@utils/helpers/query";
import { PersonQueryDTO } from "@DTOs/person/PersonPaginateDTO";
import { PersonUpdateDTO } from "@DTOs/person/PersonUpdateDTO";
import { AddressSubResourceUpdateDTO } from "@DTOs/address/AddressSubResourceUpdateDTO";
import { hasPermissionOrThrow } from "@utils/adapters/permission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionScope } from "@enums/PermissionScope";
import { PermissionResource } from "@enums/PermissionResource";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { getPrismaClient } from "@utils/adapters/prisma";
import { splitLinkableEntities } from "@utils/helpers/mergeEntities";
import { InternalServerError, NotFound } from "http-errors";
import { PersonWithRelations } from "@prisma-gen/zod";
import { regionForProvince } from "@utils/helpers/italianProvinces";

@Service()
export class PersonService {

    constructor(
        private readonly personRepository: PersonRepository,
        private readonly addressRepository: AddressRepository,
    ) {}

    public async findById(id: number, options?: FindOptions): Promise<Person | null> {
        return await this.personRepository.findById(id, options);
    }

    public async paginate(query: PersonQueryDTO, options: PaginateOptions, personIds?: number[]): Promise<PaginateDatasourceDTO<Person> | null> {
        const prismaQuery = this.createQueryFromPayload(query);
        const page = await this.personRepository.paginate(prismaQuery, options, undefined, personIds);
        if (!page) {
            return null;
        }

        return page;
    }

    // TODO: Maybe refactor all person subservices to avoid code repetition? Just an idea, no time to implement
    private createQueryFromPayload(payload: PersonQueryDTO): Prisma.PersonWhereInput {
        const valueQuery: Prisma.PersonWhereInput[] = [
            createObjectWithoutThrow(payload.value, { name: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(
                payload.value,
                { name: { search: createFullTextQuery(FullTextOperator.AND, payload.value, true) } },
            ),
            createObjectWithoutThrow(payload.value, { surname: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(
                payload.value,
                { surname: { search: createFullTextQuery(FullTextOperator.AND, payload.value, true) } },
            ),
            createObjectWithoutThrow(payload.value, { note: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(
                payload.value,
                { note: { search: createFullTextQuery(FullTextOperator.AND, payload.value, true) } },
            ),
            createObjectWithoutThrow(payload.value, { fiscalCode: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(payload.value, { vatNumber: { contains: payload.value, mode: "insensitive" } }),
        ].filter(o => Object.values(o).length > 0);

        const query: Prisma.PersonWhereInput[] = [
            createObjectWithoutThrow(valueQuery.length, { OR: valueQuery }),

            createObjectWithoutThrow(payload.gender?.length, { gender: { in: payload.gender } }),
            createObjectWithoutThrow(payload.personType?.length, { personType: { in: payload.personType } }),
            createObjectWithoutThrow(payload.personType?.includes(PersonType.USER), {
                user: {
                    deletedAt: {
                        equals: null,
                    }
                }
            })
        ].filter(o => Object.values(o).length > 0);

        return {
            AND: query.length > 0 ? query : undefined,
        };
    }

    public async deleteById(id: number): Promise<Person | null> {
        return await this.personRepository.deleteById(id);
    }

    async updateById(principalId: number, personToUpdateId: number, dto: PersonUpdateDTO) {
        const person = await this.personRepository.findById(personToUpdateId, { populate: "user" }) as PersonWithRelations;
        if (!person) {
            return null;
        }

        if (person.user?.id === principalId) {
            await hasPermissionOrThrow(principalId, { action: PermissionAction.UPDATE, entity: PermissionResource.PERSON, scope: PermissionScope.OWN });
        } else {
            await hasPermissionOrThrow(principalId, { action: PermissionAction.UPDATE, entity: PermissionResource.PERSON, scope: PermissionScope.ALL });
        }

        return this.personRepository.update({ id: personToUpdateId }, dto);
    }

    async updatePersonAddresses(principalId: number, personId: number, newAddresses: AddressSubResourceUpdateDTO) {
        const person = await this.personRepository.findById(personId, { populate: "user" }) as PersonWithRelations;
        if (!person) {
            return null;
        }

        if (person.user?.id === principalId) {
            await hasPermissionOrThrow(principalId, { action: PermissionAction.UPDATE, entity: PermissionResource.PERSON, scope: PermissionScope.OWN });
        } else {
            await hasPermissionOrThrow(principalId, { action: PermissionAction.UPDATE, entity: PermissionResource.PERSON, scope: PermissionScope.ALL });
        }

        const existingAddresses = newAddresses.filter(a => a.id !== -1);

        if (existingAddresses.length) {
            const dbAddresses = await this.addressRepository.findMany({
                id: { in: existingAddresses.map(a => a.id!) }
            });

            if (dbAddresses.length !== existingAddresses.length) {
                throw new NotFound("Attenzione! Uno o più indirizzi specificati non esistono");
            }

            const foreignAddress = dbAddresses.find(a => a.personId !== personId);
            if (foreignAddress) {
                throw new InternalServerError("Attenzione! Uno o più indirizzi specificati appartengono ad un'altra persona");
            }
        }

        const { toCreate, toDisconnect, toUpdate } = splitLinkableEntities(newAddresses);

        return getPrismaClient().$transaction(async prisma => {
            // `region` è derivata dalla provincia anche su questa strada (§3.4):
            // la sub-risorsa scrive righe di `Address` come qualunque altro
            // percorso, e una riga che entrasse da qui senza regione sarebbe una
            // riga invisibile al filtro geografico della ricerca pubblica.
            for (const address of toCreate) {
                await this.addressRepository.save(
                    { ...address, id: undefined, personId, region: regionForProvince(address.province) },
                    prisma,
                );
            }

            for (const address of toDisconnect) {
                await this.addressRepository.deleteById(address.id!, prisma);
            }

            for (const address of toUpdate) {
                await this.addressRepository.update(
                    { id: address.id },
                    { ...address, region: regionForProvince(address.province) },
                    undefined,
                    undefined,
                    prisma,
                );
            }

            return this.personRepository.findById(personId, { populate: "addresses" }, prisma);
        });
    }
}