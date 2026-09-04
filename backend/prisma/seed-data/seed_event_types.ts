import { EventTypeFamily, Prisma } from "@prisma/client";

/**
 * I tipi evento di catalogo (§4.1) — scrittura riservata a `GOD`, quindi il seme
 * è l'unica strada per portarne uno in esercizio.
 *
 * ── `family` non è lo slug ───────────────────────────────────────────────────
 * `EVENT` e `COURSE` decidono in quale lista del back-office il tipo compare, e
 * se le sue istanze finiscono sul sito pubblico. Un secondo tipo di corso —
 * «Corso serale», «Intensivo» — si aggiunge qui con `family: COURSE` e funziona:
 * filtrare sullo slug lo avrebbe lasciato fuori senza che nulla fallisse.
 *
 * ── `sessionsLabel` è la parola, non la struttura ────────────────────────────
 * La `Session` di un corso è «Lezione 3», quella di un festival «Seminario del
 * sabato». Stessa tabella — ci girano check-in, quote e titoli — parola diversa.
 */
export const seed_event_types: Prisma.EventTypeCreateInput[] = [
    {
        name: { it: "Corso", en: "Course" },
        slug: "corso",
        family: EventTypeFamily.COURSE,
        sessionsLabel: { it: "Lezioni", en: "Lessons" },
        // Un corso è multi-sessione per definizione: le lezioni SONO il corso.
        capMultiSession: true,
        // L'equilibrio leader/follower di una classe è il problema gestionale
        // numero uno di una scuola di tango, e il motore di capienza lo sa già fare.
        capRoleQuotas: true,
        // Principianti, intermedi, avanzati.
        capLevels: true,
        // Nessun cast: l'insegnante di un corso trimestrale non è la locandina di
        // un festival. Nessuna iscrizione a coppia: al corso ci si iscrive da soli.
        capCast: false,
        capCouple: false,
        sortOrder: 100,
    },
];
