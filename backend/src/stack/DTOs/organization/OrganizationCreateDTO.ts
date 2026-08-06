import { z } from "zod";
import { OrganizationOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * `stripeAccountId`, `payoutStatus` e `payoutCheckedAt` sono calcolati dal server
 * a partire dalla risposta di Stripe: non compaiono in NESSUN DTO di scrittura
 * (backend-brief §4.2 e §5).
 */
export const OrganizationCreateSchema = withoutMetadata(
    OrganizationOptionalDefaultsSchema.omit({
        stripeAccountId: true,
        payoutStatus: true,
        payoutCheckedAt: true,
    }),
).extend({
    /**
     * **Chi possiede l'organizzazione**, e non chi la digita.
     *
     * Nel primo taglio le organizzazioni le crea a mano il Super Admin (§4.2), e
     * questo campo esiste perché il creatore e il titolare **non sono la stessa
     * persona**: senza di esso `GOD` diventerebbe proprietario di ogni cliente
     * della piattaforma — membro di ogni tenant, destinatario dei segnali in
     * tempo reale di tutti.
     *
     * È facoltativo perché la ricaduta sul creatore è corretta il giorno in cui
     * un organizzatore si registrerà da sé. Finché a creare è `GOD`, il servizio
     * lo pretende: un'organizzazione senza titolare designato non si apre.
     */
    ownerUserId: z.number().int().positive().optional(),
});

export type OrganizationCreateDTO = z.infer<typeof OrganizationCreateSchema>;
