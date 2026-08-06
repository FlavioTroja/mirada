import { Service } from "fastify-decorators";
import { Prisma, Reservation } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope } from "@utils/helpers/organizationScope";

/** La prenotazione con l'ordine e le sue righe: quanto basta per rilasciarla. */
export type ReservationWithOrder = Prisma.ReservationGetPayload<{
    include: { order: { include: { lines: true; purchase: true } } };
}>;

/**
 * `Reservation` — backend-brief §4.11, `RF-PAY-23` e `RF-PAY-24`.
 *
 * **Sola lettura via API** (§3.4): si crea con `POST /orders/reserve` e si
 * rilascia con `abandon`, `confirm-free` o lo scheduler. Una prenotazione che si
 * potesse creare da fuori sarebbe un modo per impegnare capienza senza ordine.
 */
@Service()
export class ReservationRepository extends BaseRepository<"reservation"> {
    constructor() {
        super("reservation");
    }

    /**
     * `RF-PAY-23` — **una sola prenotazione attiva per `(userId, eventId)`**.
     *
     * «Attiva» qui significa `releasedAt IS NULL`, che è esattamente il predicato
     * dell'indice unico parziale creato in migrazione. Il finder e il vincolo
     * **devono dire la stessa cosa**: se il finder guardasse anche `expiresAt`, il
     * servizio crederebbe di poter creare una riga che il database poi rifiuta,
     * e l'utente riceverebbe un `500` invece di `RESERVATION_ALREADY_ACTIVE`.
     * La distinzione fra attiva-e-valida e attiva-ma-scaduta è del servizio.
     */
    async findActive(userId: number, eventId: number, tx?: Prisma.TransactionClient): Promise<Reservation | null> {
        return this.findOne({ userId, eventId, releasedAt: null }, undefined, tx);
    }

    async findByOrder(orderId: number, tx?: Prisma.TransactionClient): Promise<Reservation[]> {
        return this.findMany({ orderId }, { orderBy: { id: "asc" } }, tx);
    }

    async findActiveByOrder(orderId: number, tx?: Prisma.TransactionClient): Promise<Reservation | null> {
        return this.findOne({ orderId, releasedAt: null }, undefined, tx);
    }

    /**
     * `RF-PAY-24` — le prenotazioni **scadute e non rilasciate**, che è la lista
     * su cui lo scheduler lavora. Senza di esso, in apertura vendite i posti
     * restano bloccati da ordini abbandonati: è il rischio `R1b`, dichiarato.
     *
     * Ordinate per `expiresAt` crescente — le più vecchie per prime — e limitate,
     * così una passata non diventa mai una transazione lunga quanto l'arretrato.
     */
    async findExpiredUnreleased(
        at: Date,
        take: number,
        tx?: Prisma.TransactionClient,
    ): Promise<ReservationWithOrder[]> {
        return this.exec(() =>
            this.getDelegate(tx).findMany({
                where: { releasedAt: null, expiresAt: { lt: at } },
                include: { order: { include: { lines: true, purchase: true } } },
                orderBy: { expiresAt: "asc" },
                take,
            }),
        ) as Promise<ReservationWithOrder[]>;
    }

    /** §1.5 — lo staff vede le prenotazioni dei propri eventi, il DANCER le proprie. */
    static visibilityWhere(scope: OrganizationScope, userId: number): Prisma.ReservationWhereInput {
        if (scope === null) {
            return {};
        }
        if (!scope.length) {
            return { userId };
        }
        return {
            OR: [
                { userId },
                { event: { organizationId: { in: scope } } },
            ],
        };
    }

    async findOneVisible(
        scope: OrganizationScope,
        userId: number,
        query: Prisma.ReservationWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<Reservation | null> {
        return this.findOne({ AND: [query, ReservationRepository.visibilityWhere(scope, userId)] }, options, tx);
    }

    async paginateVisible(
        scope: OrganizationScope,
        userId: number,
        query: Prisma.ReservationWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<Reservation>> {
        return this.paginate({ AND: [query, ReservationRepository.visibilityWhere(scope, userId)] }, options, tx);
    }
}
