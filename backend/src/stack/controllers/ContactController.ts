import { Controller, PATCH } from "fastify-decorators";
import { FastifyReply, FastifyRequest } from "fastify";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionScope } from "@enums/PermissionScope";
import { exz } from "@utils/helpers/exz";
import httpErrors from "http-errors";
import { PermissionResource } from "@enums/PermissionResource";
import { ContactService } from "@services/ContactService";
import { ContactUpdateDTO, ContactUpdateSchema } from "@DTOs/contact/ContactUpdateDTO";

@Controller({
    route: "/contacts",
    tags: [{ name: "Contacts", description: "Endpoints dedicated to contact information" }],
})
export class ContactController {

    constructor (
        private readonly contactService: ContactService,
    ) {}

    @PATCH("/:id", {
        schema: {
            operationId: "updateContact",
            summary: "Update Contact from id",
            params: exz.pathId,
            body: ContactUpdateSchema,
            security: [
                {
                    apiKey: []
                }
            ],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.CONTACT, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: ContactUpdateDTO }>,
        reply: FastifyReply
    ) {
        const contact = await this.contactService.updateById(+req.user.id, +req.params.id, req.body);
        if(!contact) {
            throw new httpErrors.NotFound();
        }
        reply
            .status(200)
            .send(contact);
    }

}