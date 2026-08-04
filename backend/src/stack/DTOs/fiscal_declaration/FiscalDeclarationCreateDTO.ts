import { z } from "zod";
import { FiscalDeclarationOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * §4.3 — `version`, `declaredAt`, `declaredByUserId` e `ipAddress` sono calcolati
 * dal server e mai accettati dal client. Il DTO `Update` NON esiste: la
 * dichiarazione è immutabile, si crea una nuova versione (`RF-ORG-8`).
 */
export const FiscalDeclarationCreateSchema = withoutMetadata(FiscalDeclarationOptionalDefaultsSchema)
    .omit({
        version: true,
        declaredAt: true,
        declaredByUserId: true,
        ipAddress: true,
    });

export type FiscalDeclarationCreateDTO = z.infer<typeof FiscalDeclarationCreateSchema>;
