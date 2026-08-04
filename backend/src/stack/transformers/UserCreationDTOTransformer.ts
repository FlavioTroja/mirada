import { TransformerInterface } from "../interfaces/TransformerInterface";
import { UserCreateDTO } from "@DTOs/user/UserCreateDTO";
import {
    AddressOptionalDefaults,
    ContactOptionalDefaults,
    PersonOptionalDefaults,
    RoleToUserOptionalDefaults,
    UserOptionalDefaults, UserOptionalDefaultsSchema
} from "@prisma-gen/zod";
import { FieldResolvers } from "@DTOs/transfomer/FieldResolvers";
import { encryptPasswordSync } from "@utils/helpers/crypto";

export type UserCreateResolvers = FieldResolvers & {
    user: (personId: number) => UserOptionalDefaults,
    roles: (userId: number) => RoleToUserOptionalDefaults[],
    person: (contactId: number) => PersonOptionalDefaults,
    contact: () => ContactOptionalDefaults,
    addresses: (personId: number) => AddressOptionalDefaults[] | undefined
}

export class UserCreationDTOTransformer implements TransformerInterface<UserCreateDTO, UserCreateResolvers> {
    transform(dto: UserCreateDTO): UserCreateResolvers {
        return {
            user: (personId: number) => UserOptionalDefaultsSchema.parse({
                ...dto,
                personId,
                password: encryptPasswordSync(dto.password)
            }),
            roles: (userId: number)=> dto.roles?.map(r => ({ ...r, userId })) ?? [],
            person: (contactId: number) => ({
                ...dto.person,
                contactId,
            }),
            contact: () => dto.contact,
            addresses: (personId) => dto.addresses?.map((a) => ({ ...a, personId })),
        }
    }
}