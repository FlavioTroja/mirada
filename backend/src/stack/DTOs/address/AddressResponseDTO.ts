import { z } from "zod";
import { AddressSchema } from "@prisma-gen/zod";

export const AddressResponseSchema = AddressSchema;
export type AddressResponseDTO = z.infer<typeof AddressResponseSchema>;
