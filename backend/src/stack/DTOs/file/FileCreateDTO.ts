import { z } from "zod";
import { exz } from "@utils/helpers/exz";

export const FileCreateSchema = z.object({
    file: exz.file,
    personId: z.number().optional()
});

export type FileCreateDTO = z.infer<typeof FileCreateSchema>;
