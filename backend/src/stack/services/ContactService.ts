import { Service } from "fastify-decorators";
import { hasPermissionOrThrow } from "@utils/adapters/permission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionScope } from "@enums/PermissionScope";
import { PermissionResource } from "@enums/PermissionResource";
import { ContactWithRelations } from "@prisma-gen/zod";
import { ContactRepository } from "@repositories/ContactRepository";
import { ContactUpdateDTO } from "@DTOs/contact/ContactUpdateDTO";

@Service()
export class ContactService {

    constructor(
        private readonly contactRepository: ContactRepository,
    ) {}

    async updateById(principalId: number, contactToUpdateId: number, dto: ContactUpdateDTO) {
        const contact = await this.contactRepository.findById(contactToUpdateId, { populate: "person person.user" }) as ContactWithRelations;
        if (!contact) {
            return null;
        }

        if (contact.person?.user?.id === principalId) {
            await hasPermissionOrThrow(principalId, { action: PermissionAction.UPDATE, entity: PermissionResource.CONTACT, scope: PermissionScope.OWN });
        } else {
            await hasPermissionOrThrow(principalId, { action: PermissionAction.UPDATE, entity: PermissionResource.CONTACT, scope: PermissionScope.ALL });
        }

        return this.contactRepository.update({ id: contactToUpdateId }, dto);
    }

}