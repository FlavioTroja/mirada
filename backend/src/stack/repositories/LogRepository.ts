import { Service } from "fastify-decorators";
import { Log, Prisma } from "@prisma/client";
import { provide } from "inversify-binding-decorators";
import { BaseRepository } from "@repositories/BaseRepository";
import { RecipientDTO } from "@DTOs/log/RecipientDTO";

@Service()
@provide(LogRepository)
export class LogRepository extends BaseRepository<"log"> {

    constructor() {
        super("log");
    }

    async findById(id: number, tx?: Prisma.TransactionClient): Promise<Log> {
        return this.exec(() =>
            this.getDelegate(tx).findUniqueOrThrow({
                where: { id: id },
            })
        )
    }

    async findManyNotReadByRecipient(userId: number, tx?: Prisma.TransactionClient): Promise<Log[]> {
        return this.exec(() =>
            this.getDelegate(tx).findMany({
                where: {
                    recipients: {
                        array_contains: [ { userId: userId, isRead: false } ],
                    }
                }
            })
        );
    }

    async updateRecipients(id: number, recipients: RecipientDTO[], tx?: Prisma.TransactionClient): Promise<Log> {
        return this.exec(() =>
            this.getDelegate(tx).update({
                where: { id: id },
                data: { recipients: recipients }
            })
        );
    }

    async markAllReadByUser(userId: number, tx?: Prisma.TransactionClient): Promise<void> {
        const logs = await this.findManyNotReadByRecipient(userId, tx);
        for (const log of logs) {
            const recipients = (log.recipients as RecipientDTO[]).map(recipient =>
                recipient.userId === userId ? { ...recipient, isRead: true } : recipient
            );
            await this.updateRecipients(log.id, recipients, tx);
        }
    }

}
