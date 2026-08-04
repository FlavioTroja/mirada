import { z } from "zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const AddressQuerySchema = z.object({
    value: z.string().optional(),
    city: z.string().optional(),
    province: z.string().optional(),
    country: z.string().optional(),
    personId: z.number().int().optional(),
});
export type AddressQueryDTO = z.infer<typeof AddressQuerySchema>;

export const AddressPaginateBodyInputSchema = paginateSchema(AddressQuerySchema);
export type AddressPaginateDTO = z.infer<typeof AddressPaginateBodyInputSchema>;
