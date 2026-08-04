import { Prisma, User } from "@prisma/client";
import { Service } from "fastify-decorators";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { encryptPasswordSync } from "@utils/helpers/crypto";
import { BaseRepository } from "@repositories/BaseRepository";
import { getPopulateOptions } from "@utils/adapters/prisma";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";

@Service()
export class UserRepository extends BaseRepository<"user"> {
    constructor() {
        super("user");
    }

    async updatePasswordById(id: number, rawPassword: string): Promise<User | null> {
        return this.exec(() =>
            this.delegate.update({
                where: { id },
                data: {
                    password: encryptPasswordSync(rawPassword)
                }
            })
        );
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<User | null> {
        return this.exec(() =>
            this.getDelegate(tx).update({
                where: { id },
                data: {
                    deleted: true
                }
            })
        );
    }

    async paginateNotDeleted(query: Prisma.UserWhereInput, options: PaginateOptions, tx?: Prisma.TransactionClient): Promise<PaginateDatasourceDTO<User> | null> {
        return this.paginate({ ...query, deleted: false }, options, tx);
    }


    /**
     * **L'unico finder che restituisce l'hash della password.**
     *
     * Il client Prisma omette `User.password` a livello globale (§3.1): questo
     * metodo lo riaccende con `omit: { password: false }` perché il confronto
     * bcrypt del login non può farne a meno. Non usarlo per nient'altro — ogni
     * altra lettura di utente deve restare priva dell'hash.
     */
    async findOneForAuthentication(query: Prisma.UserWhereInput, options?: FindOptions, tx?: Prisma.TransactionClient) {
        return this.exec(() =>
            this.getDelegate(tx).findFirst({
                where: query,
                include: options?.populate ? getPopulateOptions(options.populate) : undefined,
                omit: { password: false },
            })
        ) as Promise<(User & { roles?: { roleName: string; isActive: boolean }[] }) | null>;
    }

    async findById(id: number, options?: FindOptions, tx?: Prisma.TransactionClient) {
        return this.exec(() =>
            this.getDelegate(tx).findUniqueOrThrow({
                where: { id },
                include: options?.populate ? getPopulateOptions(options.populate) : undefined,
            })
        )
    }
}
