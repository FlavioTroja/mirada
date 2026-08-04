import { Service } from "fastify-decorators";
import { CheckIn, Prisma } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope } from "@utils/helpers/organizationScope";

export type CheckInWithTicket = Prisma.CheckInGetPayload<{ include: { ticket: true } }>;

/**
 * Il registro delle presenze — **un asse distinto dalle quote** (`RB19`): il
 * check-in non consuma capienza, e questo repository non conosce
 * `CapacityQuota`.
 */
@Service()
export class CheckInRepository extends BaseRepository<"checkIn"> {
    constructor() {
        super("checkIn");
    }

    /**
     * L'ingresso **valido** già registrato sulla coppia biglietto–sessione, se
     * c'è. È la lettura su cui poggiano `RB7` e l'esito `ALREADY_USED`, che deve
     * riportare **ora e postazione del primo ingresso** (`RF-CHK-4`).
     *
     * Esclude le righe revocate (`RF-CHK-9`: un ingresso annullato non è mai
     * avvenuto) e le righe di conflitto, che sono doppioni segnalati in attesa di
     * decisione, non ingressi ammessi.
     */
    async findActive(
        ticketId: number,
        sessionId: number,
        tx?: Prisma.TransactionClient,
    ): Promise<CheckIn | null> {
        return this.findOne(
            { ticketId, sessionId, revokedAt: null, conflictWithId: null, deleted: false },
            undefined,
            tx,
        );
    }

    /**
     * Idempotenza della sincronizzazione: la **stessa** scansione rispedita dalla
     * coda locale dopo un timeout di rete. Stesso biglietto, stessa sessione,
     * stessa postazione e stesso istante di scansione **è** la stessa riga — non
     * un secondo ingresso, e quindi nemmeno un conflitto da mostrare allo staff.
     */
    async findSameScan(
        input: { ticketId: number; sessionId: number; deviceId: string; scannedAt: Date },
        tx?: Prisma.TransactionClient,
    ): Promise<CheckIn | null> {
        return this.findOne(
            {
                ticketId: input.ticketId,
                sessionId: input.sessionId,
                deviceId: input.deviceId,
                scannedAt: input.scannedAt,
                deleted: false,
            },
            undefined,
            tx,
        );
    }

    async findByTicket(ticketId: number, tx?: Prisma.TransactionClient): Promise<CheckIn[]> {
        return this.findMany({ ticketId, deleted: false }, { orderBy: { scannedAt: "asc" } }, tx);
    }

    async findBySession(sessionId: number, tx?: Prisma.TransactionClient): Promise<CheckIn[]> {
        return this.findMany({ sessionId, deleted: false }, { orderBy: { scannedAt: "asc" } }, tx);
    }

    /** Il **contatore presenze** di una sessione: righe valide, conflitti e revoche esclusi. */
    async countPresence(sessionId: number, tx?: Prisma.TransactionClient): Promise<number> {
        return this.count(
            { sessionId, revokedAt: null, conflictWithId: null, deleted: false },
            tx,
        );
    }

    /** I conflitti aperti di un evento — la coda di `/check-in/conflicts` (`RF-CHK-6`). */
    async findOpenConflictsByEvent(eventId: number, tx?: Prisma.TransactionClient): Promise<CheckIn[]> {
        return this.findMany(
            {
                deleted: false,
                revokedAt: null,
                conflictWithId: { not: null },
                session: { eventId },
            },
            { orderBy: { id: "asc" } },
            tx,
        );
    }

    /** §1.5 — lo scope passa dalla sessione e poi dall'evento. */
    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.CheckInWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<CheckIn | null> {
        return this.findOne({ AND: [query, this.scopeWhere(scope)] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.CheckInWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<CheckIn>> {
        return this.paginate({ AND: [query, this.scopeWhere(scope)] }, options, tx);
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<CheckIn> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }

    private scopeWhere(scope: OrganizationScope): Prisma.CheckInWhereInput {
        return scope === null ? {} : { session: { event: { organizationId: { in: scope } } } };
    }
}
