import { Service } from "fastify-decorators";
import { DanceRole, Prisma, Registration, RegistrationStatus } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, relationOrganizationScopeWhere } from "@utils/helpers/organizationScope";

/** Iscrizioni ancora "vive" — le uniche che devono risultare a contatore (invariante I6). */
export const ACTIVE_REGISTRATION_STATUSES: RegistrationStatus[] = [
    RegistrationStatus.CONFIRMED,
    RegistrationStatus.TO_CONFIRM,
];

@Service()
export class RegistrationRepository extends BaseRepository<"registration"> {
    constructor() {
        super("registration");
    }

    async findByEvent(eventId: number, options?: FindOptions, tx?: Prisma.TransactionClient): Promise<Registration[]> {
        return this.findMany({ eventId, deleted: false }, { ...options, orderBy: { id: "asc" } }, tx);
    }

    /**
     * **Le iscrizioni di una persona**, per il sito pubblico.
     *
     * Deliberatamente **fuori dallo scope di organizzazione**: lo scope serve a
     * isolare un tenant dall'altro, e un ballerino non è un tenant — è la
     * persona che compare nella riga. Filtrare qui per organizzazione darebbe a
     * chi balla un elenco vuoto (uno scope vuoto non vede nulla) e a un
     * titolare, che pure è una persona, solo le iscrizioni fatte a casa propria.
     *
     * Il filtro è `personUserId`, che è il legame reale fra l'account e
     * l'iscrizione: l'indirizzo scritto in fase d'acquisto no, perché si compra
     * anche per altri e un omonimo di casella condivisa vedrebbe i biglietti di
     * qualcun altro.
     */
    async findByPersonUser(
        personUserId: number,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<Registration[]> {
        return this.findMany({ personUserId, deleted: false }, options, tx);
    }

    async findByIds(ids: number[], tx?: Prisma.TransactionClient): Promise<Registration[]> {
        if (!ids.length) {
            return [];
        }
        return this.findMany({ id: { in: ids } }, { orderBy: { id: "asc" } }, tx);
    }

    /**
     * Cancellazione **reale** delle iscrizioni di un carrello abbandonato o
     * scaduto — `RF-PAY-24`, §4.11.
     *
     * ── Perché reale e non soft, che è l'eccezione di questo repository ──────
     * `@@unique([eventId, personUserId])` è un indice **del database**, e il
     * database non sa cosa sia `deleted`: una riga cancellata a metà continua a
     * occupare la coppia `(evento, persona)`. Un `safeDelete` qui produrrebbe
     * quindi il difetto peggiore del checkout — *chi abbandona il carrello non
     * può più iscriversi a quell'evento, per sempre*, con un errore che parla di
     * un'iscrizione che l'utente non vede da nessuna parte.
     *
     * È sicura perché si applica **solo** a iscrizioni che non hanno mai
     * prodotto nulla: i consumi di capienza sono già stati rilasciati dal
     * chiamante, `QuotaConsumption` e `RequirementOutcome` scendono in cascata, e
     * il chiamante verifica prima che non esistano biglietti né ingressi. Un
     * carrello abbandonato non è un'iscrizione da conservare: è un'iscrizione
     * che non c'è mai stata.
     */
    async hardDeleteByIds(ids: number[], tx?: Prisma.TransactionClient): Promise<number> {
        if (!ids.length) {
            return 0;
        }
        const result = await this.exec(() =>
            (this.getDelegate(tx) as Prisma.RegistrationDelegate).deleteMany({ where: { id: { in: ids } } }),
        );
        return result.count;
    }

    /** Le due iscrizioni di una coppia (§4.10): sono loro a puntare alla coppia. */
    async findByCouple(coupleId: number, tx?: Prisma.TransactionClient): Promise<Registration[]> {
        return this.findMany({ coupleId, deleted: false }, { orderBy: { id: "asc" } }, tx);
    }

    /** Una iscrizione per persona per evento (§3.6). */
    async findByEventAndPerson(
        eventId: number,
        personUserId: number,
        tx?: Prisma.TransactionClient,
    ): Promise<Registration | null> {
        return this.findOne({ eventId, personUserId, deleted: false }, undefined, tx);
    }

    /**
     * Iscritti per ruolo — è ciò da cui il cruscotto legge lo **sbilancio
     * corrente** senza alcun calcolo aggregato (`05` §10), e la base
     * dell'invariante I4 (nessuna iscrizione attiva senza `assignedRole` su
     * eventi con quote di ruolo).
     */
    async countActiveByRole(eventId: number, role: DanceRole | null, tx?: Prisma.TransactionClient): Promise<number> {
        return this.count(
            {
                eventId,
                deleted: false,
                status: { in: ACTIVE_REGISTRATION_STATUSES },
                assignedRole: role,
            },
            tx,
        );
    }

    async countActive(eventId: number, tx?: Prisma.TransactionClient): Promise<number> {
        return this.count(
            { eventId, deleted: false, status: { in: ACTIVE_REGISTRATION_STATUSES } },
            tx,
        );
    }

    /**
     * Iscrizioni attive **per evento**, in una query sola.
     *
     * Serve al riepilogo di piattaforma, che tocca ogni evento di ogni
     * organizzazione: un `countActive` per evento sarebbe una query per riga, e
     * su un catalogo che cresce è la differenza fra una pagina e un timeout.
     */
    async countActiveByEvent(tx?: Prisma.TransactionClient): Promise<Map<number, number>> {
        return this.exec(async () => {
            const rows = await this.getDelegate(tx).groupBy({
                by: ["eventId"],
                where: { deleted: false, status: { in: ACTIVE_REGISTRATION_STATUSES } },
                _count: { _all: true },
            });
            return new Map(rows.map(r => [r.eventId, r._count._all]));
        });
    }

    /** §1.5 — lo scope passa dall'evento. */
    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.RegistrationWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<Registration | null> {
        return this.findOne({ AND: [query, relationOrganizationScopeWhere(scope, "event")] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.RegistrationWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<Registration>> {
        return this.paginate({ AND: [query, relationOrganizationScopeWhere(scope, "event")] }, options, tx);
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<Registration> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
