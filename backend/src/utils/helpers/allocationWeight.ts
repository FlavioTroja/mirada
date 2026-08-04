/**
 * Peso di ripartizione delle sessioni — backend-brief §3.6 / §4.6 (`RF-EVT-36`).
 *
 * Il default è **uniforme e calcolato sul numero di sessioni**: la somma dei pesi
 * di un evento vale `ALLOCATION_WEIGHT_TOTAL`, così il rimborso proporzionale e la
 * comunicazione ai soli titolari interessati di una sessione annullata si leggono
 * come percentuali senza ulteriori conversioni. L'organizzatore può assegnare pesi
 * diversi: in quel caso il servizio non li tocca più.
 */
export const ALLOCATION_WEIGHT_TOTAL = 100;

/** Peso uniforme per un evento con `sessionCount` sessioni. Mai inferiore a 1. */
export function uniformAllocationWeight(sessionCount: number): number {
    if (sessionCount <= 0) {
        return ALLOCATION_WEIGHT_TOTAL;
    }
    return Math.max(1, Math.floor(ALLOCATION_WEIGHT_TOTAL / sessionCount));
}
