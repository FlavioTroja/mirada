import { z } from "zod";
import { CapacityQuotaPartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * Solo scalari della propria riga — regola 11 di `controllers.md`.
 *
 * Fuori: `consumed` (calcolato dal server), `eventId`, `scope` e `scopeId`
 * (l'identità della quota: cambiarla non è una modifica, è un'altra quota — e
 * lascerebbe i `QuotaConsumption` già registrati agganciati a un vincolo che non
 * è più quello sotto cui sono stati venduti).
 */
export const CapacityQuotaUpdateSchema = withoutMetadata(CapacityQuotaPartialSchema)
    .omit({ eventId: true, scope: true, scopeId: true, consumed: true });

export type CapacityQuotaUpdateDTO = z.infer<typeof CapacityQuotaUpdateSchema>;
