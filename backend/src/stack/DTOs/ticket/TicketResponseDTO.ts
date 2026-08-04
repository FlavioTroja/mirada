import { z } from "zod";
import { TicketSchema } from "@prisma-gen/zod";

export const TicketResponseSchema = TicketSchema;
export type TicketResponseDTO = z.infer<typeof TicketResponseSchema>;

/** `GET /tickets/:id/pdf` → `{ fileUrl }` (§3.7). */
export const TicketPdfResponseSchema = z.object({
    fileUrl: z.string(),
    fileId: z.number().int(),
    /**
     * `RF-TCK-11` — dichiarato nella risposta, non solo nel PDF: è una
     * **conferma d'ordine con QR di accesso, mai un titolo fiscale**.
     */
    documentKind: z.literal("ORDER_CONFIRMATION"),
    fiscalDocument: z.literal(false),
});
export type TicketPdfResponseDTO = z.infer<typeof TicketPdfResponseSchema>;
