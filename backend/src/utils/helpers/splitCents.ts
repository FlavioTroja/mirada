/**
 * Ripartizione di un importo in centesimi fra più quote — `14` §4.5, `RB28`.
 *
 * ── L'invariante, e perché è l'unica cosa che conta ─────────────────────────
 * **La somma delle quote è esattamente l'importo di partenza.** Non c'è un
 * arrotondamento «di cortesia» a cifra tonda, non c'è un centesimo che si crea e
 * non ce n'è uno che si perde: €108,50 su tre posti fanno `36,17 · 36,17 ·
 * 36,16`, e non `36,17` tre volte.
 *
 * Un centesimo perso per posto, su ottocento posti, sono otto euro che non
 * tornano e una serata a cercarli — con la particolarità che il conto non
 * torna **di poco**, che è il modo peggiore in cui un conto può non tornare:
 * abbastanza da far dubitare della cassa, troppo poco da far sospettare il
 * software.
 *
 * Il resto va **ai primi**, un centesimo per volta. La scelta di quali quote lo
 * ricevano è arbitraria — l'importante è che sia deterministica, così due
 * calcoli dello stesso residuo danno le stesse cifre e nessuno si trova a
 * dovere un centesimo diverso da ieri.
 */
export function splitCents(total: number, parts: number): number[] {
    if (parts <= 0) {
        return [];
    }

    // Il verso della divisione va deciso qui e non dentro `Math.floor`, che su
    // un numero negativo arrotonda verso il basso e produrrebbe un resto
    // negativo da spalmare al contrario.
    const sign = total < 0 ? -1 : 1;
    const absolute = Math.abs(total);

    const base = Math.floor(absolute / parts);
    const remainder = absolute - base * parts;

    return Array.from({ length: parts }, (_unused, index) => sign * (base + (index < remainder ? 1 : 0)));
}
