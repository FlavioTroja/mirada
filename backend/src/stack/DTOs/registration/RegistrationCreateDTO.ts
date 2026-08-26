import { z } from "zod";
import { RegistrationOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * §4.10 — `assignedRole` **non compare**: è un campo calcolato dal server (§5),
 * risolto dal motore di capienza alla conferma del pagamento. `confirmedAt` e
 * `declinedAt` seguono le transizioni di `confirm` / `decline`, non il client.
 *
 * `balanceDueAmount` e `balanceSettledAmount` nemmeno (`14` §5.2): il residuo lo
 * genera l'ingestione della vendita con acconto, e lo muove il registro di
 * cassa. Un'iscrizione creata da fuori con un residuo già dentro sarebbe un
 * debito che nessuna vendita ha prodotto.
 */
export const RegistrationCreateSchema = withoutMetadata(RegistrationOptionalDefaultsSchema)
    .omit({
        assignedRole: true,
        confirmedAt: true,
        declinedAt: true,
        balanceDueAmount: true,
        balanceSettledAmount: true,
    });

export type RegistrationCreateDTO = z.infer<typeof RegistrationCreateSchema>;
