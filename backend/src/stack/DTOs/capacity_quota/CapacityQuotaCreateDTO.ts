import { z } from "zod";
import { CapacityQuotaOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * §4.8 — `consumed` **non compare**: è un campo calcolato dal server (§5) e si
 * muove solo attraverso `CapacityEngineService`. Accettarlo dal client
 * significherebbe permettere di regalare o cancellare posti con una `POST`.
 *
 * `limiting` e `overbookAllowance` restano accettabili ma sono **forzati** dal
 * servizio sulle quote di ambito `EVENT` (capienza della sala e quote di ruolo):
 * lì non sono limiti commerciali ma vincoli di sicurezza.
 */
export const CapacityQuotaCreateSchema = withoutMetadata(CapacityQuotaOptionalDefaultsSchema)
    .omit({ consumed: true });

export type CapacityQuotaCreateDTO = z.infer<typeof CapacityQuotaCreateSchema>;
