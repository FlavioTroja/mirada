import { z } from "zod";
import { SalesChannelDepositCodeSchema } from "@prisma-gen/zod";
import { withToBeDisconnected } from "@utils/helpers/schemaTransformers";

/**
 * I codici di acconto di un canale, **tutti insieme** — regola 12 di
 * `controllers.md`. Un solo `PUT` con lo stato desiderato dell'intera
 * collezione: `id: -1` per le righe nuove, `toBeDisconnected` per quelle da
 * togliere.
 *
 * Il `code` arriva come l'organizzatore lo scrive e viene **normalizzato dal
 * servizio** (`RF-SAL-2`): spazi via, tutto a maiuscolo. Non si valida qui la
 * forma perché non esiste una forma — `ACCONTO_30`, `acconto50`, `DEP-TRANI` sono
 * tutti codici legittimi, e l'unica cosa che conta è che corrispondano a ciò che
 * il negozio applica davvero.
 */
export const SalesChannelDepositCodeUpdateSchema = withToBeDisconnected(
    SalesChannelDepositCodeSchema.omit({
        salesChannelId: true,
        createdAt: true,
        updatedAt: true,
        deleted: true,
    })
).array();

export type SalesChannelDepositCodeUpdateDTO = z.infer<typeof SalesChannelDepositCodeUpdateSchema>;
