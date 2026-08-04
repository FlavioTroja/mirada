import { Service } from "fastify-decorators";
import { BaseRepository } from "@repositories/BaseRepository";
import { Address, Prisma } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";

@Service()
export class AddressRepository extends BaseRepository<"address"> {

    constructor() {
        super("address");
    }

    /**
     * Quante righe puntano ancora a questo indirizzo. `Venue.addressId` è
     * obbligatorio e `Restrict`: cancellare un indirizzo in uso lascerebbe una
     * sala priva del suo dato richiesto (§3.4).
     */
    async countReferences(id: number, tx?: Prisma.TransactionClient): Promise<{ venues: number; organizations: number }> {
        const client = tx ?? getPrismaClient();
        return this.exec(async () => {
            const [venues, organizations] = await Promise.all([
                client.venue.count({ where: { addressId: id } }),
                client.organization.count({ where: { addressId: id } }),
            ]);
            return { venues, organizations };
        });
    }

    async findDistinctCities(): Promise<Address[]> {
        return this.exec(() =>
            (this.delegate as any).findMany({
                where: {
                    city: {
                        not: ""
                    },
                },
                distinct: ["city"]
            })
        );
    }
}
