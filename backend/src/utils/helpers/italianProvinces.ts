/**
 * Le 110 province italiane e la regione a cui appartengono — backend-brief §3.4.
 *
 * `Address.region` **non si digita**: il servizio la deriva dalla sigla di
 * provincia con questa tabella (`BT` → `Puglia`, `RM` → `Lazio`, …).
 *
 * ── Perché una colonna e non un calcolo in lettura ───────────────────────────
 * Il filtro geografico della ricerca pubblica (`POST /api/public/events/`)
 * dev'essere una **condizione indicizzata**: derivare la regione a ogni lettura
 * significherebbe o un `CASE` di 110 rami in ogni query o un filtro in memoria su
 * tutti gli eventi pubblicati. E un campo libero produrrebbe «Puglia», «PUGLIA» e
 * «Apulia» come **tre regioni diverse** nella faccettatura, che è il modo in cui
 * un filtro geografico smette di funzionare senza che nessuno se ne accorga.
 *
 * ── Perché la sigla e non il nome ────────────────────────────────────────────
 * La sigla è l'unico dato di provincia che non ha varianti ortografiche: «Reggio
 * Emilia», «Reggio nell'Emilia» e «Reggio Emilia (RE)» sono la stessa cosa, `RE`
 * è `RE` e basta.
 *
 * Funzione **pura**, senza I/O e senza stato: sta in `helpers/` per la regola 2
 * di `.claude/rules/layout.md`.
 *
 * ── Quante sono, e perché 111 e non 110 ─────────────────────────────────────
 * Il §3.4 parla delle «110 province italiane»: è l'insieme **anteriore alla
 * riforma del 2016**, quando la Sardegna aveva ancora `CI`, `VS`, `OT` e `OG` e
 * non aveva `SU`. Oggi gli enti di area vasta sono **107**. La tabella porta
 * l'unione dei due insiemi — **111 sigle** — perché le quattro sigle soppresse
 * compaiono ancora negli indirizzi già scritti e un dato storico non deve
 * perdere la propria regione solo perché la provincia è stata sciolta.
 */

/** Sigla di provincia → regione. Chiavi **sempre maiuscole**. */
const REGION_BY_PROVINCE: Readonly<Record<string, string>> = Object.freeze({
    // ── Abruzzo ──────────────────────────────────────────────────────────────
    AQ: "Abruzzo", CH: "Abruzzo", PE: "Abruzzo", TE: "Abruzzo",

    // ── Basilicata ───────────────────────────────────────────────────────────
    MT: "Basilicata", PZ: "Basilicata",

    // ── Calabria ─────────────────────────────────────────────────────────────
    CS: "Calabria", CZ: "Calabria", KR: "Calabria", RC: "Calabria", VV: "Calabria",

    // ── Campania ─────────────────────────────────────────────────────────────
    AV: "Campania", BN: "Campania", CE: "Campania", NA: "Campania", SA: "Campania",

    // ── Emilia-Romagna ───────────────────────────────────────────────────────
    BO: "Emilia-Romagna", FC: "Emilia-Romagna", FE: "Emilia-Romagna",
    MO: "Emilia-Romagna", PC: "Emilia-Romagna", PR: "Emilia-Romagna",
    RA: "Emilia-Romagna", RE: "Emilia-Romagna", RN: "Emilia-Romagna",

    // ── Friuli-Venezia Giulia ────────────────────────────────────────────────
    GO: "Friuli-Venezia Giulia", PN: "Friuli-Venezia Giulia",
    TS: "Friuli-Venezia Giulia", UD: "Friuli-Venezia Giulia",

    // ── Lazio ────────────────────────────────────────────────────────────────
    FR: "Lazio", LT: "Lazio", RI: "Lazio", RM: "Lazio", VT: "Lazio",

    // ── Liguria ──────────────────────────────────────────────────────────────
    GE: "Liguria", IM: "Liguria", SP: "Liguria", SV: "Liguria",

    // ── Lombardia ────────────────────────────────────────────────────────────
    BG: "Lombardia", BS: "Lombardia", CO: "Lombardia", CR: "Lombardia",
    LC: "Lombardia", LO: "Lombardia", MB: "Lombardia", MI: "Lombardia",
    MN: "Lombardia", PV: "Lombardia", SO: "Lombardia", VA: "Lombardia",

    // ── Marche ───────────────────────────────────────────────────────────────
    AN: "Marche", AP: "Marche", FM: "Marche", MC: "Marche", PU: "Marche",

    // ── Molise ───────────────────────────────────────────────────────────────
    CB: "Molise", IS: "Molise",

    // ── Piemonte ─────────────────────────────────────────────────────────────
    AL: "Piemonte", AT: "Piemonte", BI: "Piemonte", CN: "Piemonte",
    NO: "Piemonte", TO: "Piemonte", VB: "Piemonte", VC: "Piemonte",

    // ── Puglia ───────────────────────────────────────────────────────────────
    BA: "Puglia", BR: "Puglia", BT: "Puglia", FG: "Puglia", LE: "Puglia", TA: "Puglia",

    // ── Sardegna ─────────────────────────────────────────────────────────────
    CA: "Sardegna", NU: "Sardegna", OR: "Sardegna", SS: "Sardegna", SU: "Sardegna",
    // Soppresse nel 2016 ma ancora presenti negli indirizzi storici: mappate
    // comunque, così un dato vecchio non perde la propria regione.
    CI: "Sardegna", VS: "Sardegna", OT: "Sardegna", OG: "Sardegna",

    // ── Sicilia ──────────────────────────────────────────────────────────────
    AG: "Sicilia", CL: "Sicilia", CT: "Sicilia", EN: "Sicilia", ME: "Sicilia",
    PA: "Sicilia", RG: "Sicilia", SR: "Sicilia", TP: "Sicilia",

    // ── Toscana ──────────────────────────────────────────────────────────────
    AR: "Toscana", FI: "Toscana", GR: "Toscana", LI: "Toscana", LU: "Toscana",
    MS: "Toscana", PI: "Toscana", PO: "Toscana", PT: "Toscana", SI: "Toscana",

    // ── Trentino-Alto Adige ──────────────────────────────────────────────────
    BZ: "Trentino-Alto Adige", TN: "Trentino-Alto Adige",

    // ── Umbria ───────────────────────────────────────────────────────────────
    PG: "Umbria", TR: "Umbria",

    // ── Valle d'Aosta ────────────────────────────────────────────────────────
    AO: "Valle d'Aosta",

    // ── Veneto ───────────────────────────────────────────────────────────────
    BL: "Veneto", PD: "Veneto", RO: "Veneto", TV: "Veneto",
    VE: "Veneto", VI: "Veneto", VR: "Veneto",
});

/** Numero di sigle in tabella — asserito dai test, così una riga persa si vede. */
export const ITALIAN_PROVINCE_COUNT = Object.keys(REGION_BY_PROVINCE).length;

/** Le regioni italiane, ordinate: alimenta la faccettatura del filtro pubblico. */
export const ITALIAN_REGIONS: string[] = [...new Set(Object.values(REGION_BY_PROVINCE))].sort();

/**
 * Regione dalla sigla di provincia. `null` quando la sigla è assente, vuota o
 * non italiana: **`null` non è un errore**, è «non lo so», e un indirizzo estero
 * non deve ricevere una regione italiana inventata.
 *
 * Tollerante sulla forma di ciò che arriva (`" bt "`, `"Bt"`, `"BT"`) perché la
 * sigla è digitata a mano in un campo libero della foundation; **intollerante**
 * sul risultato: o è una sigla nota, o è `null`.
 */
export function regionForProvince(province?: string | null): string | null {
    if (!province) {
        return null;
    }
    const code = province.trim().toUpperCase();
    return REGION_BY_PROVINCE[code] ?? null;
}

/** Coppie `[sigla, regione]` — le usa la migrazione per popolare le righe esistenti. */
export function provinceRegionPairs(): [string, string][] {
    return Object.entries(REGION_BY_PROVINCE);
}
