import { z } from "zod";
import { DanceRoleSchema, EventStatusSchema } from "@prisma-gen/zod";

/**
 * `GET /events/:id/dashboard` — backend-brief §3.7 (`RF-BKO-1`, `RF-CPL-11`).
 *
 * ── `RB21`: ogni numero dichiara su quali dati è calcolato ────────────────────
 * Il cruscotto del brief chiede venduto per titolo, incasso netto, iscritti per
 * ruolo con sbilancio, coppie complete, servizi venduti, requisiti mancanti e
 * andamento. Nel perimetro attuale `Order`, `OrderLine` e `Payment`
 * **non esistono ancora** (§2, passi 18→22, rinviati con Stripe): le voci che dipendono da loro **non sono inventate né azzerate in
 * silenzio**. Ogni sezione porta quindi `available`, l'elenco `basedOn` delle
 * entità su cui è davvero calcolata e, quando indisponibile, `requires` e
 * `reason`.
 *
 * La distinzione che il consumatore non deve mai perdere: ciò che il motore di
 * capienza registra è **impegnato** (`QuotaConsumption`), non **venduto e
 * incassato**. Finché `Order` e `Payment` non esistono le due cose non
 * coincidono, e questo DTO le tiene separate per nome.
 */

/** Entità di dominio su cui una sezione è realmente calcolata (`RB21`). */
export const DashboardDataSourceSchema = z.enum([
    "Event",
    "Registration",
    "CapacityQuota",
    "QuotaConsumption",
    "Couple",
    "TicketType",
    "EventService",
    "EventRequirement",
    "Session",
    // Fase D1 — passi 17 e 23→26 del §2.
    "Ticket",
    "CheckIn",
    "RequirementOutcome",
    // Fase D2 — il percorso d'acquisto (passi 18→26 del §2).
    "Purchase",
    "Order",
    "OrderLine",
    "Payment",
    // Acconto e saldo (`14`).
    "BalanceSettlement",
]);
export type DashboardDataSource = z.infer<typeof DashboardDataSourceSchema>;

const availableSection = <T extends z.ZodRawShape>(shape: T) =>
    z.object({
        available: z.literal(true),
        basedOn: DashboardDataSourceSchema.array(),
        note: z.string().optional(),
        ...shape,
    });

/** Sezione che il perimetro attuale non può calcolare: dichiarata, mai finta. */
export const UnavailableSectionSchema = z.object({
    available: z.literal(false),
    /** Entità di §2 ancora da costruire, senza le quali il numero non esiste. */
    requires: z.string().array(),
    reason: z.string(),
});
export type UnavailableSectionDTO = z.infer<typeof UnavailableSectionSchema>;

export const RoleQuotaSnapshotSchema = z.object({
    role: DanceRoleSchema,
    limit: z.number().int(),
    consumed: z.number().int(),
    remaining: z.number().int(),
    limiting: z.boolean(),
});

export const RegistrationsByRoleSchema = availableSection({
    leader: z.number().int(),
    follower: z.number().int(),
    /** Iscrizioni attive senza ruolo assegnato — `FLEXIBLE` non ancora risolto. */
    unassigned: z.number().int(),
    total: z.number().int(),
    declared: z.object({
        LEADER: z.number().int(),
        FOLLOWER: z.number().int(),
        FLEXIBLE: z.number().int(),
    }),
    /** `leader − follower`, con il segno: dice **quale** ruolo è in eccesso. */
    imbalance: z.number().int(),
    /** Tolleranza configurata sulle quote di ruolo di ambito EVENT. `null` = nessun cancello. */
    imbalanceTolerance: z.number().int().nullable(),
    roleQuotas: RoleQuotaSnapshotSchema.array(),
});

export const CapacitySnapshotSchema = availableSection({
    room: z
        .object({
            limit: z.number().int(),
            consumed: z.number().int(),
            remaining: z.number().int(),
        })
        .nullable(),
    quotas: z
        .object({
            id: z.number().int(),
            scope: z.string(),
            scopeId: z.number().int().nullable(),
            /**
             * **Il nome dell'entità a cui la quota si riferisce.**
             *
             * Senza, il cruscotto elencava ventotto righe che dicevano
             * «Sessione 0 / 30 — 30 residui», venti volte identiche: il `scopeId`
             * da solo non è un'informazione che un organizzatore possa usare, e
             * un elenco che non si può leggere è peggio di un elenco assente.
             *
             * `null` per le quote di ambito `EVENT`, che un nome non ce l'hanno
             * — sono l'evento stesso — e per un riferimento rimasto orfano.
             */
            scopeName: z.unknown().nullable(),
            /**
             * L'inizio della sessione, quando l'ambito è `SESSION`.
             *
             * Il nome da solo non basta: nel programma di un festival la stessa
             * masterclass si ripete su più giorni, e quattro sessioni chiamate
             * tutte «Masterclass con i maestri» restano indistinguibili. La data
             * è ciò che le separa.
             */
            scopeStartAt: z.date().nullable(),
            role: DanceRoleSchema.nullable(),
            reservedFor: z.string().nullable(),
            limit: z.number().int(),
            consumed: z.number().int(),
            remaining: z.number().int(),
            limiting: z.boolean(),
        })
        .array(),
});

export const CommittedByTicketTypeSchema = availableSection({
    items: z
        .object({
            ticketTypeId: z.number().int(),
            name: z.unknown(),
            basePrice: z.number().int(),
            /** `null` = nessuna quota di titolo configurata, quindi nessun contatore. */
            limit: z.number().int().nullable(),
            committed: z.number().int().nullable(),
            remaining: z.number().int().nullable(),
        })
        .array(),
});

export const CommittedServicesSchema = availableSection({
    items: z
        .object({
            eventServiceId: z.number().int(),
            name: z.unknown(),
            price: z.number().int(),
            limit: z.number().int().nullable(),
            committed: z.number().int().nullable(),
            remaining: z.number().int().nullable(),
        })
        .array(),
});

export const CouplesSchema = availableSection({
    /** Coppie non sciolte con esattamente due iscrizioni attive di ruolo complementare. */
    complete: z.number().int(),
    /** Coppie non sciolte che non soddisfano ancora quella condizione. */
    incomplete: z.number().int(),
    dissolved: z.number().int(),
    total: z.number().int(),
});

export const RequirementsSchema = availableSection({
    configured: z
        .object({
            eventRequirementId: z.number().int(),
            label: z.unknown(),
            mandatory: z.boolean(),
            blocking: z.string(),
            verification: z.string(),
        })
        .array(),
});

export const RegistrationsTrendSchema = availableSection({
    granularity: z.literal("DAY"),
    points: z
        .object({
            date: z.string(),
            count: z.number().int(),
            cumulative: z.number().int(),
        })
        .array(),
});

/**
 * Presenze — **un asse distinto dalle quote** (`RB19`). Le quote governano
 * l'ammissione, questo contatore governa la sicurezza: sono due numeri che
 * misurano cose diverse e che il cruscotto non deve mai sommare.
 *
 * `openConflicts` è la coda di `/check-in/conflicts`: doppi ingressi rilevati in
 * sincronizzazione, **restituiti da risolvere e mai risolti in silenzio**
 * (`RF-CHK-6`). Un cruscotto che li nascondesse mostrerebbe un contatore
 * plausibile su un dato che nessuno ha ancora dirimito.
 */
export const AttendanceSchema = availableSection({
    totalEntries: z.number().int(),
    distinctTickets: z.number().int(),
    openConflicts: z.number().int(),
    bySession: z
        .object({
            sessionId: z.number().int(),
            name: z.unknown(),
            startAt: z.date(),
            entries: z.number().int(),
        })
        .array(),
});

/**
 * Requisiti mancanti — `RF-BKO-1`.
 *
 * «Mancante» è uno stato di `RequirementOutcome` per iscrizione
 * (`TO_PROVIDE` · `UNDER_REVIEW` · `REJECTED` · `EXPIRED`), **oppure l'assenza
 * dell'esito**: un requisito obbligatorio su cui nessuno ha dichiarato nulla
 * manca esattamente come uno rifiutato.
 *
 * `RB12` — di ogni requisito si riporta **il nome e il conteggio**, mai il
 * contenuto degli esiti.
 */
export const MissingRequirementsSchema = availableSection({
    registrationsWithMissing: z.number().int(),
    byRequirement: z
        .object({
            eventRequirementId: z.number().int(),
            label: z.unknown(),
            blocking: z.string(),
            mandatory: z.boolean(),
            missing: z.number().int(),
        })
        .array(),
});

/**
 * **Il venduto per titolo** — da non confondere con l'impegnato.
 *
 * `committedByTicketType` conta ciò che il motore di capienza ha sottratto alla
 * disponibilità: comprende le prenotazioni in corso, che alla scadenza tornano
 * indietro. Questa sezione conta ciò che è stato **saldato**. Le due grandezze
 * divergono per tutta la durata di una finestra di quindici minuti, e `RB21`
 * chiede che il cruscotto non le fonda mai in un numero solo.
 *
 * `servicesGross` sta a parte perché una riga d'ordine può riguardare un
 * servizio accessorio invece di un titolo: sommarlo ai titoli gonfierebbe il
 * venduto di cose che biglietti non sono.
 */
export const SoldByTicketTypeSchema = availableSection({
    items: z
        .object({
            ticketTypeId: z.number().int(),
            name: z.unknown(),
            basePrice: z.number().int(),
            /** Unità saldate. */
            sold: z.number().int(),
            /** Somma dei totali di riga, in centesimi (§3.1). */
            gross: z.number().int(),
        })
        .array(),
    /** Righe saldate che riguardano servizi accessori, non titoli. */
    servicesGross: z.number().int(),
});

/**
 * **Il denaro** — chi ha incassato che cosa.
 *
 * `subtotal` è ciò che spetta all'organizzatore, `presaleRights` ciò che la
 * piattaforma trattiene, `total` ciò che il compratore ha pagato: tre numeri
 * distinti che non vanno confusi, tanto meno quando il secondo è a zero perché
 * la tariffa non è ancora stata decisa.
 *
 * `cashed` è la somma dei pagamenti **riusciti** e può essere minore di `total`:
 * un ordine a importo zero chiuso con `confirm-free` è saldato senza che un solo
 * centesimo sia transitato. La differenza è informazione, non un errore.
 */
export const NetRevenueSchema = availableSection({
    paidOrders: z.number().int(),
    /** Ordini saldati a importo zero: iscritti veri, ricavo nullo. */
    zeroAmountOrders: z.number().int(),
    subtotal: z.number().int(),
    presaleRights: z.number().int(),
    total: z.number().int(),
    cashed: z.number().int(),
});

/**
 * **I saldi del botteghino** — `14` §8, `RF-SAL-16`.
 *
 * Tre numeri che rispondono alla sola domanda che l'organizzatore si fa la
 * mattina dell'evento: *quanti soldi mi aspetto alla porta, quanti ne ho già
 * presi, quanti mancano ancora*.
 *
 * ── Perché non stanno in `netRevenue` ───────────────────────────────────────
 * Perché non sono un incasso della piattaforma (`RB26`): quel denaro non passa
 * da Mirada, né l'acconto sul negozio né il saldo in contanti. Sommarlo agli
 * ordini saldati produrrebbe un totale che non corrisponde a nessun conto
 * corrente esistente — e sarebbe quello, non questo, il numero da spiegare al
 * commercialista.
 *
 * `expected` conta le sole iscrizioni **vive**: un residuo di chi ha annullato
 * si chiude con la vendita e smette di essere atteso.
 */
export const BalancesSchema = availableSection({
    /** Somma dei residui nati, in centesimi — ciò che è atteso al botteghino. */
    expected: z.number().int(),
    /** Quanto ne è già stato incassato, alla porta o in anticipo per bonifico. */
    collected: z.number().int(),
    /** `expected - collected`: quanto resta da incassare. */
    open: z.number().int(),
    /** Quante persone si presenteranno con qualcosa da versare. */
    peopleWithOpenBalance: z.number().int(),
    /** Righe di incasso in conflitto — il doppio incasso ancora da risolvere. */
    conflicts: z.number().int(),
});

export const EventDashboardSchema = z.object({
    eventId: z.number().int(),
    slug: z.string(),
    status: EventStatusSchema,
    generatedAt: z.date(),

    /**
     * `RB21` — il perimetro su cui il cruscotto è calcolato, dichiarato in
     * risposta e non lasciato dedurre.
     */
    perimeter: z.object({
        note: z.string(),
        missingEntities: z.string().array(),
    }),

    sections: z.object({
        registrationsByRole: RegistrationsByRoleSchema,
        capacity: CapacitySnapshotSchema,
        committedByTicketType: CommittedByTicketTypeSchema,
        committedServices: CommittedServicesSchema,
        couples: CouplesSchema,
        requirements: RequirementsSchema,
        registrationsTrend: RegistrationsTrendSchema,

        missingRequirements: MissingRequirementsSchema,
        attendance: AttendanceSchema,

        soldByTicketType: SoldByTicketTypeSchema,
        netRevenue: NetRevenueSchema,
        balances: BalancesSchema,
    }),
});
export type EventDashboardDTO = z.infer<typeof EventDashboardSchema>;
