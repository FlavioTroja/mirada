import { Service } from "fastify-decorators";
import { MultipartFile } from "@fastify/multipart";
import httpErrors from "http-errors";
import { generateRandomString } from "@utils/helpers/crypto";
import { uploadFile, UploadFileResponse } from "@utils/adapters/upload";
import { documentMimeTypes } from "@utils/helpers/exz";

@Service()
export class PdfService {

    public static readonly PDF_PATH = "pdf";
    public static readonly DOCUMENTS_PATH = "documents";

    constructor() {}

    public async upload(data: MultipartFile): Promise<UploadFileResponse> {
        const filenameSplit = data.filename.split(".");
        const fileExtension = filenameSplit[filenameSplit.length - 1] || "";
        if (!documentMimeTypes.includes(data.mimetype)) {
            throw httpErrors.BadRequest("Il formato del file non è valido");
        }

        return await uploadFile(data, PdfService.DOCUMENTS_PATH, PdfService.PDF_PATH, `${filenameSplit[0]}-${generateRandomString(8)}.${fileExtension}`);
    }

}