import { Service } from "fastify-decorators";
import { BalanceSettlement, BalanceSettlementMethod, Prisma, Registration } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { getPrismaClient } from "@utils/adapters/prisma";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { BalanceSettlementRepository } from "@repositories/BalanceSettlementRepository";
import { RegistrationRepository } from "@repositories/RegistrationRepository";
import { EventRepository } from "@repositories/EventRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { OrganizationAudienceService } from "@services/OrganizationAudienceService";
import { WsPublisherService } from "@websocket/publisher/WsPublisherService";
import { Events } from "@websocket/events/Events";
import { BalanceSettledPayloadDTO } from "@websocket/dtos/BalanceSettledPayloadDTO";
import {
    BalanceSettlementCreateDTO,
    BalanceSettlementSyncDTO,
    BalanceSettlementSyncEntryDTO,
} from "@DTOs/balance_settlement/BalanceSettlementCreateDTO";
import { BalanceSettlementQueryDTO } from "@DTOs/balance_settlement/BalanceSettlementQueryDTO";
import {
    BalanceSettlementSyncAcceptedDTO,
    BalanceSettlementSyncConflictDTO,
    BalanceSettlementSyncRejectedDTO,
    BalanceSettlementSyncResultDTO,
} from "@DTOs/balance_settlement/BalanceSettlementResponseDTO";
import { RegistrationBalanceDTO } from "@DTOs/balance_settlement/RegistrationBalanceDTO";

/** Ciò che una riga di incasso ha bisogno di sapere, comunque sia arrivata. */
type SettlementInput = {
    registrationId: number;
    amount: number;
    method: BalanceSettlementMethod;
    collectedAt: Date;
    deviceId: string | null;
    deviceReference: string | null;
    offline: boolean;
    note: string | null;
};

/** Perché una riga nasce in conflitto. `null` = non nasce in conflitto. */
type ConflictReason = "ALREADY_SETTLED" | "EXCEEDS_BALANCE" | "NO_BALANCE_DUE" | null;

/**
 * # `BalanceSettlement` — la cassa del botteghino, `14-acconto-e-saldo.md` §6
 *
 * ── Le tre regole che governano ogni riga di questo file ─────────────────────
 *
 * 1. **Si registra, non si contabilizza** (`RB26`). Nessuna riga `Payment` nasce
 *    qui: il denaro non è mai passato da Mirada, né l'acconto sul negozio né il
 *    saldo in contanti alla porta. Scrivere `Payment` metterebbe una bugia nel
 *    registro degli incassi della piattaforma e romperebbe il significato di
 *    `Payment.idempotencyKey`. Gli adempimenti fiscali su quel contante —
 *    ricevuta, corrispettivi — restano dell'organizzatore: Mirada gli dà il
 *    registro, non gli fa da cassiere.
 *
 * 2. **Il contatore è la somma delle righe, sempre.** `Registration.balanceSettledAmount`
 *    si muove solo di qui, e solo in `increment`: è la stessa disciplina di
 *    `CapacityQuota.consumed`, e per la stessa ragione — un contatore che si può
 *    scrivere dall'esterno è un contatore che prima o poi racconterà una cosa
 *    diversa dalle righe che lo compongono. Ed è il motivo per cui non esiste un
 *    `Update` di questo servizio che tocchi l'importo.
 *
 * 3. **Il doppio incasso è un conflitto da risolvere, mai risolto in silenzio**
 *    (`RF-SAL-11`, gemello di `RF-CHK-6`). Due postazioni scollegate possono
 *    incassare due volte lo stesso residuo senza saperlo: la seconda riga viene
 *    **creata**, marcata, e lasciata allo staff. Sono soldi che qualcuno ha
 *    realmente preso in mano.
 *
 * ── L'asimmetria fra `record` e `sync`, che è deliberata ─────────────────────
 * `record` è **prima** che il denaro passi di mano: se la persona non deve nulla,
 * si rifiuta e nessuno prende soldi che non erano dovuti. `sync` è **dopo**: la
 * riga arriva da una coda offline, il contante è già nel cassetto, e rifiutarla
 * significherebbe cancellare denaro esistente. Quindi si accetta e si segnala.
 */
@Service()
export class BalanceSettlementService {
    constructor(
        private readonly balanceSettlementRepository: BalanceSettlementRepository,
        private readonly registrationRepository: RegistrationRepository,
        private readonly eventRepository: EventRepository,
        private readonly organizationScopeService: OrganizationScopeService,
        private readonly organizationAudienceService: OrganizationAudienceService,
        private readonly wsPublisher: WsPublisherService,
    ) {}

    // ═════════════════════════════════════════════════════════════════════════
    // 1. L'incasso con la rete — `POST /balance-settlements/create`
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * La cassa incassa, o il back-office registra un bonifico arrivato a maggio
     * (`RF-SAL-10`): è **la stessa riga**, e cambia solo che non ha postazione.
     *
     * Un bonifico che non potesse chiudere il residuo prima dell'evento
     * lascerebbe la persona a sentirsi chiedere alla porta soldi che ha già
     * mandato — ed è la lamentela che l'organizzatore paga più cara.
     */
    public async save(principalId: number, dto: BalanceSettlementCreateDTO): Promise<BalanceSettlement> {
        const registration = await this.findRegistrationInScopeOrThrow(principalId, dto.registrationId);
        const open = registration.balanceDueAmount - registration.balanceSettledAmount;

        if (registration.balanceDueAmount <= 0) {
            Log.warn(
                `[BalanceSettlement Service]: settlement refused — registration (id ${registration.id}) has no balance `
                + "due (full-price sale)",
            );
            throw new httpErrors.BadRequest("Questa iscrizione non ha un saldo da versare.");
        }
        if (open <= 0) {
            Log.warn(
                `[BalanceSettlement Service]: settlement refused — registration (id ${registration.id}) is already `
                + `settled (${registration.balanceSettledAmount} of ${registration.balanceDueAmount} cents)`,
            );
            throw new httpErrors.Conflict("Il saldo di questa iscrizione è già stato versato.");
        }
        if (dto.amount > open) {
            // Si rifiuta **prima** di prendere i soldi: alla porta c'è ancora
            // qualcuno con il portafoglio in mano, e dirgli la cifra giusta è
            // gratis. È l'opposto di ciò che fa `sync`, dove i soldi sono già
            // stati presi e la riga va registrata comunque.
            Log.warn(
                `[BalanceSettlement Service]: settlement refused — ${dto.amount} cents exceed the ${open} cents still `
                + `open on registration (id ${registration.id})`,
            );
            throw new httpErrors.BadRequest(
                `L'importo supera il residuo ancora aperto (${(open / 100).toFixed(2)} €).`,
            );
        }

        const { settlement } = await this.persist(principalId, registration, {
            registrationId: registration.id,
            amount: dto.amount,
            method: dto.method,
            collectedAt: dto.collectedAt ?? new Date(),
            deviceId: dto.deviceId ?? null,
            deviceReference: dto.deviceReference ?? null,
            offline: dto.offline ?? false,
            note: dto.note ?? null,
        }, null);

        Log.info(
            `[BalanceSettlement Service]: settled ${dto.amount} cents (id ${settlement.id}) on registration `
            + `(id ${registration.id}) by operator (id ${principalId}) — ${dto.method}`
            + `${dto.deviceId ? ` at '${dto.deviceId}'` : " from the back-office"}`,
        );

        await this.publishSettled(registration, settlement, dto.amount, false);
        return settlement;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 2. La coda della cassa — `POST /balance-settlements/sync` (`RF-SAL-11`)
    // ═════════════════════════════════════════════════════════════════════════

    public async sync(principalId: number, dto: BalanceSettlementSyncDTO): Promise<BalanceSettlementSyncResultDTO> {
        Log.info(`[BalanceSettlement Service]: syncing ${dto.entries.length} queued settlement(s) from a box office device`);

        const accepted: BalanceSettlementSyncAcceptedDTO[] = [];
        const conflicts: BalanceSettlementSyncConflictDTO[] = [];
        const rejected: BalanceSettlementSyncRejectedDTO[] = [];

        for (const entry of dto.entries) {
            const result = await this.syncOne(principalId, entry);
            if (result.kind === "accepted") {
                accepted.push(result.value);
            } else if (result.kind === "conflict") {
                conflicts.push(result.value);
            } else {
                rejected.push(result.value);
            }
        }

        Log.info(
            `[BalanceSettlement Service]: sync completed — ${accepted.length} accepted, ${conflicts.length} conflict(s) `
            + `left to the staff, ${rejected.length} rejected`,
        );
        return { accepted, conflicts, rejected };
    }

    private async syncOne(
        principalId: number,
        entry: BalanceSettlementSyncEntryDTO,
    ): Promise<
        | { kind: "accepted"; value: BalanceSettlementSyncAcceptedDTO }
        | { kind: "conflict"; value: BalanceSettlementSyncConflictDTO }
        | { kind: "rejected"; value: BalanceSettlementSyncRejectedDTO }
    > {
        const scope = await this.organizationScopeService.resolve(principalId);
        const registration = await this.registrationRepository.findOneInScope(
            scope,
            { id: entry.registrationId, deleted: false },
        );

        if (!registration) {
            // L'unico rifiuto possibile: un'iscrizione che non esiste o non è di
            // questa organizzazione. Non è una riga da conservare, è una riga
            // che non si sa dove mettere.
            Log.warn(
                `[BalanceSettlement Service]: queued settlement rejected — registration (id ${entry.registrationId}) `
                + "not found in the caller's scope",
            );
            return {
                kind: "rejected",
                value: {
                    deviceReference: entry.deviceReference,
                    registrationId: entry.registrationId,
                    reason: "REGISTRATION_NOT_FOUND",
                    message: "Iscrizione non trovata.",
                },
            };
        }

        // Idempotenza della coda: la stessa riscossione mandata due volte è una
        // riga sola. Distinta dal doppio incasso vero, che è due riscossioni.
        const replay = await this.balanceSettlementRepository.findByDeviceReference(
            entry.deviceId,
            entry.deviceReference,
        );
        if (replay && replay.registrationId !== registration.id) {
            // Stesso riferimento, **altra persona**: non è una risincronizzazione,
            // è un dispositivo che ha riusato un riferimento. Trattarlo come
            // replay significherebbe far sparire in silenzio un incasso vero, che
            // è l'errore peggiore possibile qui — quindi si rifiuta e lo si dice.
            Log.warn(
                `[BalanceSettlement Service]: queued settlement rejected — device reference `
                + `'${entry.deviceId}/${entry.deviceReference}' already belongs to settlement (id ${replay.id}) of `
                + `registration (id ${replay.registrationId}), not registration (id ${registration.id})`,
            );
            return {
                kind: "rejected",
                value: {
                    deviceReference: entry.deviceReference,
                    registrationId: entry.registrationId,
                    reason: "DEVICE_REFERENCE_REUSED",
                    message:
                        "Questo riferimento appartiene già a un incasso di un'altra iscrizione: "
                        + "registralo a mano dal back-office invece di risincronizzarlo.",
                },
            };
        }

        if (replay) {
            Log.info(
                `[BalanceSettlement Service]: queued settlement is a replay of (id ${replay.id}) — same device and `
                + "reference. No new row.",
            );
            return {
                kind: "accepted",
                value: { deviceReference: entry.deviceReference, settlement: replay, duplicateOfSameEntry: true },
            };
        }

        const open = registration.balanceDueAmount - registration.balanceSettledAmount;
        const previous = (await this.balanceSettlementRepository.findByRegistration(registration.id)).at(-1) ?? null;

        const reason: ConflictReason = registration.balanceDueAmount <= 0
            ? "NO_BALANCE_DUE"
            : open <= 0
                ? "ALREADY_SETTLED"
                : entry.amount > open
                    ? "EXCEEDS_BALANCE"
                    : null;

        const { settlement } = await this.persist(principalId, registration, {
            registrationId: registration.id,
            amount: entry.amount,
            method: entry.method,
            collectedAt: entry.collectedAt,
            deviceId: entry.deviceId,
            deviceReference: entry.deviceReference,
            offline: true,
            note: entry.note ?? null,
        }, reason ? previous : null);

        if (reason) {
            Log.warn(
                `[BalanceSettlement Service]: CONFLICT (${reason}) — queued settlement of ${entry.amount} cents on `
                + `registration (id ${registration.id}) meets a balance of ${open} cents still open. Row `
                + `(id ${settlement.id}) created and left to the staff, never dropped: that money was really taken.`,
            );
            await this.publishSettled(registration, settlement, entry.amount, true);
            return {
                kind: "conflict",
                value: {
                    deviceReference: entry.deviceReference,
                    settlement,
                    conflictsWith: previous,
                    reason,
                },
            };
        }

        Log.info(
            `[BalanceSettlement Service]: queued settlement accepted (id ${settlement.id}) — ${entry.amount} cents on `
            + `registration (id ${registration.id}), collected offline at ${entry.collectedAt.toISOString()}`,
        );
        await this.publishSettled(registration, settlement, entry.amount, false);
        return {
            kind: "accepted",
            value: { deviceReference: entry.deviceReference, settlement, duplicateOfSameEntry: false },
        };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 3. La scrittura, una sola per tutte le strade
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * La riga e il contatore, **nella stessa transazione**: sono due scritture, e
     * una riga senza il suo contatore — o un contatore senza la sua riga — è
     * esattamente la cassa che non torna.
     *
     * L'incremento è `{ increment }` e non «leggi, somma, scrivi»: due postazioni
     * che sincronizzano nello stesso istante non devono poter perdere un incasso
     * per sovrascrittura.
     */
    private async persist(
        principalId: number,
        registration: Registration,
        input: SettlementInput,
        conflictWith: BalanceSettlement | null,
    ): Promise<{ settlement: BalanceSettlement }> {
        return getPrismaClient().$transaction(async prisma => {
            const settlement = await this.balanceSettlementRepository.save(
                {
                    registrationId: input.registrationId,
                    amount: input.amount,
                    method: input.method,
                    operatorUserId: principalId,
                    collectedAt: input.collectedAt,
                    syncedAt: input.offline ? new Date() : null,
                    deviceId: input.deviceId,
                    deviceReference: input.deviceReference,
                    offline: input.offline,
                    conflictWithId: conflictWith?.id ?? null,
                    note: input.note,
                },
                prisma,
            );

            await this.registrationRepository.update(
                { id: registration.id },
                { balanceSettledAmount: { increment: input.amount } },
                undefined,
                undefined,
                prisma,
            );

            return { settlement };
        });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 4. La lettura
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Il residuo di una persona, con le sue righe — `RF-SAL-14`.
     *
     * ⚠️ **Porta la cifra**, quindi la rotta che la espone chiede il permesso di
     * chi tiene la cassa. Chi sta alla porta riceve un flag, non questo (`RB27`).
     */
    public async balanceOf(principalId: number, registrationId: number): Promise<RegistrationBalanceDTO> {
        const registration = await this.findRegistrationInScopeOrThrow(principalId, registrationId);
        const settlements = await this.balanceSettlementRepository.findByRegistration(registration.id);

        return {
            registrationId: registration.id,
            eventId: registration.eventId,
            holderName: registration.holderName,
            holderSurname: registration.holderSurname,
            dueAmount: registration.balanceDueAmount,
            settledAmount: registration.balanceSettledAmount,
            openAmount: registration.balanceDueAmount - registration.balanceSettledAmount,
            settlements,
        };
    }

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<BalanceSettlement | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.balanceSettlementRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async paginate(
        principalId: number,
        query: BalanceSettlementQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<BalanceSettlement>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.balanceSettlementRepository.paginateInScope(scope, this.queryFromPayload(query), options);
    }

    private queryFromPayload(payload: BalanceSettlementQueryDTO): Prisma.BalanceSettlementWhereInput {
        const query: Prisma.BalanceSettlementWhereInput[] = [
            { deleted: false },
            payload.conflictsOnly ? { conflictWithId: { not: null } } : {},
            createObjectWithoutThrow(payload.registrationId, { registrationId: payload.registrationId }),
            createObjectWithoutThrow(payload.operatorUserId, { operatorUserId: payload.operatorUserId }),
            createObjectWithoutThrow(payload.method, { method: payload.method }),
            createObjectWithoutThrow(payload.deviceId, { deviceId: payload.deviceId }),
            createObjectWithoutThrow(payload.offline, { offline: payload.offline }),
            createObjectWithoutThrow(payload.eventId, { registration: { eventId: payload.eventId } }),
        ];
        return { AND: query };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Aiutanti
    // ═════════════════════════════════════════════════════════════════════════

    private async findRegistrationInScopeOrThrow(principalId: number, registrationId: number): Promise<Registration> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const registration = await this.registrationRepository.findOneInScope(
            scope,
            { id: registrationId, deleted: false },
        );
        if (!registration) {
            Log.warn(`[BalanceSettlement Service]: registration (id ${registrationId}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Iscrizione non trovata.");
        }
        return registration;
    }

    /**
     * §3.9 — **dopo** la scrittura, mai dentro la transazione, e un errore di
     * trasporto non risale mai a un incasso già registrato: quei soldi ci sono
     * comunque, e un socket lento non può disfarli.
     */
    private async publishSettled(
        registration: Registration,
        settlement: BalanceSettlement,
        amount: number,
        conflict: boolean,
    ): Promise<void> {
        try {
            const event = await this.eventRepository.findOne({ id: registration.eventId });
            if (!event) {
                return;
            }
            const wsCodes = await this.organizationAudienceService.resolveMemberWsCodes(event.organizationId);
            if (!wsCodes.length) {
                return;
            }

            const payload: BalanceSettledPayloadDTO = {
                balanceSettlementId: settlement.id,
                registrationId: registration.id,
                eventId: registration.eventId,
                organizationId: event.organizationId,
                // Il contatore in memoria è quello di prima della scrittura: si
                // somma qui invece di rileggere la riga, che sarebbe una query
                // per un dato che si ha già.
                fullySettled: registration.balanceSettledAmount + amount >= registration.balanceDueAmount,
                conflict,
            };

            await this.wsPublisher.sendToUsers(wsCodes, Events.BALANCE_SETTLED, payload);
        } catch (err) {
            Log.error(
                `[BalanceSettlement Service]: failed to publish 'balance/settled' for settlement (id ${settlement.id}): `
                + `${(err as Error).message}`,
            );
        }
    }
}
