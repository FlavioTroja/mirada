/**
 * Centesimi interi → la cifra **come la scrive un italiano**: `1.234,50 €`.
 *
 * ── Perché non `toFixed(2)` ─────────────────────────────────────────────────
 * Perché produce `60.00`, col punto, e quei messaggi finiscono **accanto** agli
 * importi formattati dal front-office, che scrive `180,00 €`. Sulla stessa
 * schermata comparivano le due forme a due centimetri di distanza — visto in
 * esercizio il 15 settembre 2026, nel rifiuto di mezza rata.
 *
 * Non è pignoleria tipografica: due notazioni per la stessa cosa nello stesso
 * riquadro fanno dubitare che siano la stessa cosa, e chi legge sta per prendere
 * dei soldi in mano.
 */
export function euro(cents: number): string {
    return `${new Intl.NumberFormat("it-IT", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(cents / 100)} €`;
}
