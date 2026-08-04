/**
 * Politiche di rimborso — backend-brief §3.6 / §4.4, con l'emendamento B.0 che
 * introduce `derivedFromPolicyId`.
 *
 * Il §4.4 chiede che una policy derivata da un preset di piattaforma sia «più
 * favorevole al partecipante, mai più restrittiva». Fino all'emendamento la
 * regola non era verificabile perché mancava il termine di paragone: con
 * `derivedFromPolicyId` il confronto ha finalmente due estremi.
 */

/** Uno scaglione: «cancellando almeno `daysBefore` giorni prima, si rimborsa `percent`%». */
export type RefundTier = { daysBefore: number; percent: number };

/**
 * Percentuale rimborsata a chi cancella `daysBefore` giorni prima dell'evento.
 *
 * Si applica lo scaglione con la soglia **più alta fra quelle già raggiunte**:
 * chi cancella 40 giorni prima ricade nello scaglione dei 30 giorni, non in
 * quello dei 7. Sotto la soglia più bassa non si rimborsa nulla.
 */
export function refundPercentAt(tiers: RefundTier[], daysBefore: number): number {
    const applicable = tiers
        .filter(tier => tier.daysBefore <= daysBefore)
        .sort((a, b) => b.daysBefore - a.daysBefore)[0];

    return applicable?.percent ?? 0;
}

/** Le tre grandezze su cui si misura «più favorevole al partecipante». */
export type RefundPolicyTerms = {
    tiers: RefundTier[];
    transferDeadlineHours: number;
    feeRefundable: boolean;
};

/**
 * Elenca — in italiano, pronte per il messaggio d'errore — le condizioni in cui
 * `derived` è **più restrittiva** di `preset`. Array vuoto = derivazione lecita.
 *
 * Le tre grandezze e il verso in cui migliorano:
 *  - `tiers`                  → rimborsare **di più** a parità di preavviso;
 *  - `transferDeadlineHours`  → consentire il trasferimento **più a ridosso**
 *                               dell'evento, quindi un valore **minore**;
 *  - `feeRefundable`          → restituire anche i diritti di prevendita.
 */
export function findRestrictions(derived: RefundPolicyTerms, preset: RefundPolicyTerms): string[] {
    const violations: string[] = [];

    // Il confronto va fatto su ogni soglia dichiarata dall'una o dall'altra: è
    // l'unico insieme di punti in cui una delle due curve può cambiare valore.
    const thresholds = [...new Set([
        0,
        ...preset.tiers.map(tier => tier.daysBefore),
        ...derived.tiers.map(tier => tier.daysBefore),
    ])].sort((a, b) => a - b);

    for (const daysBefore of thresholds) {
        const derivedPercent = refundPercentAt(derived.tiers, daysBefore);
        const presetPercent = refundPercentAt(preset.tiers, daysBefore);

        if (derivedPercent < presetPercent) {
            violations.push(
                `a ${daysBefore} giorni dall'evento la policy rimborsa il ${derivedPercent}% `
                + `contro il ${presetPercent}% del preset`,
            );
        }
    }

    if (derived.transferDeadlineHours > preset.transferDeadlineHours) {
        violations.push(
            `il trasferimento del biglietto si chiude ${derived.transferDeadlineHours} ore prima dell'evento `
            + `contro le ${preset.transferDeadlineHours} ore del preset`,
        );
    }

    if (preset.feeRefundable && !derived.feeRefundable) {
        violations.push("i diritti di prevendita non sono rimborsabili mentre nel preset lo sono");
    }

    return violations;
}
