#!/usr/bin/env node
/**
 * Cerca **backtick dentro i commenti dei componenti Angular**.
 *
 * Un backtick in un commento — HTML nel `template`, slash-star negli `styles` —
 * chiude la stringa in anticipo, e il resto del file diventa codice privo di
 * senso. L'errore che ne esce è `NG1002: Incorrect number of arguments to
 * @Component decorator`, che non nomina né il commento né la riga: si perde più
 * tempo a capire cosa sia successo che a scriverlo.
 *
 * ── Perché l'analisi NON entra nel literal ───────────────────────────────────
 * Una prima versione cercava i commenti *dentro* i blocchi `template:` e
 * `styles:`, delimitandoli col primo backtick di chiusura. Non trovava nulla, e
 * per la ragione stessa del difetto: il backtick incriminato **è** quella
 * chiusura, quindi il commento cade fuori dal blocco e non viene mai esaminato.
 * Un controllo che presuppone il file integro non può accorgersi che è rotto.
 *
 * Qui si lavora sul testo grezzo:
 *  · i commenti HTML in un `.ts` esistono solo dentro un template Angular;
 *  · i commenti CSS contano solo se stanno dopo un `styles:` — quelli prima
 *    sono JSDoc, dove il backtick è legittimo e anzi utile.
 *
 *   node tools/check-template-backticks.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['app/src', 'www/src'];

function* walk(dir) {
    let entries;
    try {
        entries = readdirSync(dir);
    } catch {
        return;
    }
    for (const entry of entries) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) yield* walk(full);
        else if (full.endsWith('.ts')) yield full;
    }
}

const lineOf = (source, index) => source.slice(0, index).split('\n').length;

const offending = [];

for (const root of ROOTS) {
    for (const file of walk(root)) {
        const source = readFileSync(file, 'utf8');
        if (!source.includes('@Component')) continue;

        // 1. Commenti HTML: in un `.ts` stanno per forza dentro un template.
        for (const m of source.matchAll(/<!--[\s\S]*?-->/g)) {
            if (m[0].includes('`')) {
                offending.push({ file, line: lineOf(source, m.index), where: 'commento HTML del template' });
            }
        }

        // 2. Commenti CSS dentro `styles:`.
        //
        //    La regione va da `styles:` alla chiusura del decoratore — la prima
        //    riga che comincia con `})`. Delimitarla solo «da styles in poi»
        //    prendeva anche tutti i JSDoc della classe, dove il backtick è
        //    legittimo e anzi utile: quarantuno falsi allarmi, cioè un controllo
        //    che nessuno avrebbe più guardato.
        const stylesAt = source.search(/styles\s*:/);
        if (stylesAt === -1) continue;
        const decoratorEnd = source.indexOf('\n})', stylesAt);
        const stylesEnd = decoratorEnd === -1 ? source.length : decoratorEnd;
        for (const m of source.matchAll(/\/\*[\s\S]*?\*\//g)) {
            if (m.index < stylesAt || m.index > stylesEnd) continue;
            if (m[0].includes('`')) {
                offending.push({ file, line: lineOf(source, m.index), where: 'commento CSS negli styles' });
            }
        }
    }
}

if (offending.length === 0) {
    console.log('Nessun backtick nei commenti dei componenti. Tutto a posto.');
    process.exit(0);
}

console.error('Backtick dentro un commento di un componente: chiude il template literal in anticipo.\n');
for (const o of offending) {
    console.error(`  ${o.file}:${o.line}  — ${o.where}`);
}
console.error('\nLì dentro il backtick non si può scrivere: usa le virgolette basse «…» o nessuna citazione.');
process.exit(1);
