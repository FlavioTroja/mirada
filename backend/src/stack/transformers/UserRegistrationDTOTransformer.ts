import { TransformerInterface } from "../interfaces/TransformerInterface";
import { UserRegisterDTO } from "@DTOs/user/UserRegisterDTO";
import {
    ContactOptionalDefaults,
    PersonOptionalDefaults,
    UserOptionalDefaults,
    UserOptionalDefaultsSchema,
} from "@prisma-gen/zod";
import { FieldResolvers } from "@DTOs/transfomer/FieldResolvers";
import { encryptPasswordSync } from "@utils/helpers/crypto";
import { PersonType } from "@prisma/client";

export type UserRegistrationResolvers = FieldResolvers & {
    contact: () => ContactOptionalDefaults,
    person: (contactId: number) => PersonOptionalDefaults,
    user: (personId: number) => UserOptionalDefaults,
}

export class UserRegistrationDTOTransformer implements TransformerInterface<UserRegisterDTO, UserRegistrationResolvers> {
    transform(dto: UserRegisterDTO): UserRegistrationResolvers {
        return {
            contact: () => ({
                email: dto.email,
                phoneNumber: dto.phoneNumber ?? null,
                telephone: dto.telephone ?? null,
                pec: dto.pec ?? null,
            }),
            person: (contactId: number) => ({
                name: dto.firstName,
                surname: dto.lastName,
                fiscalCode: dto.fiscalCode ?? null,
                vatNumber: dto.vatNumber ?? null,
                gender: dto.gender ?? null,
                birthDate: dto.birthDate ?? null,
                bornIn: dto.bornIn ?? null,
                livesIn: dto.livesIn ?? null,
                personType: PersonType.USER,
                contactId,
            }),
            user: (personId: number) => UserOptionalDefaultsSchema.parse({
                username: dto.username,
                password: encryptPasswordSync(dto.password),
                avatarUrl: dto.avatarUrl ?? null,
                note: dto.note ?? null,
                personId,
            }),
        }
    }
}
