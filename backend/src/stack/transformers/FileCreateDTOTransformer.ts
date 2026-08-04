import { FieldResolvers } from "@DTOs/transfomer/FieldResolvers";
import { FileOptionalDefaults } from "@prisma-gen/zod";
import { TransformerInterface } from "../interfaces/TransformerInterface";
import { FileCreateDTO } from "@DTOs/file/FileCreateDTO";

export type FileCreateResolvers = FieldResolvers & {
    file: (url: string, path: string, fileSize: number) => FileOptionalDefaults
}

export class FileCreateDTOTransformer implements TransformerInterface<FileCreateDTO, FileCreateResolvers> {
    transform(dto: FileCreateDTO): FileCreateResolvers {
        return {
            file: (url: string, path: string, fileSize: number) => ({
                name: dto.file.filename,
                mimeType: dto.file.mimetype,
                size: fileSize,
                path,
                url,
            })
        }
    }
}
