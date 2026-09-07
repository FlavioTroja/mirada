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
    async deleteByRegistration(registrationId: number, tx?: Prisma.TransactionClient): Promise<number> {
        const result = await this.exec(() =>
            (this.getDelegate(tx) as Prisma.PaymentInstalmentDelegate).deleteMany({
                where: { registrationId },
            }),
        );
        return result.count;
    }
}
