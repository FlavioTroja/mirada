import { getPrismaClient } from "@utils/adapters/prisma";
import { Service } from "fastify-decorators";
import { provide } from "inversify-binding-decorators";
import { HiddenComponentConfig, Prisma } from "@prisma/client";
import { HiddenComponentDTO } from "@DTOs/hidden_component_config/HiddenComponentDTO";
import { HiddenComponentConfigUpdateDTO } from "@DTOs/hidden_component_config/HiddenComponentConfigUpdateDTO";
import { BaseRepository } from "@repositories/BaseRepository";

@Service()
@provide(HiddenComponentConfigRepository)
export class HiddenComponentConfigRepository extends BaseRepository<"hiddenComponentConfig"> {

    constructor() {
        super("hiddenComponentConfig");
    }

    public async findHiddenComponentsForRolesCombination(userId: number): Promise<Array<HiddenComponentDTO>> {
        const query: string = `
            SELECT DISTINCT h.context, h.section, h.component
                FROM "HiddenComponentConfig" h
                WHERE h."isActive" = true
                AND h."roleName" IN (
                    SELECT rtu."roleName"
                    FROM "User" u
                    JOIN "RoleToUser" rtu on u.id = rtu."userId"
                    where "userId" = ${userId}
                    )
                AND (
                    SELECT COUNT(DISTINCT hh."roleName")
                        FROM "HiddenComponentConfig" hh
                        WHERE hh.context = h.context
                        AND hh.section = h.section
                        AND hh.component = h.component
                        AND hh."isActive" = true
                        AND hh."roleName" = h."roleName"
                ) = (SELECT COUNT(DISTINCT rtu2."id")
                        FROM "User" u2
                        JOIN "RoleToUser" rtu2 on u2.id = rtu2."userId"
                        WHERE u2."id" = ${userId});
        `;

        return this.exec(() =>
            getPrismaClient().$transaction(async prisma => {
                return prisma.$queryRawUnsafe(query);
            })
        );
    }

    public async findById(id: number, tx?: Prisma.TransactionClient): Promise<HiddenComponentConfig> {
        return this.exec(() =>
            (this.getDelegate(tx) as any).findUniqueOrThrow({ where: { id } })
        );
    }

    public async updateById(id: number, dto: HiddenComponentConfigUpdateDTO, tx?: Prisma.TransactionClient): Promise<HiddenComponentConfig> {
        return this.exec(() =>
            (this.getDelegate(tx) as any).update({
                where: { id },
                data: dto
            })
        );
    }

}