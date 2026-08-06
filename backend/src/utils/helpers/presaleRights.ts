/**
 * **Diritti di prevendita** — backend-brief §4.11, `RF-PAY-35`, `RB1`.
 *
 * Sono **ricavo della piattaforma**, pagati dal partecipante, esposti come voce
 * separata in checkout, e **non transitano mai dall'organizzatore**.
 *
 * ── La regola che questo file esiste per far rispettare ──────────────────────
 * `RF-PAY-35`: **si calcolano per biglietto, non per ordine.** Non è una
 * sfumatura contabile: è ciò che rende la suddivisione del carrello in un ordine
 * per organizzatore (`RF-PAY-34`) **invisibile al totale**. Con una quota per
 * ordine, comprare due titoli di due organizzatori diversi costerebbe al
 * partecipante due volte i diritti, e la piattaforma gli farebbe pagare una
 * propria scelta di architettura. Con la quota per biglietto la domanda «fee per
 * ordine o per riga?» semplicemente non si pone.
 *
 * ── Ciò che NON è deciso, e perché il default è zero ─────────────────────────
 * Il brief e i documenti sorgente fissano la **natura** dei diritti di prevendita
 * (ricavo della piattaforma, per biglietto, voce separata) ma **non il loro
 * importo né la loro formula**: nessun `RF-*`, nessuna riga di `03`, `08` o `11`
 * dice quanto valgono. Inventare un numero qui sarebbe inventare un modello di
 * business, che il §5 vieta espressamente («Modelli di business inventati:
 * **nessuno**»).
 *
 * La struttura è quindi completa e i parametri sono **parametri di piattaforma**
 * (`Config`, ambito `checkout`) con default a **zero**: il calcolo per biglietto
 * è realizzato e verificabile, e il giorno in cui il committente fissa la tariffa
 * si scrive una riga di configurazione — non una riga di codice.
 *
 * Zero è anche il default **sicuro**: non apre `confirm-free`, perché quel
 * percorso guarda il **totale**, e un titolo da novanta euro con zero diritti di
 * prevendita fa comunque novanta euro.
 *
 * Funzione **pura**, senza I/O: sta in `helpers/` per la regola 2 di `layout.md`.
 */

/** Tariffa della piattaforma, letta dalla configurazione (§5, ambito `checkout`). */
export type PresaleRightsPolicy = {
    /** Quota fissa per biglietto, in **centesimi interi** (§3.1). */
    fixedCents: number;
    /** Quota proporzionale al prezzo del biglietto, in **punti base** (100 = 1%). */
    basisPoints: number;
    /** Tetto minimo per biglietto, in centesimi. `null` = nessun minimo. */
    minCents: number | null;
    /** Tetto massimo per biglietto, in centesimi. `null` = nessun massimo. */
    maxCents: number | null;
};

/** Tutto a zero: la tariffa non è ancora decisa dal committente (vedi sopra). */
export const NO_PRESALE_RIGHTS: PresaleRightsPolicy = {
    fixedCents: 0,
    basisPoints: 0,
    minCents: null,
    maxCents: null,
};

/**
 * Diritti di prevendita **di un singolo biglietto**, a partire dal suo prezzo.
 *
 * Il risultato è un intero di centesimi: si arrotonda **per difetto** con
 * `Math.floor`, così la piattaforma non incassa mai un centesimo che il calcolo
 * non giustifica pienamente. Non può essere negativo, qualunque cosa dica la
 * configurazione: un diritto di prevendita negativo sarebbe uno sconto pagato
 * dalla piattaforma, che non è un caso previsto da nessuna parte.
 *
 * @param unitPrice prezzo del biglietto in centesimi — quello **bloccato**, non
 *                  il prezzo base: se l'utente entra sull'*early bird*, i diritti
 *                  proporzionali seguono l'*early bird*.
 */
export function presaleRightsForTicket(unitPrice: number, policy: PresaleRightsPolicy): number {
    const proportional = Math.floor((unitPrice * policy.basisPoints) / 10_000);
    let amount = policy.fixedCents + proportional;

    if (policy.minCents !== null) {
        amount = Math.max(amount, policy.minCents);
    }
    if (policy.maxCents !== null) {
        amount = Math.min(amount, policy.maxCents);
    }

    return Math.max(0, amount);
}
