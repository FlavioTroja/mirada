import { Service } from "fastify-decorators";
import { MultipartFile } from "@fastify/multipart";
import httpErrors from "http-errors";
import { randomBytes } from "crypto";
import { uploadFile, UploadFileResponse } from "@utils/adapters/upload";

@Service()
export class ImageService {

    public static readonly IMAGES_PATH = "images";

    public async upload(data: MultipartFile): Promise<UploadFileResponse> {
        const filenameSplit = data.filename.split(".");
        const fileExtension = filenameSplit[filenameSplit.length - 1] || "";
        if (!["png", "jpeg", "jpg", "bmp", "svg"].includes(fileExtension)) {
            throw httpErrors.BadRequest("Il formato del file non è valido");
        }

        return await uploadFile(data, ImageService.IMAGES_PATH, ImageService.IMAGES_PATH, `${randomBytes(20).toString('hex')}.${fileExtension}`);
    }

}