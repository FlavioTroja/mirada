import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import { z } from "zod";
import { FastifyReply, FastifyRequest } from "fastify";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionScope } from "@enums/PermissionScope";
import { PersonService } from "@services/PersonService";
import { exz, FindOptions } from "@utils/helpers/exz";
import httpErrors from "http-errors";
import { FileService } from "@services/FileService";
import { HasRole } from "@middleware/HasRole";
import { RoleName } from "@prisma/client";
import { PermissionResource } from "@enums/PermissionResource";
import { PersonPaginateDTO, PersonPaginateDTOSchema } from "@DTOs/person/PersonPaginateDTO";
import { PersonUpdateDTO, PersonUpdateSchema } from "@DTOs/person/PersonUpdateDTO";
import { AddressSubResourceUpdateDTO, AddressSubResourceUpdateSchema } from "@DTOs/address/AddressSubResourceUpdateDTO";

@Controller({
    route: "/people",
    tags: [{ name: "People", description: "Endpoints dedicated to person information of people"}],
})
export class PersonController {

    constructor (
        private readonly personService: PersonService,
        private readonly fileService: FileService,
    ) {}

    @POST("/paginate", {
        schema: {
            operationId: "paginate-persons",
            summary: "Lets you retrieve people, with pagination",
            description: "Use the pagination info to limit the fetched rows and scroll pages. Using 'populate' will let you include related tables using the column name of the current entity, you can also include nested relations using dot notation." +
                " E.G. : table A with relation to table B through field 'rel'. Table B is related to table C via 'foo'. You can include entity C record from entity A using populate: 'rel.foo'.",
            body: PersonPaginateDTOSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.EVERYTHING, PermissionResource.PERSON, PermissionScope.EVERYTHING)
        ]
    })
    async paginate(req: FastifyRequest<{ Body: PersonPaginateDTO }>, reply: FastifyReply) {
        const { query, options } = req.body as PersonPaginateDTO;
        const personIds: number[] = [];

        // if (isTutor(req.user) && req.user.person) {
        //     const patients = await this.tutorService.getPatientsByTutorId(req.user.person.id);
        //     personIds.push(...(req.user.person?.id ? [ req.user.person.id ] : []), ...(patients?.map(p => p.patientId) ?? []));
        // }

        reply.status(200).send(await this.personService.paginate(query, options, personIds));
    }

    @GET("/:id", {
        schema: {
            operationId: "get-person",
            summary: "Lets you retrieve an existing person by its ID",
            description: "Retrieve single person, given its ID",
            params: z.object({ id: z.string().describe("ID of the person to look for")}),
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.PERSON, PermissionScope.SINGLE)
        ]
    })
    async getById(req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>, reply: FastifyReply) {
        const person = await this.personService.findById(+req.params.id, req.query);
        if (!person) {
            return reply.status(404).send({ message: "Persona non trovata" });
        }
        // if (isTutor(req.user)) {
        //     if (!req.user.person) {
        //         return reply.status(500).send({ message: "Il tutor chiamante non ha una persona associata" });
        //     }
        //     if (person.personType === PersonType.TUTOR && person.id === req.user.person.id) {
        //         // Tutor can see themselves
        //         return reply.status(200).send(person);
        //     }
        //     if (person.personType !== PersonType.PATIENT) {
        //         return reply.status(403).send({ message: "Un tutor può accedere solo ai dati della propria persona e dei propri utenti" });
        //     }
        //
        //     const tutoredPatients = await this.tutorService.getPatientsByTutorId(req.user.person.id);
        //     if (!tutoredPatients?.find(p => p.patientId === person?.id)) {
        //         return reply.status(403).send({ message: "Puoi visualizzare solo gli utenti di cui sei tutor" });
        //     }
        // }

        reply.status(200).send(person);
    }

    @DELETE("/:id", {
        schema: {
            operationId: "delete-person",
            summary: "Lets you delete an existing person by its ID",
            description: "DANGER ZONE: this is one of that operations where you can't come back! If you delete a person, it's gone, forever, for everybody. Watch your steps.",
            params: z.object({ id: z.string().describe("ID of the person to delete")}),
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasRole(RoleName.DANCER),
            HasPermission(PermissionAction.DELETE, PermissionResource.PERSON, PermissionScope.SINGLE)
        ]
    })
    async deleteById(req: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
        reply.status(200).send(await this.personService.deleteById(+req.params.id));
    }

    @POST("/:id/files", {
        schema: {
            operationId: "upload-person-file",
            summary: "Lets you upload a file and link it to a person",
            description: "Upload a file and link it to a person, given its ID.",
            params: z.object({ id: z.string().describe("ID of the person to add the file to") }),
            consumes: ["multipart/form-data"],
            produces: ["application/json"],
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasRole(RoleName.DANCER),
            HasPermission(PermissionAction.CREATE, PermissionResource.FILE, PermissionScope.SINGLE),
            HasPermission(PermissionAction.UPDATE, PermissionResource.PERSON, PermissionScope.SINGLE),
        ]
    })
    async uploadFile(req: FastifyRequest<{ Params: { id: string, availabilityId: string } }>, reply: FastifyReply) {
        const data = await req.file({ limits: { fileSize: FileService.MAX_FILE_SIZE } });
        if (!data) {
            throw httpErrors.BadRequest("Nessun file caricato.");
        }
        if (data.file.truncated) {
            throw httpErrors.BadRequest("La dimensione del file è troppo elevata!");
        }
        if (data.file.bytesRead && data?.file.bytesRead < 0) {
            throw httpErrors.BadRequest("Non è stato possibile leggere il file caricato.");
        }

        reply.status(200).send(await this.fileService.createFile({
            file: data,
            personId: +req.params.id
        }));
    }

    @DELETE("/:id/files/:fileId", {
        schema: {
            operationId: "delete-person-file",
            summary: "Lets you delete a file linked to a person",
            description: "Delete a file linked to a person, given its ID.",
            params: z.object({
                id: z.string().describe("ID of the person to delete the file from"),
                fileId: z.string().describe("ID of the file to delete")
            }),
            response: {
                204: z.null().describe("File deleted correctly"),
            },
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasRole(RoleName.DANCER),
            HasPermission(PermissionAction.DELETE, PermissionResource.FILE, PermissionScope.SINGLE),
            HasPermission(PermissionAction.UPDATE, PermissionResource.PERSON, PermissionScope.SINGLE),
        ]
    })
    async deleteFile(req: FastifyRequest<{ Params: { id: string, fileId: string } }>, reply: FastifyReply) {
        await this.fileService.deleteFileByPersonIdAndId(+req.params.id, +req.params.fileId)
        reply.status(204).send();
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updatePerson",
            summary: "Update Person from id",
            params: exz.pathId,
            body: PersonUpdateSchema,
            security: [
                {
                    apiKey: []
                }
            ],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.PERSON, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: PersonUpdateDTO }>,
        reply: FastifyReply
    ) {
        const person = await this.personService.updateById(+req.user.id, +req.params.id, req.body);
        if(!person) {
            throw new httpErrors.NotFound();
        }
        reply
            .status(200)
            .send(person);
    }

    @PATCH("/:id/addresses", {
        schema: {
            operationId: "updatePersonAddresses",
            summary: "Update current Person's addresses",
            params: exz.pathId,
            body: AddressSubResourceUpdateSchema,
            security: [
                {
                    apiKey: []
                }
            ],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.ADDRESS, PermissionScope.SINGLE),
        ],
    })
    async updatePersonAddresses(
        req: FastifyRequest<{ Params: { id: string }, Body: AddressSubResourceUpdateDTO }>,
        reply: FastifyReply
    ) {
        const person = await this.personService.updatePersonAddresses(+req.user.id, +req.params.id, req.body);

        if (!person) {
            throw new httpErrors.NotFound();
        }

        reply.status(200).send(person);
    }

}