import { Service } from "fastify-decorators";
import {
    CapacityQuota,
    DanceRole,
    DeclaredDanceRole,
    Prisma,
    QuotaReservedFor,
    QuotaScope,
    Registration,
    RegistrationChannel,
} from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { getPrismaClient } from "@utils/adapters/prisma";
import { domainError } from "@utils/helpers/domainError";
import { selectActiveTier } from "@utils/helpers/priceTier";
import { DomainErrorCode } from "@enums/DomainErrorCode";
import { CapacityQuotaRepository } from "@repositories/CapacityQuotaRepository";
import { QuotaConsumptionRepository } from "@repositories/QuotaConsumptionRepository";
import { RegistrationRepository } from "@repositories/RegistrationRepository";
import { EventRepository } from "@repositories/EventRepository";
import { SessionRepository } from "@repositories/SessionRepository";
import { TicketTypeRepository, TicketTypeWithSessions } from "@repositories/TicketTypeRepository";
import { EventServiceRepository } from "@repositories/EventServiceRepository";
import { AvailabilityBroadcastService } from "@services/AvailabilityBroadcastService";

// ─────────────────────────────────────────────────────────────────────────────
// Forme pubbliche del motore
// ─────────────────────────────────────────────────────────────────────────────

/** Una riga d'ordine dal punto di vista della capienza. */
export type CommitItem = {
    registrationId: number;
    /** Titolo acquistato. Nullo sugli accrediti senza titolo. */
    ticketTypeId?: number | null;
    /**
     * **Sovrapposizione fra titoli** (`RF-PAY-26`, §4.11) — gli **altri** titoli
     * che la stessa persona acquista nello stesso ordine.
     *
     * Esiste perché *una iscrizione per persona per evento* è un vincolo del
     * modello: chi compra un Full Pass e un Workshop ha **una** `Registration`,
     * e quindi **un solo** `CommitItem`. Se lo si spezzasse in due, l'unicità di
     * `QuotaConsumption(capacityQuotaId, registrationId)` respingerebbe la
     * seconda scrittura sulla quota di una sessione inclusa in entrambi i titoli
     * — l'ordine fallirebbe per una condizione che è invece **normale e da non
     * bloccare**.
     *
     * Tenendoli su una riga sola, la deduplica per id di
     * `resolveApplicableQuotas` fa già la cosa giusta: *la quota di quella
     * sessione non viene consumata due volte per la stessa persona*, **senza una
     * riga di codice dedicata alle sovrapposizioni**.
     */
    ticketTypeIds?: number[];
    /** Servizi accessori acquistati con questa iscrizione. */
    serviceIds?: number[];
    /** Normalmente 1 (`05` §2.2). */
    quantity?: number;
    /**
     * Ruolo imposto dal chiamante, che salta sia `declaredRole` sia la
     * risoluzione del flessibile. Lo usa **solo** la riassegnazione di ruolo
     * (trasferimento con ruolo diverso, riequilibrio manuale di un flessibile).
     */
    roleOverride?: DanceRole | null;
};

export type CommittedRegistration = {
    registrationId: number;
    assignedRole: DanceRole | null;
    quotaIds: number[];
    quantity: number;
};

export type CommitOutcome = {
    eventId: number;
    committed: CommittedRegistration[];
    /** Iscrizioni saltate perché già impegnate — idempotenza (§4.8 nota 3). */
    alreadyCommitted: number[];
};

/**
 * Superamento di una quota registrato **senza rifiutare** — `RB20`. Nomina la
 * quota, il suo limite e di quanto è stata superata: l'organizzatore deve vedere
 * *di quanto* ha ecceduto e su cosa, non un generico «attenzione».
 */
export type CapacityWarning = {
    quotaId: number;
    scope: QuotaScope;
    scopeId: number | null;
    scopeLabel: string;
    role: DanceRole | null;
    limit: number;
    consumed: number;
    exceededBy: number;
};

export type UnblockedCommitOutcome = CommitOutcome & { warnings: CapacityWarning[] };

export type ReleaseOutcome = {
    registrationIds: number[];
    /** Quote effettivamente decrementate, in ordine di id crescente. */
    releasedQuotaIds: number[];
    releasedQuantity: number;
    deletedConsumptions: number;
};

export type TicketTypeAvailability = {
    id: number;
    remaining: number | null;
    soldOut: boolean;
    roleOnHold: boolean;
    activeTier: {
        price: number;
        expiresAt: Date | null;
        remainingAtThisPrice: number | null;
    };
};

export type EventAvailability = {
    eventId: number;
    ticketTypes: TicketTypeAvailability[];
    /** Residuo per ruolo. `null` quando la quota di ruolo non è configurata. */
    roles: { leader: number | null; follower: number | null };
    /** Blocco temporaneo per sbilancio — si può sbloccare (`ROLE_ON_HOLD`). */
    rolesOnHold: { leader: boolean; follower: boolean };
    /** `consumed(LEADER) − consumed(FOLLOWER)`, o `null` senza quote di ruolo. */
    imbalance: number | null;
    imbalanceTolerance: number | null;
};

/** Esito della verifica delle invarianti del `05` §12 su un evento. */
export type InvariantReport = {
    eventId: number;
    ok: boolean;
    violations: { invariant: "I2" | "I3" | "I4" | "I7"; detail: string }[];
};

type QuotaRequest = { quota: CapacityQuota; quantity: number };

type ResolvedRegistration = {
    registration: Registration;
    role: DanceRole | null;
    quantity: number;
    quotas: CapacityQuota[];
};

/**
 * # Il motore di capienza
 *
 * backend-brief §4.8 · allegato tecnico-funzionale `05-modello-capienza.md`.
 *
 * È il componente più delicato del prodotto: sbaglia in silenzio, sbaglia sotto
 * carico, e **ogni errore si traduce in una persona che ha pagato e non entra**.
 *
 * ── Le quattro cose che non sono dettagli ────────────────────────────────────
 *
 * 1. **Aggiornamento condizionato.** `consumed = consumed + q WHERE consumed + q
 *    <= limit + overbookAllowance`, e si guarda il numero di righe toccate: `0`
 *    significa esaurito. Verifica e impegno sono **una sola operazione**.
 *    Leggere prima e scrivere dopo è la modalità con cui si vendono posti
 *    inesistenti. La lettura preliminare che questo servizio compie **non**
 *    sostituisce l'aggiornamento condizionato: serve solo a **classificare** il
 *    rifiuto (`SOLD_OUT` contro `ROLE_ON_HOLD` contro `PARTIAL_AVAILABILITY`),
 *    che il §3.3 impone di distinguere. L'autorità resta della `UPDATE`.
 * 2. **Quote toccate in ordine di id crescente.** È l'unica difesa contro i
 *    deadlock quando due ordini toccano lo stesso insieme in ordine diverso.
 * 3. **Unicità su `QuotaConsumption(capacityQuotaId, registrationId)`.** È ciò
 *    che rende l'impegno idempotente sulla doppia notifica del prestatore.
 * 4. **Cancello di tolleranza valutato sull'ordine intero**, mai riga per riga.
 *    Ne discende la proprietà da preservare: *una coppia aggiunge un'unità per
 *    parte, non altera lo sbilancio e supera quindi sempre il cancello*. In
 *    questo file **non esiste una sola riga di codice dedicata alle coppie**: se
 *    servisse, sarebbe il sintomo di un errore di modello.
 *
 * ── Due regole che governano tutto il resto ──────────────────────────────────
 *
 * - **Assenza di quota significa assenza di vincolo**: un evento senza quote
 *   configurate vende senza limite, e non è un caso d'errore.
 * - **Il rilascio non è mai un decremento «a occhio»**: si leggono i
 *   `QuotaConsumption` dell'iscrizione, si decrementano *esattamente quei*
 *   contatori, si cancellano le righe.
 *
 * ── Che cosa NON fa ──────────────────────────────────────────────────────────
 *
 * Il **check-in non consuma capienza** (`RB19`): le quote governano
 * l'ammissione, il contatore presenze governa la sicurezza. Sono due assi
 * distinti e questo servizio non conosce il check-in.
 */
@Service()
export class CapacityEngineService {
    /**
     * Con cinquanta acquisti simultanei le transazioni si accodano sul pool: i
     * valori di serie di Prisma (`maxWait` 2 s) le farebbero fallire per attesa,
     * non per esaurimento — un rifiuto che mentirebbe all'utente.
     */
    private static readonly TRANSACTION_OPTIONS = { maxWait: 20_000, timeout: 30_000 };

    constructor(
        private readonly capacityQuotaRepository: CapacityQuotaRepository,
        private readonly quotaConsumptionRepository: QuotaConsumptionRepository,
        private readonly registrationRepository: RegistrationRepository,
        private readonly eventRepository: EventRepository,
        private readonly sessionRepository: SessionRepository,
        private readonly ticketTypeRepository: TicketTypeRepository,
        private readonly eventServiceRepository: EventServiceRepository,
        private readonly availabilityBroadcastService: AvailabilityBroadcastService,
    ) {}

    // ═════════════════════════════════════════════════════════════════════════
    // Risoluzione delle quote applicabili (§4.8 · `05` §4)
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * ```
     * Q ← ∅
     * Q ← Q ∪ quota(EVENT, null, role: null)          # capienza della sala, sempre
     * Q ← Q ∪ quota(EVENT, null, role: role)          # equilibrio dei ruoli
     * se channel ≠ COMPLIMENTARY
     *     Q ← Q ∪ quota(TICKET_TYPE, ticketType.id, role: null)
     * altrimenti
     *     Q ← Q ∪ quota(EVENT, null, reservedFor: COMPLIMENTARY)
     * per ogni sessione inclusa nel titolo
     *     Q ← Q ∪ quota(SESSION, sessione.id, role: null)
     *     Q ← Q ∪ quota(SESSION, sessione.id, role: role)
     * per ogni servizio acquistato
     *     Q ← Q ∪ quota(SERVICE, servizio.id, role: null)
     * ritorna Q privo dei riferimenti nulli
     * ```
     *
     * **Gli accrediti** consumano la capienza della sala e le quote di ruolo — un
     * ospite non pagante occupa comunque spazio in pista — ma **non** le quote di
     * titolo, che sono inventario commerciale. Se l'organizzatore vuole 110 leader
     * paganti più 5 accrediti leader configura la quota leader a 115: è
     * configurazione, non un caso particolare del codice.
     *
     * Le **vendite su canali esterni** consumano il proprio contingente riservato
     * e comunque la capienza della sala (`05` §10): senza, i contatori
     * descriverebbero metà della realtà e la disponibilità pubblica sarebbe
     * sistematicamente sovrastimata.
     *
     * Funzione **pura** sull'insieme delle quote dell'evento già caricato: il
     * chiamante fa una query sola, anche per un ordine da dieci righe.
     */
    public resolveApplicableQuotas(
        quotas: CapacityQuota[],
        params: {
            channel: RegistrationChannel;
            role: DanceRole | null;
            ticketTypeId?: number | null;
            /** Più titoli della stessa persona nello stesso ordine (`RF-PAY-26`). */
            ticketTypeIds?: number[];
            sessionIds?: number[];
            serviceIds?: number[];
        },
    ): CapacityQuota[] {
        const find = (
            scope: QuotaScope,
            scopeId: number | null,
            role: DanceRole | null,
            reservedFor: QuotaReservedFor | null,
        ) => quotas.find(q =>
            q.scope === scope
            && q.scopeId === scopeId
            && q.role === role
            && q.reservedFor === reservedFor,
        );

        const applicable: (CapacityQuota | undefined)[] = [];

        // 1. Livello evento: sempre.
        applicable.push(find(QuotaScope.EVENT, null, null, null));
        if (params.role) {
            applicable.push(find(QuotaScope.EVENT, null, params.role, null));
        }

        // 2. Livello titolo: solo se la vendita è commerciale.
        if (params.channel === RegistrationChannel.COMPLIMENTARY) {
            applicable.push(find(QuotaScope.EVENT, null, null, QuotaReservedFor.COMPLIMENTARY));
        } else {
            // Ogni titolo acquistato dalla stessa persona porta la propria quota
            // di titolo: sono inventari commerciali distinti e vanno consumati
            // entrambi. Sono invece le quote di SESSIONE, condivise fra due
            // titoli che includono la stessa serata, che non vanno consumate due
            // volte — e a quello pensa la deduplica per id in coda al metodo.
            const ticketTypeIds = [
                ...(params.ticketTypeId ? [params.ticketTypeId] : []),
                ...(params.ticketTypeIds ?? []),
            ];
            for (const ticketTypeId of new Set(ticketTypeIds)) {
                applicable.push(find(QuotaScope.TICKET_TYPE, ticketTypeId, null, null));
            }
            if (params.channel === RegistrationChannel.EXTERNAL_CHANNEL) {
                applicable.push(find(QuotaScope.EVENT, null, null, QuotaReservedFor.EXTERNAL_CHANNEL));
            }
        }

        // 3. Livello sessione: una per ogni sessione inclusa nel titolo.
        for (const sessionId of params.sessionIds ?? []) {
            applicable.push(find(QuotaScope.SESSION, sessionId, null, null));
            if (params.role) {
                applicable.push(find(QuotaScope.SESSION, sessionId, params.role, null));
            }
        }

        // 4. Livello servizio: uno per ogni accessorio acquistato.
        for (const serviceId of params.serviceIds ?? []) {
            applicable.push(find(QuotaScope.SERVICE, serviceId, null, null));
        }

        // «Ritorna Q privo dei riferimenti nulli»: le quote non configurate
        // semplicemente non esistono, e ASSENZA DI QUOTA È ASSENZA DI VINCOLO.
        // La deduplica per id è anche ciò che impedisce di consumare due volte la
        // quota di una sessione inclusa in due titoli della stessa persona
        // (`RF-PAY-26`) — senza codice dedicato.
        const byId = new Map<number, CapacityQuota>();
        for (const quota of applicable) {
            if (quota) {
                byId.set(quota.id, quota);
            }
        }

        // ORDINE DI ID CRESCENTE: unica difesa contro i deadlock (§4.8 nota 1).
        return [...byId.values()].sort((a, b) => a.id - b.id);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Ruolo flessibile (§4.8 · `05` §7)
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * ```
     * se le quote di ruolo non esistono → null
     * residuoL ← limit(LEADER) − consumed(LEADER) ; residuoF ← idem FOLLOWER
     * se residuoL ≠ residuoF     → ruolo con residuo maggiore
     * se consumedL ≠ consumedF   → ruolo con consumato minore
     * → LEADER                                    # convenzione, per determinismo nei test
     * ```
     *
     * `pending` porta i ruoli **già decisi nello stesso ordine**: due flessibili
     * sullo stesso ordine non finiscono entrambi nello stesso ruolo, e la
     * valutazione resta quella dell'ordine intero prescritta dal §5 di `05`.
     *
     * L'assegnazione avviene **alla conferma del pagamento**, non nel carrello:
     * lo stato può cambiare nel frattempo.
     */
    public resolveFlexibleRole(
        quotas: CapacityQuota[],
        pending: { leader: number; follower: number } = { leader: 0, follower: 0 },
    ): DanceRole | null {
        const leaderQuota = this.findRoleQuota(quotas, DanceRole.LEADER);
        const followerQuota = this.findRoleQuota(quotas, DanceRole.FOLLOWER);

        if (!leaderQuota || !followerQuota) {
            return null;
        }

        const consumedL = leaderQuota.consumed + pending.leader;
        const consumedF = followerQuota.consumed + pending.follower;
        const residualL = leaderQuota.limit - consumedL;
        const residualF = followerQuota.limit - consumedF;

        if (residualL !== residualF) {
            return residualL > residualF ? DanceRole.LEADER : DanceRole.FOLLOWER;
        }
        if (consumedL !== consumedF) {
            return consumedL < consumedF ? DanceRole.LEADER : DanceRole.FOLLOWER;
        }
        return DanceRole.LEADER;
    }

    /** Come sopra, leggendo lo stato corrente dell'evento. */
    public async resolveFlexible(eventId: number, tx?: Prisma.TransactionClient): Promise<DanceRole | null> {
        const quotas = await this.capacityQuotaRepository.findByEvent(eventId, tx);
        return this.resolveFlexibleRole(quotas);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Cancello di tolleranza (§4.8 · `05` §6)
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * ```
     * t ← imbalanceTolerance dell'ambito EVENT ; se nullo → passa
     * L ← consumed(EVENT, LEADER)   + leader richiesti nell'ordine
     * F ← consumed(EVENT, FOLLOWER) + follower richiesti nell'ordine
     * se |L − F| > t → RIFIUTO(ROLE_ON_HOLD, ruolo, ...)
     * ```
     *
     * La tolleranza **non estende il limite**: restringe dinamicamente l'accesso
     * al ruolo sovrarappresentato. Traduce l'intenzione reale dell'organizzatore
     * di marathon, che non è «massimo 60 leader» ma «non voglio ritrovarmi con
     * venti leader in più dei follower».
     *
     * La valutazione è **sull'ordine intero**: è ciò che consente a una coppia di
     * passare anche quando il singolo verrebbe fermato. La coppia aggiunge
     * un'unità per parte, lo sbilancio resta invariato, il cancello è superato —
     * senza una riga di codice che sappia cosa sia una coppia.
     */
    public evaluateToleranceGate(
        quotas: CapacityQuota[],
        requested: { leader: number; follower: number },
    ): { passes: true } | { passes: false; role: DanceRole; imbalance: number; tolerance: number } {
        const leaderQuota = this.findRoleQuota(quotas, DanceRole.LEADER);
        const followerQuota = this.findRoleQuota(quotas, DanceRole.FOLLOWER);

        if (!leaderQuota || !followerQuota) {
            return { passes: true };
        }

        const tolerance = leaderQuota.imbalanceTolerance ?? followerQuota.imbalanceTolerance;
        if (tolerance === null || tolerance === undefined) {
            return { passes: true };
        }

        const projectedLeaders = leaderQuota.consumed + requested.leader;
        const projectedFollowers = followerQuota.consumed + requested.follower;
        const imbalance = projectedLeaders - projectedFollowers;

        if (Math.abs(imbalance) <= tolerance) {
            return { passes: true };
        }

        return {
            passes: false,
            role: imbalance > 0 ? DanceRole.LEADER : DanceRole.FOLLOWER,
            imbalance,
            tolerance,
        };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // L'impegno atomico (§4.8 · `05` §5)
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Impegna la capienza per un ordine intero.
     *
     * `tx` va passato quando l'impegno fa parte di una transazione più grande —
     * è il caso di `reserve` del §4.11, dove ordine, prezzo bloccato, iscrizioni
     * e capienza valgono tutti insieme o nessuno.
     *
     * Il segnale WebSocket è registrato **in coda**, e
     * `AvailabilityBroadcastService.notify` non fa I/O: il frame parte ~1,5 s più
     * tardi, fuori da qualunque transazione. Un Redis lento non rallenta una
     * vendita (§3.9).
     */
    public async commit(eventId: number, items: CommitItem[], tx?: Prisma.TransactionClient): Promise<CommitOutcome> {
        if (tx) {
            return this.commitInTransaction(eventId, items, tx);
        }

        const outcome = await getPrismaClient().$transaction(
            prisma => this.commitInTransaction(eventId, items, prisma),
            CapacityEngineService.TRANSACTION_OPTIONS,
        );

        await this.signalAvailabilityChange(eventId);
        return outcome;
    }

    private async commitInTransaction(
        eventId: number,
        items: CommitItem[],
        tx: Prisma.TransactionClient,
    ): Promise<CommitOutcome> {
        if (!items.length) {
            return { eventId, committed: [], alreadyCommitted: [] };
        }

        // ── Idempotenza (§4.8 nota 3) ────────────────────────────────────────
        // Un'iscrizione che risulta già impegnata viene saltata: alla seconda
        // notifica del prestatore i contatori NON si muovono. La chiave unica
        // `(capacityQuotaId, registrationId)` resta comunque la garanzia contro
        // due impegni davvero simultanei — lì la seconda transazione fallisce
        // sull'inserimento e annulla anche il proprio incremento.
        const registrationIds = items.map(item => item.registrationId);
        const existing = await this.quotaConsumptionRepository.findByRegistrations(registrationIds, tx);
        const alreadyCommitted = new Set(existing.map(row => row.registrationId));

        const pendingItems = items.filter(item => !alreadyCommitted.has(item.registrationId));
        if (!pendingItems.length) {
            Log.info(
                `[CapacityEngine Service]: commit on event (id ${eventId}) is a no-op — `
                + `all ${items.length} registration(s) were already committed (idempotent replay)`,
            );
            return { eventId, committed: [], alreadyCommitted: [...alreadyCommitted] };
        }

        // ── A. Risoluzione: ruoli e quote applicabili ────────────────────────
        const quotas = await this.capacityQuotaRepository.findByEvent(eventId, tx);
        const resolved = await this.resolveItems(eventId, pendingItems, quotas, tx);

        // ── B. Aggregazione sull'ORDINE INTERO ───────────────────────────────
        const requests = this.aggregate(resolved);
        const requestedRoles = this.countRequestedRoles(resolved);

        // ── Classificazione preliminare del rifiuto ──────────────────────────
        // Non sostituisce l'aggiornamento condizionato: distingue soltanto
        // `SOLD_OUT` da `ROLE_ON_HOLD` da `PARTIAL_AVAILABILITY`, che il §3.3
        // impone di distinguere perché hanno significati opposti. Il caso T7
        // dipende da questo ordine: con 60 leader su 60 e tolleranza 5 il rifiuto
        // è ESAURITO, situazione definitiva, non un blocco temporaneo.
        await this.assertNoSaturatedQuota(eventId, requests, tx);

        // ── C. Cancello di tolleranza, sull'ordine intero ────────────────────
        const gate = this.evaluateToleranceGate(quotas, requestedRoles);
        if (!gate.passes) {
            Log.warn(
                `[CapacityEngine Service]: commit refused on event (id ${eventId}) — ROLE_ON_HOLD for ${gate.role}: `
                + `projected imbalance ${gate.imbalance} exceeds tolerance ${gate.tolerance}`,
            );
            throw domainError(
                DomainErrorCode.ROLE_ON_HOLD,
                gate.role === DanceRole.LEADER
                    ? "Iscrizioni leader momentaneamente sospese, in attesa di follower. Puoi iscriverti subito in coppia."
                    : "Iscrizioni follower momentaneamente sospese, in attesa di leader. Puoi iscriverti subito in coppia.",
                409,
                {
                    scope: QuotaScope.EVENT,
                    scopeId: null,
                    scopeLabel: "Equilibrio dei ruoli",
                    role: gate.role,
                    imbalance: gate.imbalance,
                    tolerance: gate.tolerance,
                },
            );
        }

        // ── D. Impegno atomico, quote ORDINATE PER ID CRESCENTE ──────────────
        for (const { quota, quantity } of requests) {
            if (!quota.limiting) {
                // La quota conta e NON blocca (`05` §3): il contatore può superare
                // il limite ed è il cruscotto a segnalarlo (caso T11).
                await this.capacityQuotaRepository.incrementUnconditionally(quota.id, quantity, tx);
                Log.debug(
                    `[CapacityEngine Service]: non-limiting quota (id ${quota.id}, ${quota.scope}) counted +${quantity} `
                    + `on event (id ${eventId}) without blocking`,
                );
            } else {
                const rows = await this.capacityQuotaRepository.lockAndIncrement(quota.id, quantity, tx);
                if (rows === 0) {
                    // ZERO RIGHE TOCCATE SIGNIFICA ESAURITO. La transazione viene
                    // annullata: nessun consumo parziale, mai (caso T3).
                    Log.warn(
                        `[CapacityEngine Service]: commit refused on event (id ${eventId}) — SOLD_OUT on quota `
                        + `(id ${quota.id}, ${quota.scope}${quota.role ? `/${quota.role}` : ""}) for ${quantity} unit(s)`,
                    );
                    throw await this.soldOutError(quota, tx);
                }
            }

            // Il registro di ciò che ogni iscrizione occupa: è ciò che rende il
            // rilascio ESATTO anziché ricostruito (`05` §2.2 e §8).
            for (const item of resolved) {
                if (item.quotas.some(q => q.id === quota.id)) {
                    await this.quotaConsumptionRepository.save(
                        {
                            capacityQuotaId: quota.id,
                            registrationId: item.registration.id,
                            quantity: item.quantity,
                        },
                        tx,
                    );
                }
            }
        }

        // Il ruolo assegnato è un campo calcolato dal server (§5): si scrive qui,
        // nella stessa transazione dell'impegno, o l'invariante I4 non regge.
        for (const item of resolved) {
            if (item.role !== item.registration.assignedRole) {
                await this.registrationRepository.update(
                    { id: item.registration.id },
                    { assignedRole: item.role },
                    undefined,
                    undefined,
                    tx,
                );
            }
        }

        const committed: CommittedRegistration[] = resolved.map(item => ({
            registrationId: item.registration.id,
            assignedRole: item.role,
            quotaIds: item.quotas.map(q => q.id),
            quantity: item.quantity,
        }));

        Log.info(
            `[CapacityEngine Service]: committed ${committed.length} registration(s) on event (id ${eventId}) `
            + `across ${requests.length} quota(s)`
            + (alreadyCommitted.size ? ` — ${alreadyCommitted.size} skipped as already committed` : ""),
        );

        return { eventId, committed, alreadyCommitted: [...alreadyCommitted] };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Rilascio (§4.8 · `05` §8)
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * **Il rilascio non è mai un decremento «a occhio».** Si leggono i
     * `QuotaConsumption` dell'iscrizione, si decrementano *esattamente quei*
     * contatori, si cancellano le righe. È l'unico modo per non accumulare deriva
     * fra contatori e realtà su un evento che vive mesi fra vendite, rimborsi e
     * trasferimenti.
     *
     * Ne discendono direttamente, senza codice dedicato:
     *  - il rimborso di **un solo componente della coppia** libera i soli consumi
     *    di quell'iscrizione, l'altra resta intatta;
     *  - lo **scioglimento della coppia** non muove nulla, perché non tocca i
     *    consumi;
     *  - il **trasferimento a parità di ruolo** non muove nulla, perché le quote
     *    applicabili non cambiano.
     */
    public async release(registrationId: number, tx?: Prisma.TransactionClient): Promise<ReleaseOutcome> {
        return this.releaseRegistrations([registrationId], tx);
    }

    public async releaseRegistrations(
        registrationIds: number[],
        tx?: Prisma.TransactionClient,
    ): Promise<ReleaseOutcome> {
        if (!registrationIds.length) {
            return { registrationIds: [], releasedQuotaIds: [], releasedQuantity: 0, deletedConsumptions: 0 };
        }

        const run = async (prisma: Prisma.TransactionClient) => {
            const consumptions = await this.quotaConsumptionRepository.findByRegistrations(registrationIds, prisma);
            return this.releaseConsumptions(consumptions, registrationIds, prisma);
        };

        if (tx) {
            return run(tx);
        }

        const outcome = await getPrismaClient().$transaction(run, CapacityEngineService.TRANSACTION_OPTIONS);
        await this.signalAvailabilityChangeForRegistrations(registrationIds);
        return outcome;
    }

    /**
     * `EventService.cancel` — annullamento dell'evento: **rilascio di tutto**
     * (§4.5). Anche qui riga per riga: i contatori tornano a zero perché ogni
     * consumo registrato viene restituito, non perché li si azzera d'imperio.
     */
    public async releaseEvent(eventId: number, tx?: Prisma.TransactionClient): Promise<ReleaseOutcome> {
        const run = async (prisma: Prisma.TransactionClient) => {
            const quotas = await this.capacityQuotaRepository.findByEvent(eventId, prisma);
            const consumptions = await this.quotaConsumptionRepository.findByQuotas(quotas.map(q => q.id), prisma);
            const registrationIds = [...new Set(consumptions.map(c => c.registrationId))];
            return this.releaseConsumptions(consumptions, registrationIds, prisma);
        };

        if (tx) {
            return run(tx);
        }

        const outcome = await getPrismaClient().$transaction(run, CapacityEngineService.TRANSACTION_OPTIONS);
        await this.signalAvailabilityChange(eventId);
        return outcome;
    }

    /**
     * `POST /api/sessions/:id/cancel` — annullamento di **una sola sessione** su
     * un evento che si svolge regolarmente (`RF-EVT-35`): si rilasciano le quote
     * di quella sessione e null'altro. Le iscrizioni restano, i biglietti restano
     * validi per il resto dell'evento.
     */
    public async releaseSession(
        eventId: number,
        sessionId: number,
        tx?: Prisma.TransactionClient,
    ): Promise<ReleaseOutcome> {
        const run = async (prisma: Prisma.TransactionClient) => {
            const quotas = await this.capacityQuotaRepository.findByEvent(eventId, prisma);
            const sessionQuotaIds = quotas
                .filter(q => q.scope === QuotaScope.SESSION && q.scopeId === sessionId)
                .map(q => q.id);
            const consumptions = await this.quotaConsumptionRepository.findByQuotas(sessionQuotaIds, prisma);
            const registrationIds = [...new Set(consumptions.map(c => c.registrationId))];
            return this.releaseConsumptions(consumptions, registrationIds, prisma);
        };

        if (tx) {
            return run(tx);
        }

        const outcome = await getPrismaClient().$transaction(run, CapacityEngineService.TRANSACTION_OPTIONS);
        await this.signalAvailabilityChange(eventId);
        return outcome;
    }

    /**
     * Riassegnazione di ruolo — **rilascio del vecchio e impegno del nuovo nella
     * stessa transazione**: se il nuovo ruolo è saturo l'operazione è rifiutata e
     * **nulla cambia** (`05` §8, caso T14). È la strada del trasferimento di
     * biglietto con ruolo diverso e del riequilibrio manuale di un flessibile.
     *
     * A parità di ruolo non si muove nulla: le quote applicabili sono le stesse,
     * e il metodo esce senza toccare un contatore.
     */
    public async reassignRole(
        registrationId: number,
        newRole: DanceRole,
        context: { ticketTypeId?: number | null; serviceIds?: number[]; quantity?: number } = {},
        tx?: Prisma.TransactionClient,
    ): Promise<CommitOutcome> {
        const registration = await this.registrationRepository.findOne({ id: registrationId, deleted: false }, undefined, tx);
        if (!registration) {
            Log.warn(`[CapacityEngine Service]: role reassignment refused — registration (id ${registrationId}) not found`);
            throw new httpErrors.NotFound("Iscrizione non trovata.");
        }

        if (registration.assignedRole === newRole) {
            Log.info(
                `[CapacityEngine Service]: role reassignment on registration (id ${registrationId}) is a no-op — `
                + `already ${newRole}, no counter moves`,
            );
            return { eventId: registration.eventId, committed: [], alreadyCommitted: [registrationId] };
        }

        const run = async (prisma: Prisma.TransactionClient) => {
            Log.info(
                `[CapacityEngine Service]: reassigning registration (id ${registrationId}) on event `
                + `(id ${registration.eventId}) from ${registration.assignedRole ?? "none"} to ${newRole}`,
            );
            await this.releaseRegistrations([registrationId], prisma);
            return this.commitInTransaction(
                registration.eventId,
                [{ registrationId, ...context, roleOverride: newRole }],
                prisma,
            );
        };

        if (tx) {
            return run(tx);
        }

        const outcome = await getPrismaClient().$transaction(run, CapacityEngineService.TRANSACTION_OPTIONS);
        await this.signalAvailabilityChange(registration.eventId);
        return outcome;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Impegno NON bloccante — emissione manuale di pass (`RB20`, `RF-TCK-14`)
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Registra il consumo **senza mai rifiutare**, e restituisce gli avvisi.
     *
     * È l'unica strada dell'emissione manuale di pass, e la differenza con
     * `commit` non è una scorciatoia: è la regola `RB20`. *L'emissione manuale non
     * è mai bloccata dalle quote: si registra il consumo, si restituisce un avviso
     * se si supera la capienza della sala, e si procede.* La responsabilità della
     * sala è dell'organizzatore, che sta emettendo un accredito conoscendo la
     * propria porta; un blocco qui trasformerebbe uno strumento di servizio in un
     * ostacolo la sera dell'evento.
     *
     * Ciò che **non** cambia rispetto a `commit`:
     *  - le quote applicabili sono le stesse, risolte con lo stesso algoritmo;
     *  - i `QuotaConsumption` sono scritti comunque, perché il **rilascio deve
     *    restare esatto** anche per un pass revocato;
     *  - le quote sono toccate in **ordine di id crescente**, che è la difesa
     *    contro i deadlock e non dipende dal fatto che l'operazione blocchi o no.
     *
     * Ciò che cambia: nessun cancello di tolleranza, nessuna verifica preliminare
     * di saturazione, e l'incremento è **incondizionato**. Il superamento diventa
     * un avviso che nomina la quota, il suo limite e di quanto è stata superata.
     */
    public async commitWithoutBlocking(
        eventId: number,
        items: CommitItem[],
        tx?: Prisma.TransactionClient,
    ): Promise<UnblockedCommitOutcome> {
        if (tx) {
            return this.commitWithoutBlockingInTransaction(eventId, items, tx);
        }

        const outcome = await getPrismaClient().$transaction(
            prisma => this.commitWithoutBlockingInTransaction(eventId, items, prisma),
            CapacityEngineService.TRANSACTION_OPTIONS,
        );

        await this.signalAvailabilityChange(eventId);
        return outcome;
    }

    private async commitWithoutBlockingInTransaction(
        eventId: number,
        items: CommitItem[],
        tx: Prisma.TransactionClient,
    ): Promise<UnblockedCommitOutcome> {
        if (!items.length) {
            return { eventId, committed: [], alreadyCommitted: [], warnings: [] };
        }

        const registrationIds = items.map(item => item.registrationId);
        const existing = await this.quotaConsumptionRepository.findByRegistrations(registrationIds, tx);
        const alreadyCommitted = new Set(existing.map(row => row.registrationId));
        const pendingItems = items.filter(item => !alreadyCommitted.has(item.registrationId));

        if (!pendingItems.length) {
            Log.info(
                `[CapacityEngine Service]: unblocked commit on event (id ${eventId}) is a no-op — `
                + `all ${items.length} registration(s) were already committed`,
            );
            return { eventId, committed: [], alreadyCommitted: [...alreadyCommitted], warnings: [] };
        }

        const quotas = await this.capacityQuotaRepository.findByEvent(eventId, tx);
        const resolved = await this.resolveItems(eventId, pendingItems, quotas, tx);
        const requests = this.aggregate(resolved);

        const warnings: CapacityWarning[] = [];

        for (const { quota, quantity } of requests) {
            await this.capacityQuotaRepository.incrementUnconditionally(quota.id, quantity, tx);

            const projected = quota.consumed + quantity;
            const ceiling = quota.limit + quota.overbookAllowance;
            if (quota.limiting && projected > ceiling) {
                const label = await this.describeQuota(quota, tx);
                warnings.push({
                    quotaId: quota.id,
                    scope: quota.scope,
                    scopeId: quota.scopeId,
                    scopeLabel: label,
                    role: quota.role,
                    limit: quota.limit,
                    consumed: projected,
                    exceededBy: projected - ceiling,
                });
                Log.warn(
                    `[CapacityEngine Service]: unblocked commit EXCEEDED quota (id ${quota.id}, ${quota.scope}`
                    + `${quota.role ? `/${quota.role}` : ""}) on event (id ${eventId}) — ${projected} of ${ceiling} `
                    + `(RB20: the issuance proceeds, the organizer is warned)`,
                );
            }

            for (const item of resolved) {
                if (item.quotas.some(q => q.id === quota.id)) {
                    await this.quotaConsumptionRepository.save(
                        {
                            capacityQuotaId: quota.id,
                            registrationId: item.registration.id,
                            quantity: item.quantity,
                        },
                        tx,
                    );
                }
            }
        }

        for (const item of resolved) {
            if (item.role !== item.registration.assignedRole) {
                await this.registrationRepository.update(
                    { id: item.registration.id },
                    { assignedRole: item.role },
                    undefined,
                    undefined,
                    tx,
                );
            }
        }

        const committed: CommittedRegistration[] = resolved.map(item => ({
            registrationId: item.registration.id,
            assignedRole: item.role,
            quotaIds: item.quotas.map(q => q.id),
            quantity: item.quantity,
        }));

        Log.info(
            `[CapacityEngine Service]: unblocked commit registered ${committed.length} registration(s) on event `
            + `(id ${eventId}) across ${requests.length} quota(s) — ${warnings.length} warning(s), nothing refused`,
        );

        return { eventId, committed, alreadyCommitted: [...alreadyCommitted], warnings };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Disponibilità pubblica (§3.7 · `05` §10)
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * `POST /api/public/events/:id/availability` — **la sorgente del polling a
     * 10–15 s** del pubblico anonimo, che non ha WebSocket (§7 D-H). È
     * l'endpoint più interrogato del sistema in apertura vendite, e costa **tre
     * query**: evento, quote, titoli con sessioni e scaglioni.
     *
     * - `remaining` è calcolato sulla **quota più stretta** fra quelle applicabili,
     *   ed è esposto solo per le quote `publiclyVisible` (`05` §10). `null`
     *   significa nessun vincolo configurato, non zero.
     * - `soldOut` guarda invece **tutte** le quote limitanti, anche quelle non
     *   pubbliche: l'esaurito è un fatto, non un indicatore, e nascondere un
     *   numero non può trasformarsi in un biglietto vendibile che non esiste.
     * - Le quote riservate (`COMPLIMENTARY`, `EXTERNAL_CHANNEL`) sono **sottratte
     *   alla vendita online e non compaiono nella disponibilità pubblica**
     *   (`05` §2.1): non entrano fra le applicabili del canale `ONLINE_SALE`.
     */
    public async availability(eventId: number, role: DanceRole | null = null): Promise<EventAvailability> {
        const event = await this.eventRepository.findOne({ id: eventId, deleted: false });
        if (!event) {
            Log.warn(`[CapacityEngine Service]: availability requested for unknown event (id ${eventId})`);
            throw new httpErrors.NotFound("Evento non trovato.");
        }

        const quotas = await this.capacityQuotaRepository.findByEvent(eventId);
        const ticketTypes = await this.ticketTypeRepository.findWithSessionsAndTiersByEvent(eventId, true);

        const leaderQuota = this.findRoleQuota(quotas, DanceRole.LEADER);
        const followerQuota = this.findRoleQuota(quotas, DanceRole.FOLLOWER);

        const rolesOnHold = {
            leader: !this.evaluateToleranceGate(quotas, { leader: 1, follower: 0 }).passes,
            follower: !this.evaluateToleranceGate(quotas, { leader: 0, follower: 1 }).passes,
        };

        const now = new Date();
        const availabilities: TicketTypeAvailability[] = ticketTypes.map(ticketType => {
            const applicable = this.resolveApplicableQuotas(quotas, {
                channel: RegistrationChannel.ONLINE_SALE,
                role: role ?? (ticketType.roleConstraint ?? null),
                ticketTypeId: ticketType.id,
                sessionIds: ticketType.sessions.map(link => link.sessionId),
            });

            const limiting = applicable.filter(q => q.limiting);
            const visible = limiting.filter(q => q.publiclyVisible);

            const remaining = visible.length
                ? Math.max(0, Math.min(...visible.map(q => this.headroom(q))))
                : null;
            const soldOut = limiting.some(q => this.headroom(q) <= 0);

            const active = selectActiveTier(ticketType.priceTiers, ticketType.basePrice, now);

            return {
                id: ticketType.id,
                remaining,
                soldOut,
                roleOnHold: ticketType.roleConstraint
                    ? rolesOnHold[ticketType.roleConstraint === DanceRole.LEADER ? "leader" : "follower"]
                    : rolesOnHold.leader && rolesOnHold.follower,
                activeTier: {
                    price: active.price,
                    expiresAt: active.expiresAt,
                    remainingAtThisPrice: active.remainingAtThisPrice,
                },
            } satisfies TicketTypeAvailability;
        });

        Log.debug(
            `[CapacityEngine Service]: availability served for event (id ${eventId}) — `
            + `${availabilities.length} ticket type(s), ${availabilities.filter(a => a.soldOut).length} sold out`,
        );

        return {
            eventId,
            ticketTypes: availabilities,
            roles: {
                leader: leaderQuota ? Math.max(0, this.headroom(leaderQuota)) : null,
                follower: followerQuota ? Math.max(0, this.headroom(followerQuota)) : null,
            },
            rolesOnHold,
            imbalance: leaderQuota && followerQuota ? leaderQuota.consumed - followerQuota.consumed : null,
            imbalanceTolerance: leaderQuota?.imbalanceTolerance ?? followerQuota?.imbalanceTolerance ?? null,
        };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Invarianti (`05` §12)
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Verifica le invarianti verificabili sui dati di un evento. `05` §12 indica
     * **I2 e I7** come candidate naturali a un controllo periodico con allarme:
     * *una divergenza è il primo sintomo di una condizione di corsa sfuggita ai
     * test*.
     *
     * - **I2** — `consumed` coincide con la somma delle `quantity` dei consumi collegati.
     * - **I3** — nessun consumo appartiene a un'iscrizione non attiva (con I6).
     * - **I4** — nessuna iscrizione attiva senza `assignedRole` su eventi con quote di ruolo.
     * - **I7** — la somma dei consumi sulle quote di ruolo non supera il consumo della quota totale.
     */
    public async verifyInvariants(eventId: number): Promise<InvariantReport> {
        const violations: InvariantReport["violations"] = [];

        const quotas = await this.capacityQuotaRepository.findByEvent(eventId);
        const sums = await this.quotaConsumptionRepository.sumByQuota(quotas.map(q => q.id));

        for (const quota of quotas) {
            const sum = sums.get(quota.id) ?? 0;
            if (sum !== quota.consumed) {
                violations.push({
                    invariant: "I2",
                    detail: `quota (id ${quota.id}, ${quota.scope}${quota.role ? `/${quota.role}` : ""}) has consumed ${quota.consumed} but its consumptions sum to ${sum}`,
                });
            }
        }

        const consumptions = await this.quotaConsumptionRepository.findByQuotas(quotas.map(q => q.id));
        const registrations = await this.registrationRepository.findByIds(
            [...new Set(consumptions.map(c => c.registrationId))],
        );
        const byId = new Map(registrations.map(r => [r.id, r]));

        for (const consumption of consumptions) {
            const registration = byId.get(consumption.registrationId);
            if (!registration || registration.deleted || registration.status === "DECLINED") {
                violations.push({
                    invariant: "I3",
                    detail: `consumption (id ${consumption.id}) belongs to a registration that is no longer active (id ${consumption.registrationId})`,
                });
            }
        }

        const totalQuota = quotas.find(q => q.scope === QuotaScope.EVENT && q.role === null && q.reservedFor === null);
        const leaderQuota = this.findRoleQuota(quotas, DanceRole.LEADER);
        const followerQuota = this.findRoleQuota(quotas, DanceRole.FOLLOWER);

        if (totalQuota && leaderQuota && followerQuota) {
            const roleSum = leaderQuota.consumed + followerQuota.consumed;
            if (roleSum > totalQuota.consumed) {
                violations.push({
                    invariant: "I7",
                    detail: `role quotas consume ${roleSum} while the event total quota consumes ${totalQuota.consumed}`,
                });
            }
        }

        if (leaderQuota || followerQuota) {
            const active = await this.registrationRepository.countActiveByRole(eventId, null);
            if (active > 0) {
                violations.push({
                    invariant: "I4",
                    detail: `${active} active registration(s) have no assignedRole on an event that has role quotas`,
                });
            }
        }

        if (violations.length) {
            Log.error(
                `[CapacityEngine Service]: invariant check FAILED on event (id ${eventId}) — `
                + violations.map(v => `${v.invariant}: ${v.detail}`).join(" | "),
            );
        } else {
            Log.debug(`[CapacityEngine Service]: invariant check passed on event (id ${eventId}) over ${quotas.length} quota(s)`);
        }

        return { eventId, ok: violations.length === 0, violations };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Interni
    // ═════════════════════════════════════════════════════════════════════════

    /** Posti ancora impegnabili su una quota, tolleranza di sforamento compresa. */
    private headroom(quota: CapacityQuota): number {
        return quota.limit + quota.overbookAllowance - quota.consumed;
    }

    private findRoleQuota(quotas: CapacityQuota[], role: DanceRole): CapacityQuota | undefined {
        return quotas.find(q =>
            q.scope === QuotaScope.EVENT && q.scopeId === null && q.role === role && q.reservedFor === null,
        );
    }

    /** Risolve ruolo e quote applicabili di ogni riga dell'ordine. */
    private async resolveItems(
        eventId: number,
        items: CommitItem[],
        quotas: CapacityQuota[],
        tx: Prisma.TransactionClient,
    ): Promise<ResolvedRegistration[]> {
        const registrations = await this.registrationRepository.findByIds(items.map(i => i.registrationId), tx);
        const byId = new Map(registrations.map(r => [r.id, r]));

        const ticketTypeIds = [
            ...new Set(
                items
                    .flatMap(i => [i.ticketTypeId, ...(i.ticketTypeIds ?? [])])
                    .filter((id): id is number => !!id),
            ),
        ];
        const sessionsByTicketType = await this.loadIncludedSessions(ticketTypeIds, tx);

        // Ruoli già decisi in QUESTO ordine: due flessibili non finiscono
        // entrambi nello stesso ruolo (`05` §5, valutazione sull'ordine intero).
        const pending = { leader: 0, follower: 0 };
        const resolved: ResolvedRegistration[] = [];

        for (const item of items) {
            const registration = byId.get(item.registrationId);
            if (!registration) {
                Log.warn(`[CapacityEngine Service]: commit refused on event (id ${eventId}) — registration (id ${item.registrationId}) not found`);
                throw new httpErrors.NotFound("Iscrizione non trovata.");
            }
            if (registration.eventId !== eventId) {
                Log.warn(
                    `[CapacityEngine Service]: commit refused — registration (id ${registration.id}) belongs to `
                    + `event (id ${registration.eventId}), not (id ${eventId})`,
                );
                throw new httpErrors.BadRequest("L'iscrizione non appartiene a questo evento.");
            }

            const role = this.resolveRoleFor(item, registration, quotas, pending);
            if (role === DanceRole.LEADER) {
                pending.leader += 1;
            } else if (role === DanceRole.FOLLOWER) {
                pending.follower += 1;
            }

            // L'UNIONE delle sessioni di tutti i titoli della persona: due titoli
            // che includono la stessa serata la nominano una volta sola, e la
            // deduplica per quota fa il resto (`RF-PAY-26`).
            const itemTicketTypeIds = [
                ...new Set(
                    [item.ticketTypeId, ...(item.ticketTypeIds ?? [])]
                        .filter((id): id is number => !!id),
                ),
            ];
            const sessionIds = [
                ...new Set(itemTicketTypeIds.flatMap(id => sessionsByTicketType.get(id) ?? [])),
            ];

            const applicable = this.resolveApplicableQuotas(quotas, {
                channel: registration.channel,
                role,
                ticketTypeId: item.ticketTypeId ?? null,
                ticketTypeIds: item.ticketTypeIds ?? [],
                sessionIds,
                serviceIds: item.serviceIds ?? [],
            });

            resolved.push({
                registration,
                role,
                quantity: item.quantity ?? 1,
                quotas: applicable,
            });
        }

        return resolved;
    }

    private resolveRoleFor(
        item: CommitItem,
        registration: Registration,
        quotas: CapacityQuota[],
        pending: { leader: number; follower: number },
    ): DanceRole | null {
        if (item.roleOverride) {
            return item.roleOverride;
        }
        if (registration.declaredRole === DeclaredDanceRole.FLEXIBLE) {
            return this.resolveFlexibleRole(quotas, pending);
        }
        return registration.declaredRole === DeclaredDanceRole.LEADER ? DanceRole.LEADER : DanceRole.FOLLOWER;
    }

    /** Elenco esplicito delle sessioni incluse in ciascun titolo (§4.7). */
    private async loadIncludedSessions(
        ticketTypeIds: number[],
        tx: Prisma.TransactionClient,
    ): Promise<Map<number, number[]>> {
        const map = new Map<number, number[]>();
        for (const ticketTypeId of ticketTypeIds) {
            const ticketType = await this.ticketTypeRepository.findWithSessions(ticketTypeId, tx);
            map.set(ticketTypeId, ticketType?.sessions.map(link => link.sessionId) ?? []);
        }
        return map;
    }

    /** Mappa quota → unità richieste per l'intero ordine, in ordine di id crescente. */
    private aggregate(resolved: ResolvedRegistration[]): QuotaRequest[] {
        const requests = new Map<number, QuotaRequest>();

        for (const item of resolved) {
            for (const quota of item.quotas) {
                const existing = requests.get(quota.id);
                if (existing) {
                    existing.quantity += item.quantity;
                } else {
                    requests.set(quota.id, { quota, quantity: item.quantity });
                }
            }
        }

        return [...requests.values()].sort((a, b) => a.quota.id - b.quota.id);
    }

    private countRequestedRoles(resolved: ResolvedRegistration[]): { leader: number; follower: number } {
        return resolved.reduce(
            (acc, item) => {
                if (item.role === DanceRole.LEADER) {
                    acc.leader += item.quantity;
                } else if (item.role === DanceRole.FOLLOWER) {
                    acc.follower += item.quantity;
                }
                return acc;
            },
            { leader: 0, follower: 0 },
        );
    }

    /**
     * Verifica preliminare **senza impegno** di tutte le quote applicabili
     * (`05` §11). Classifica il rifiuto; l'autorità resta dell'aggiornamento
     * condizionato del passaggio D.
     *
     * **Disponibilità parziale in checkout** (`RB17`): se risultano sature
     * *soltanto* quote di ambito `SERVICE`, l'ordine non viene rifiutato — si
     * restituisce `PARTIAL_AVAILABILITY` con l'elenco delle righe indisponibili e
     * la conferma esplicita arriva dal chiamante. *Non si fa fallire
     * un'iscrizione da novanta euro per una cena da venticinque.*
     */
    private async assertNoSaturatedQuota(
        eventId: number,
        requests: QuotaRequest[],
        tx: Prisma.TransactionClient,
    ): Promise<void> {
        const saturated = requests.filter(({ quota, quantity }) =>
            quota.limiting && quota.consumed + quantity > quota.limit + quota.overbookAllowance,
        );

        if (!saturated.length) {
            return;
        }

        const blocking = saturated.filter(({ quota }) => quota.scope !== QuotaScope.SERVICE);

        if (!blocking.length) {
            const labels = await Promise.all(saturated.map(({ quota }) => this.describeQuota(quota, tx)));
            Log.warn(
                `[CapacityEngine Service]: PARTIAL_AVAILABILITY on event (id ${eventId}) — only service quotas are `
                + `saturated: ${labels.join(", ")}`,
            );
            throw domainError(
                DomainErrorCode.PARTIAL_AVAILABILITY,
                "Uno o più servizi accessori sono appena andati esauriti. Puoi completare l'iscrizione senza di essi.",
                409,
                {
                    unavailable: saturated.map(({ quota }, index) => ({
                        scope: quota.scope,
                        scopeId: quota.scopeId,
                        scopeLabel: labels[index],
                        role: quota.role,
                    })),
                },
            );
        }

        // Il rifiuto più significativo per l'utente è quello più "alto": la sala e
        // i ruoli prima del titolo, il titolo prima della singola sessione.
        const priority: Record<string, number> = {
            [QuotaScope.EVENT]: 0,
            [QuotaScope.TICKET_TYPE]: 1,
            [QuotaScope.SESSION]: 2,
            [QuotaScope.SERVICE]: 3,
        };
        blocking.sort((a, b) => (priority[a.quota.scope] ?? 9) - (priority[b.quota.scope] ?? 9) || a.quota.id - b.quota.id);

        const { quota, quantity } = blocking[0]!;
        Log.warn(
            `[CapacityEngine Service]: SOLD_OUT on event (id ${eventId}) — quota (id ${quota.id}, ${quota.scope}`
            + `${quota.role ? `/${quota.role}` : ""}) has ${this.headroom(quota)} left for ${quantity} requested unit(s)`,
        );
        throw await this.soldOutError(quota, tx);
    }

    /**
     * `SOLD_OUT` porta sempre `{ scope, scopeId, scopeLabel, role }` perché
     * `RF-PAY-16` richiede di **nominare la sessione e il ruolo** e di proporre i
     * titoli alternativi (§3.3).
     */
    private async soldOutError(quota: CapacityQuota, tx?: Prisma.TransactionClient) {
        const label = await this.describeQuota(quota, tx);
        const roleLabel = quota.role === DanceRole.LEADER ? "leader" : "follower";

        const message = quota.role
            ? `Posti ${roleLabel} esauriti${quota.scope === QuotaScope.SESSION ? ` per «${label}»` : ""}.`
            : `«${label}»: posti esauriti.`;

        return domainError(DomainErrorCode.SOLD_OUT, message, 409, {
            scope: quota.scope,
            scopeId: quota.scopeId,
            scopeLabel: label,
            role: quota.role,
        });
    }

    /** Nome umano dell'ambito di una quota, per i messaggi del §3.3. */
    private async describeQuota(quota: CapacityQuota, tx?: Prisma.TransactionClient): Promise<string> {
        const asText = (value: unknown, fallback: string): string => {
            if (value && typeof value === "object") {
                const i18n = value as { it?: string; en?: string };
                return i18n.it ?? i18n.en ?? fallback;
            }
            return typeof value === "string" ? value : fallback;
        };

        switch (quota.scope) {
            case QuotaScope.EVENT:
                if (quota.reservedFor === QuotaReservedFor.COMPLIMENTARY) return "Contingente accrediti";
                if (quota.reservedFor === QuotaReservedFor.EXTERNAL_CHANNEL) return "Contingente canali esterni";
                return quota.role ? "Equilibrio dei ruoli" : "Capienza della sala";
            case QuotaScope.SESSION: {
                const session = quota.scopeId
                    ? await this.sessionRepository.findOne({ id: quota.scopeId }, undefined, tx)
                    : null;
                return asText(session?.name, "Sessione");
            }
            case QuotaScope.TICKET_TYPE: {
                const ticketType = quota.scopeId
                    ? await this.ticketTypeRepository.findOne({ id: quota.scopeId }, undefined, tx)
                    : null;
                return asText(ticketType?.name, "Titolo d'ingresso");
            }
            case QuotaScope.SERVICE: {
                const service = quota.scopeId
                    ? await this.eventServiceRepository.findOne({ id: quota.scopeId }, undefined, tx)
                    : null;
                return asText(service?.name, "Servizio accessorio");
            }
            default:
                return "Quota di capienza";
        }
    }

    /** Decremento esatto + cancellazione delle righe, in ordine di quota crescente. */
    private async releaseConsumptions(
        consumptions: { id: number; capacityQuotaId: number; quantity: number }[],
        registrationIds: number[],
        tx: Prisma.TransactionClient,
    ): Promise<ReleaseOutcome> {
        if (!consumptions.length) {
            Log.info(
                `[CapacityEngine Service]: release is a no-op — no consumption found for `
                + `registration(s) [${registrationIds.join(", ")}]`,
            );
            return { registrationIds, releasedQuotaIds: [], releasedQuantity: 0, deletedConsumptions: 0 };
        }

        const byQuota = new Map<number, number>();
        for (const consumption of consumptions) {
            byQuota.set(consumption.capacityQuotaId, (byQuota.get(consumption.capacityQuotaId) ?? 0) + consumption.quantity);
        }

        const quotaIds = [...byQuota.keys()].sort((a, b) => a - b);
        for (const quotaId of quotaIds) {
            await this.capacityQuotaRepository.decrement(quotaId, byQuota.get(quotaId)!, tx);
        }

        const deleted = await this.quotaConsumptionRepository.deleteByIds(consumptions.map(c => c.id), tx);
        const releasedQuantity = [...byQuota.values()].reduce((sum, q) => sum + q, 0);

        Log.info(
            `[CapacityEngine Service]: released ${releasedQuantity} unit(s) across ${quotaIds.length} quota(s) `
            + `for registration(s) [${registrationIds.join(", ")}] — ${deleted} consumption row(s) deleted`,
        );

        return { registrationIds, releasedQuotaIds: quotaIds, releasedQuantity, deletedConsumptions: deleted };
    }

    /**
     * Registra il segnale `event/availability-changed`. Non fa I/O: apre soltanto
     * la finestra di aggregazione di ~1,5 s (§3.9).
     */
    private async signalAvailabilityChange(eventId: number): Promise<void> {
        const event = await this.eventRepository.findOne({ id: eventId });
        if (event) {
            this.availabilityBroadcastService.notify(eventId, event.organizationId);
        }
    }

    private async signalAvailabilityChangeForRegistrations(registrationIds: number[]): Promise<void> {
        const registrations = await this.registrationRepository.findByIds(registrationIds);
        for (const eventId of new Set(registrations.map(r => r.eventId))) {
            await this.signalAvailabilityChange(eventId);
        }
    }
}
