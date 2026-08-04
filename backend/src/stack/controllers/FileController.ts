import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, POST } from "fastify-decorators";
import httpErrors from "http-errors";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { FileService } from "@services/FileService";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionScope } from "@enums/PermissionScope";
import { PermissionResource } from "@enums/PermissionResource";

@Controller({
    route: "/files",
    tags: [{ name: "Files", description: "File uploads" }],
})
export class FileController {
    constructor(private readonly fileService: FileService) {}

    @POST("/upload-image", {
        schema: {
            operationId: "uploadImageFile",
            summary: "Upload an image",
            description: "Upload an image and persist a File row. Accepts only image mime types.",
            consumes: ["multipart/form-data"],
            produces: ["application/json"],
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.FILE, PermissionScope.ALL),
        ],
    })
    async uploadImage(req: FastifyRequest, reply: FastifyReply) {
        const data = await req.file({ limits: { fileSize: FileService.MAX_FILE_SIZE } });
        if (!data) {
            throw httpErrors.BadRequest("Nessun file caricato.");
        }
        if (data.file.truncated) {
            throw httpErrors.BadRequest("La dimensione del file è troppo elevata!");
        }
        if (data.file.bytesRead && data.file.bytesRead < 0) {
            throw httpErrors.BadRequest("Non è stato possibile leggere il file caricato.");
        }

        reply.status(200).send(await this.fileService.uploadImage({ file: data }));
    }

    @POST("/upload-pdf", {
        schema: {
            operationId: "uploadPdfFile",
            summary: "Upload a PDF",
            description: "Upload a PDF and persist a File row. Accepts only document mime types.",
            consumes: ["multipart/form-data"],
            produces: ["application/json"],
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.FILE, PermissionScope.ALL),
        ],
    })
    async uploadPdf(req: FastifyRequest, reply: FastifyReply) {
        const data = await req.file({ limits: { fileSize: FileService.MAX_FILE_SIZE } });
        if (!data) {
            throw httpErrors.BadRequest("Nessun file caricato.");
        }
        if (data.file.truncated) {
            throw httpErrors.BadRequest("La dimensione del file è troppo elevata!");
        }
        if (data.file.bytesRead && data.file.bytesRead < 0) {
            throw httpErrors.BadRequest("Non è stato possibile leggere il file caricato.");
        }

        reply.status(200).send(await this.fileService.uploadPdf({ file: data }));
    }
}
