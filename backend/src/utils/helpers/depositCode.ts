/**
 * La forma normale di un codice di acconto — `14` §3.2, `RF-SAL-2`.
 *
 * Spazi rimossi, tutto a maiuscolo, **da entrambe le parti del confronto**:
 * `ACCONTO_30`, ` acconto_30 ` e `Acconto_30` sono lo stesso codice.
 *
 * ── Non è pigrizia: il difetto che evita è muto ─────────────────────────────
 * Un codice applicato a mano dal back-office del negozio con una
 * capitalizzazione diversa non verrebbe riconosciuto come acconto. Nessun
 * errore, nessuna quarantena, nessun segnale: la vendita entra come se fosse a
 * prezzo pieno, il residuo non nasce, e al botteghino nessuno chiede quei
 * centoventi euro. Se ne accorge il commercialista a settembre, ammesso che se
 * ne accorga.
 *
 * La normalizzazione non toglie nulla: `ACCONTO_30` e `ACCONTO_50` restano
 * distinti, che è tutto ciò che serve.
 *
 * Si normalizza **in scrittura** — la colonna `SalesChannelDepositCode.code`
 * contiene già la forma normale — perché una regola applicata a ogni lettura è
 * la stessa regola scritta in dieci posti, e il decimo prima o poi la dimentica.
 */
export function normalizeDepositCode(code: string): string {
    return code.replace(/\s+/g, "").toUpperCase();
}
