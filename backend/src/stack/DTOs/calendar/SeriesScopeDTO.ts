import { z } from "zod";

/**
 * Su quali occorrenze di una serie agisce una modifica o un'eliminazione
 * (`20-calendario.md` §5.1). «Solo questo» non è qui: è il `PATCH`/`DELETE`
 * della riga, che la fa uscire dalla serie.
 */
export const SeriesScopeSchema = z.enum(["FOLLOWING", "ALL"]);
export type SeriesScope = z.infer<typeof SeriesScopeSchema>;

export const SeriesScopeQuerySchema = z.object({ scope: SeriesScopeSchema });
export type SeriesScopeQueryDTO = z.infer<typeof SeriesScopeQuerySchema>;

/** L'esito di un'eliminazione di serie: quante righe, e quante saltate e perché. */
export type SeriesDeletionDTO = {
    deleted: number;
    /** Già concluse: la storia non si riscrive. */
    skippedPast: number;
    /** Con almeno un check-in: qualcuno c'era, e la presenza resta. */
    skippedWithCheckIns: number;
};
