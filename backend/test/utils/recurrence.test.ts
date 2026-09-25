import { DateTime } from "luxon";
import { expandWeekly, MAX_OCCURRENCES, retime } from "@utils/helpers/recurrence";

const ZONE = "Europe/Rome";
const local = (iso: string) => DateTime.fromISO(iso, { zone: ZONE }).toJSDate();
const clock = (d: Date) => DateTime.fromJSDate(d, { zone: ZONE }).toFormat("yyyy-MM-dd HH:mm");

/**
 * La ripetizione settimanale — `20-calendario.md` §5. Il caso che conta è il
 * primo: se l'ora slittasse con la fine dell'ora legale, gli allievi
 * arriverebbero un'ora dopo per tutto l'inverno, e niente fallirebbe.
 */
describe("expandWeekly", () => {
    it("tiene le 20:30 locali a cavallo della fine dell'ora legale (25 ottobre 2026)", () => {
        const result = expandWeekly(
            local("2026-10-13T20:30"),
            local("2026-10-13T22:00"),
            { weekdays: [2], until: "2026-11-03" },
            ZONE,
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.occurrences.map(o => clock(o.startAt))).toEqual([
            "2026-10-13 20:30",
            "2026-10-20 20:30",
            "2026-10-27 20:30",
            "2026-11-03 20:30",
        ]);
        expect(result.occurrences.map(o => clock(o.endAt))).toEqual([
            "2026-10-13 22:00",
            "2026-10-20 22:00",
            "2026-10-27 22:00",
            "2026-11-03 22:00",
        ]);
        // E in UTC, dove si vede che l'istante si è davvero spostato di un'ora.
        expect(result.occurrences.map(o => o.startAt.toISOString().slice(11, 16))).toEqual([
            "18:30", "18:30", "19:30", "19:30",
        ]);
    });

    it("con più giorni e «per N volte» conta le occorrenze, non le settimane", () => {
        const result = expandWeekly(
            local("2026-09-29T19:00"),
            local("2026-09-29T20:00"),
            { weekdays: [2, 4], count: 3 },
            ZONE,
        );

        expect(result.ok && result.occurrences.map(o => clock(o.startAt))).toEqual([
            "2026-09-29 19:00",
            "2026-10-01 19:00",
            "2026-10-06 19:00",
        ]);
    });

    it("rifiuta una serie che non comincia in uno dei giorni scelti", () => {
        const result = expandWeekly(
            local("2026-09-28T20:00"), // lunedì
            local("2026-09-28T21:00"),
            { weekdays: [2], count: 4 },
            ZONE,
        );
        expect(result).toEqual({ ok: false, reason: "FIRST_DAY_NOT_SELECTED" });
    });

    it(`rifiuta oltre ${MAX_OCCURRENCES} occorrenze`, () => {
        const result = expandWeekly(
            local("2026-09-29T20:30"),
            local("2026-09-29T22:00"),
            { weekdays: [2], until: "2029-12-31" },
            ZONE,
        );
        expect(result).toEqual({ ok: false, reason: "TOO_MANY" });
    });

    it("un giorno intero resta da mezzanotte a mezzanotte anche nel giorno di 25 ore", () => {
        const result = expandWeekly(
            local("2026-10-18T00:00"),
            local("2026-10-19T00:00"),
            { weekdays: [7], count: 2 },
            ZONE,
        );
        expect(result.ok && result.occurrences.map(o => [clock(o.startAt), clock(o.endAt)])).toEqual([
            ["2026-10-18 00:00", "2026-10-19 00:00"],
            ["2026-10-25 00:00", "2026-10-26 00:00"],
        ]);
    });

    it("senza ripetizione restituisce l'occorrenza così com'è", () => {
        const startAt = local("2026-09-29T20:30");
        const endAt = local("2026-09-29T22:00");
        expect(expandWeekly(startAt, endAt, undefined, ZONE)).toEqual({ ok: true, occurrences: [{ startAt, endAt }] });
    });
});

describe("retime", () => {
    it("porta l'ora e la durata nuove nel giorno dell'occorrenza, anche dopo il cambio d'ora", () => {
        const moved = retime(
            local("2026-10-27T20:30"),
            { startAt: local("2026-10-13T21:00"), endAt: local("2026-10-13T22:30") },
            ZONE,
        );
        expect([clock(moved.startAt), clock(moved.endAt)]).toEqual(["2026-10-27 21:00", "2026-10-27 22:30"]);
    });
});
