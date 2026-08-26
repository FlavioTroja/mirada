import { z } from "zod";
import { RegistrationPartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * §4.10 — l'`Update` **non consente di scrivere `assignedRole`**: la
 * riassegnazione passa dal servizio, che rilascia i consumi del vecchio ruolo e
 * impegna quelli del nuovo **con le stesse verifiche di un acquisto**. Scriverlo
 * qui sposterebbe una persona da un ruolo saturo all'altro senza che alcun
 * contatore se ne accorga.
 *
 * Fuori anche `status`, `confirmedAt` e `declinedAt`: sono transizioni
 * (`confirm`, `decline`), non campi.
 *
 * ── E fuori i due campi del residuo (`14` §5.2) ─────────────────────────────
 * `balanceDueAmount` è **quanto è nato** con la vendita e non si muove più;
 * `balanceSettledAmount` è un contatore che si sposta solo attraverso
 * `BalanceSettlementService`, come `CapacityQuota.consumed`. Lasciarli qui
 * significherebbe poter cancellare un debito — o inventare un incasso — con un
 * `PATCH`, senza che una sola riga del registro di cassa se ne accorga.
 */
export const RegistrationUpdateSchema = withoutMetadata(RegistrationPartialSchema)
    .omit({
        eventId: true,
        assignedRole: true,
        status: true,
        confirmedAt: true,
        declinedAt: true,
        balanceDueAmount: true,
        balanceSettledAmount: true,
    });

export type RegistrationUpdateDTO = z.infer<typeof RegistrationUpdateSchema>;
