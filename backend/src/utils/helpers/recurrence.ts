import { DateTime, Duration } from "luxon";

/**
 * **La ripetizione settimanale del calendario** — `20-calendario.md` §5.
 *
 * Non esiste una regola di ricorrenza nello schema (`15-corsi.md` §2.3): «ogni
 * martedì alle 20:30 fino al 15 dicembre» diventa righe vere, una per
 * occorrenza. Questo file calcola **quali** righe, e nient'altro.
 *
 * ── Perché l'ora è locale, e non UTC ────────────────────────────────────────
 * Il 25 ottobre 2026 finisce l'ora legale. Sommare sette giorni in UTC a una
 * lezione delle 20:30 la porta alle 19:30 per tutto l'inverno — e nessuno se ne
 * accorge prima di trovarsi la sala vuota. Qui ogni occorrenza è costruita sul
 * **giorno locale** e vi riceve la stessa ora d'orologio della prima.
 */

/** Il fuso della scuola. Lo stesso di `mail/templates/format.ts`, per la stessa ragione. */
export const CALENDAR_TIMEZONE = process.env.TIMEZONE ?? "Europe/Rome";

/** Due anni di un giorno a settimana. Oltre, è quasi certamente un errore di data. */
export const MAX_OCCURRENCES = 104;

/** Il più largo intervallo che una vista del calendario chiede: un mese e le code della griglia. */
export const MAX_CALENDAR_RANGE_DAYS = 45;

/** Giorni ISO (lunedì = 1 … domenica = 7), e fino a una data locale inclusa **oppure** per N volte. */
export type Recurrence = {
    weekdays: number[];
    until?: string;
    count?: number;
};

export type Occurrence = { startAt: Date; endAt: Date };

/** Esito di un'espansione: le occorrenze, o il motivo per cui non ce ne sono. */
export type Expansion =
    | { ok: true; occurrences: Occurrence[] }
    | { ok: false; reason: "FIRST_DAY_NOT_SELECTED" | "UNTIL_BEFORE_START" | "TOO_MANY" };

/**
 * La durata **in tempo d'orologio**: un giorno resta «un giorno» anche quando
 * quel giorno ne dura 23, e un appuntamento «tutto il giorno» finisce a
 * mezzanotte e non alle 23:00.
 */
function wallDuration(startAt: Date, endAt: Date, zone: string): Duration {
    const start = DateTime.fromJSDate(startAt, { zone });
    const end = DateTime.fromJSDate(endAt, { zone });
    return end.diff(start, ["days", "hours", "minutes", "seconds", "milliseconds"]);
}

/**
 * Le occorrenze di una ripetizione settimanale. Senza `recurrence`, la sola
 * occorrenza indicata.
 *
 * Il primo giorno **deve** essere fra quelli scelti: altrimenti la voce su cui
 * l'utente ha cliccato non esisterebbe, e la serie comincerebbe in un giorno che
 * non ha mai visto sulla griglia.
 */
export function expandWeekly(
    startAt: Date,
    endAt: Date,
    recurrence?: Recurrence,
    zone: string = CALENDAR_TIMEZONE,
): Expansion {
    if (!recurrence) {
        return { ok: true, occurrences: [{ startAt, endAt }] };
    }

    const start = DateTime.fromJSDate(startAt, { zone });
    const weekdays = new Set(recurrence.weekdays);
    if (!weekdays.has(start.weekday)) {
        return { ok: false, reason: "FIRST_DAY_NOT_SELECTED" };
    }

    const lastDay = recurrence.until ? DateTime.fromISO(recurrence.until, { zone }).startOf("day") : null;
    if (lastDay && lastDay < start.startOf("day")) {
        return { ok: false, reason: "UNTIL_BEFORE_START" };
    }

    const duration = wallDuration(startAt, endAt, zone);
    const occurrences: Occurrence[] = [];

    for (let day = start.startOf("day"); ; day = day.plus({ days: 1 })) {
        if (lastDay && day > lastDay) break;
        if (recurrence.count !== undefined && occurrences.length >= recurrence.count) break;
        if (occurrences.length > MAX_OCCURRENCES) {
            return { ok: false, reason: "TOO_MANY" };
        }
        if (!weekdays.has(day.weekday)) continue;

        const occurrenceStart = day.set({
            hour: start.hour,
            minute: start.minute,
            second: start.second,
            millisecond: start.millisecond,
        });
        occurrences.push({
            startAt: occurrenceStart.toJSDate(),
            endAt: occurrenceStart.plus(duration).toJSDate(),
        });
    }

    if (occurrences.length > MAX_OCCURRENCES) {
        return { ok: false, reason: "TOO_MANY" };
    }
    return { ok: true, occurrences };
}

/** Il messaggio per l'utente di un'espansione rifiutata. */
export function expansionErrorMessage(reason: Exclude<Expansion, { ok: true }>["reason"]): string {
    switch (reason) {
        case "FIRST_DAY_NOT_SELECTED":
            return "Il primo giorno deve essere uno dei giorni in cui si ripete.";
        case "UNTIL_BEFORE_START":
            return "La data di fine ripetizione viene prima del primo giorno.";
        case "TOO_MANY":
            return `Una ripetizione non può superare ${MAX_OCCURRENCES} occorrenze.`;
    }
}

/**
 * **Una modifica «a tutta la serie»** applicata a un'occorrenza: la nuova ora
 * d'orologio e la nuova durata, **nel giorno dell'occorrenza**.
 *
 * `template` è l'occorrenza da cui l'utente ha fatto la modifica, con i suoi
 * nuovi orari. Il giorno non si propaga (`20-calendario.md` §5.1): è il chiamante
 * a rifiutare un template spostato di giorno.
 */
export function retime(
    occurrenceStartAt: Date,
    template: Occurrence,
    zone: string = CALENDAR_TIMEZONE,
): Occurrence {
    const day = DateTime.fromJSDate(occurrenceStartAt, { zone }).startOf("day");
    const clock = DateTime.fromJSDate(template.startAt, { zone });
    const start = day.set({ hour: clock.hour, minute: clock.minute, second: clock.second, millisecond: clock.millisecond });
    return {
        startAt: start.toJSDate(),
        endAt: start.plus(wallDuration(template.startAt, template.endAt, zone)).toJSDate(),
    };
}

/** True quando due istanti cadono nello stesso giorno locale. */
export function sameLocalDay(a: Date, b: Date, zone: string = CALENDAR_TIMEZONE): boolean {
    return DateTime.fromJSDate(a, { zone }).toISODate() === DateTime.fromJSDate(b, { zone }).toISODate();
}
