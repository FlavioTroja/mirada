import { z } from "zod";
import { Gender, PersonType } from "@prisma/client";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const PersonQuerySchema = z.object({
    value: z.string().optional(), //name surname fiscalCode vatNumber note
    gender: z.enum(Gender).array().optional(),
    personType: z.enum(PersonType).array().optional(),
});
export type PersonQueryDTO = z.infer<typeof PersonQuerySchema>;

export const PersonPaginateDTOSchema = paginateSchema(PersonQuerySchema);
export type PersonPaginateDTO = z.infer<typeof PersonPaginateDTOSchema>;