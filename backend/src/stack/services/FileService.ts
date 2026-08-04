import { Service } from "fastify-decorators";
import { FileRepository } from "@repositories/FileRepository";
import { PersonFileRepository } from "@repositories/PersonFileRepository";
import { PdfService } from "@services/PdfService";
import { ImageService } from "@services/ImageService";
import { documentMimeTypes, imageMimeTypes } from "@utils/helpers/exz";
import { UploadFileResponse } from "@utils/adapters/upload";
import { File } from "@prisma/client";
import fs from "node:fs/promises";
import httpErrors from "http-errors";
import { FileCreateDTO } from "@DTOs/file/FileCreateDTO";
import { FileCreateDTOTransformer } from "@transformers//FileCreateDTOTransformer";
import { getPrismaClient } from "@utils/adapters/prisma";
import { Log } from "@utils/adapters/log";

@Service()
export class FileService {

    public static readonly MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

    constructor(
        private readonly fileRepository: FileRepository,
        private readonly personFileRepository: PersonFileRepository,
        private readonly pdfService: PdfService,
        private readonly imageService: ImageService
    ) {}

    public async uploadImage(dto: FileCreateDTO): Promise<File> {
        if (!imageMimeTypes.includes(dto.file.mimetype)) {
            throw httpErrors.BadRequest("Il formato del file non è valido (atteso: immagine).");
        }
        const response = await this.imageService.upload(dto.file);
        return this.persist(dto, response);
    }

    public async uploadPdf(dto: FileCreateDTO): Promise<File> {
        if (!documentMimeTypes.includes(dto.file.mimetype)) {
            throw httpErrors.BadRequest("Il formato del file non è valido (atteso: documento PDF).");
        }
        const response = await this.pdfService.upload(dto.file);
        return this.persist(dto, response);
    }

    public async createFile(dto: FileCreateDTO): Promise<File> {
        if (imageMimeTypes.includes(dto.file.mimetype)) {
            return this.uploadImage(dto);
        }
        return this.uploadPdf(dto);
    }

    private async persist(dto: FileCreateDTO, response: UploadFileResponse): Promise<File> {
        const buffer = await dto.file.toBuffer();
        const fileSize = buffer.length;

        const { file } = new FileCreateDTOTransformer().transform(dto);
        const data = file(response.url, response.filePath, fileSize);

        try {
            if (dto.personId !== undefined) {
                return await getPrismaClient().$transaction(async prisma => {
                    const created = await this.fileRepository.save(data, prisma);
                    await this.personFileRepository.link(dto.personId!, created.id, prisma);
                    return created;
                });
            }
            return await this.fileRepository.save(data);
        } catch (err) {
            fs.unlink(response.filePath).catch(() => {});
            throw err;
        }
    }

    public async deleteFileByPersonIdAndId(personId: number, fileId: number): Promise<void> {
        const file = await this.fileRepository.findByPersonIdAndId(personId, fileId);
        if (!file) {
            throw new httpErrors.NotFound("File non trovato per la persona specificata.");
        }

        // Delete the file from the filesystem
        try {
            await fs.unlink(file.path);
        } catch (err: unknown) {
            throw new httpErrors.InternalServerError(`Errore durante la cancellazione del file: ${err instanceof Error ? err.message : "Errore sconosciuto"}`);
        }

        // Delete the file record from the database
        await this.fileRepository.deleteById(file.id);
    }

    public async deleteFileById(fileId: number): Promise<void> {
        const file = await this.fileRepository.findOne({ id: fileId });
        if (!file) {
            return;
        }

        try {
            await fs.unlink(file.path);
        } catch (err: unknown) {
            Log.warn(`[${FileService.name}][deleteFileById][${fileId}] impossibile rimuovere il file su disco: ${err instanceof Error ? err.message : "errore sconosciuto"}`);
        }

        await this.fileRepository.deleteById(file.id);
    }

}
