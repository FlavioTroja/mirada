import { Service } from "fastify-decorators";
import { PaymentInstalment, Prisma } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";

@Service()
export class PaymentInstalmentRepository extends BaseRepository<"paymentInstalment"> {

    constructor() {
        super("paymentInstalment");
    }

    /** Il piano di un'iscrizione, nell'ordine in cui è stato concordato. */
    async findByRegistration(
        registrationId: number,
        tx?: Prisma.TransactionClient,
    ): Promise<PaymentInstalment[]> {
        return this.findMany(
            { registrationId, deleted: false },
            { orderBy: [{ dueAt: "asc" }, { sortOrder: "asc" }] },
            tx,
        );
    }

    /**
     * Cancellazione **reale** delle rate di un piano riscritto.
     *
     * È l'eccezione al soft delete di questo repository, e per una ragione
     * precisa: `RB35` impone che la somma delle rate sia il dovuto, e una riga
     * cancellata a metà continuerebbe a comparire in ogni conteggio che non si
     * ricordi di filtrare `deleted`. Un piano è una previsione, non una traccia
     * contabile: riscriverlo lo sostituisce.
     *
     * I versamenti — che sono i fatti — non si toccano: stanno su
     * `BalanceSettlement` e non hanno alcun legame con queste righe (§3.3).
     */
    /**
     * **Quanto era atteso entro una data, per iscrizione.**
     *
     * Restituisce l'aggregazione e basta: il confronto con il versato lo fa il
     * servizio, perché il versato sta su `Registration` e un repository non
     * interroga il modello di un altro (regola 3 di `repositories.md`).
     *
     * ⚠️ Non esiste, e non deve esistere, una colonna «in ritardo». Sarebbe il
     * terzo posto in cui vive la stessa verità (`RB34`), e in più andrebbe
     * ricalcolata **al passare del tempo**: una rata scade da sola, senza che
     * nessuno scriva nulla, quindi quella colonna sarebbe sbagliata ogni notte a
     * mezzanotte finché qualcosa non la aggiorna.
     */
    async sumDueByRegistration(
        now = new Date(),
        tx?: Prisma.TransactionClient,
    ): Promise<Map<number, number>> {
        const rows = await this.exec(() =>
            (this.getDelegate(tx) as Prisma.PaymentInstalmentDelegate).groupBy({
                by: ["registrationId"],
                where: { deleted: false, dueAt: { lte: now } },
                _sum: { amount: true },
            }),
        );
        return new Map(rows.map(row => [row.registrationId, row._sum.amount ?? 0]));
    }

    async deleteByRegistration(registrationId: number, tx?: Prisma.TransactionClient): Promise<number> {
        const result = await this.exec(() =>
            (this.getDelegate(tx) as Prisma.PaymentInstalmentDelegate).deleteMany({
                where: { registrationId },
            }),
        );
        return result.count;
    }
}
