import { EventDashboardDTO } from "@DTOs/event/EventDashboardDTO";

/**
 * `GET /dashboard/today` — la giornata dell'organizzazione (`21-dashboard.md` §3).
 * Solo risposta: non ha corpo né parametri, il giorno è quello di `Europe/Rome`.
 */
export type TodaySessionDTO = {
    id: number;
    eventId: number;
    /** Il corso o l'evento. */
    eventTitle: unknown;
    /** Il nome della sessione («Lezione», «Milonga di gala»). */
    name: unknown;
    family: "EVENT" | "COURSE";
    kind: "REGULAR" | "OPEN_DAY";
    isImplicit: boolean;
    room: string | null;
    venue: string | null;
    startAt: Date;
    endAt: Date;
    cancelled: boolean;
    phase: "UPCOMING" | "ONGOING" | "ENDED";
    /** Iscritti (corso) o biglietti validi (evento) che danno accesso alla sessione. */
    expected: number;
    /**
     * Ingressi registrati. **Nullo per le lezioni**: un corso non emette biglietti
     * (`RF-COR-6`) e il registro presenze è fuori dal taglio — zero sarebbe falso.
     */
    entries: number | null;
    leaders: number | null;
    followers: number | null;
};

export type DashboardTodayDTO = {
    /** Il giorno di Roma, `AAAA-MM-GG`, e l'istante in cui la lettura è stata fatta. */
    day: string;
    generatedAt: Date;
    sessions: TodaySessionDTO[];
    /** Gli impegni dello staff di oggi (riunioni, prove), per il programma «Oggi». */
    appointments: { id: number; title: string; startAt: Date; endAt: Date; allDay: boolean; room: string | null }[];
    /** Entrati alle sessioni in corso adesso. Non esiste l'uscita: «in sala» vuol dire «entrati». */
    inRoom: number;
    /** Attesi alle sessioni di oggi che hanno biglietti. */
    expectedToday: number;
    /** Ingressi di oggi per quarto d'ora, 96 caselle dalla mezzanotte di Roma. */
    entriesByQuarter: number[];
    registrations: {
        today: number;
        byFamily: { EVENT: number; COURSE: number };
        byChannel: Record<string, number>;
        /** Gli ultimi otto giorni, il più vecchio per primo: oggi è l'ultimo. */
        lastDays: number[];
    };
    /** In centesimi. */
    money: {
        total: number;
        online: number;
        boxOffice: number;
        externalShops: number;
        /** Incassato cumulato alla fine di ogni ora di oggi: 24 valori. */
        cumulativeByHour: number[];
        openBalances: { count: number; amount: number };
    };
    todo: {
        quarantinedSales: number;
        requirementsUnderReview: number;
        checkInConflicts: number;
        settlementConflicts: number;
    };
    nextEvent: { id: number; title: unknown; startAt: Date; endAt: Date; dashboard: EventDashboardDTO } | null;
};
