import { MultipartFile } from "@fastify/multipart";
import httpErrors from "http-errors";
import fs from "node:fs/promises";

export type UploadFileResponse = {
    url: string;
    filePath: string;
}

/**
 * Uploads a file to the specified path with the given filename.
 *
 * @param {MultipartFile} data - The file to upload.
 * @param {string} urlPath - The URL path where the file will be accessible.
 * @param {string} filePath - The local path where the file will be saved.
 * @param {string} filename - The name of the file to be saved.
 * @param {number | string} [mode] - Optional file mode for permissions.
 * @returns {Promise<UploadFileResponse>} - A promise that resolves to an object containing the file URL and file path.
 */
export async function uploadFile(data: MultipartFile, urlPath: string, filePath: string, filename: string, mode?: number | string): Promise<UploadFileResponse> {
    const buffer = await data.toBuffer();

    try {
        // La cartella va creata: `writeFile` non la crea, e su una macchina pulita
        // `public/images/` e `public/pdf/` non esistono — il primo caricamento
        // falliva con un 500 opaco (`ENOENT: open 'public/images/…'`). Difetto di
        // fondazione del template, da correggere anche a monte.
        await fs.mkdir(`public/${filePath}`, { recursive: true });

        await fs.writeFile(`public/${filePath}/${filename}`, buffer, {
            mode: mode ?? 0o644, // Set file permissions by default to read/write for owner, and read for group and others
        });
    } catch (err: unknown) {
        throw new httpErrors.InternalServerError(`Errore durante il salvataggio del file: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {
        url: `${process.env.DOMAIN_URL}/${urlPath}/${filename}`,
        filePath: `public/${filePath}/${filename}`
    };
}