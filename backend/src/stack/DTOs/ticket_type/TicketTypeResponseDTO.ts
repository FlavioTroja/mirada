import { z } from "zod";
import { TicketTypeSchema } from "@prisma-gen/zod";

export const TicketTypeResponseSchema = TicketTypeSchema;
export type TicketTypeResponseDTO = z.infer<typeof TicketTypeResponseSchema>;
