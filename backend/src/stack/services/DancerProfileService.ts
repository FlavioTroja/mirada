import { Service } from "fastify-decorators";
import { DancerProfile, Prisma } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { isGod } from "@utils/adapters/permission";
import { DancerProfileRepository } from "@repositories/DancerProfileRepository";
import { DancerProfileCreateDTO } from "@DTOs/dancer_profile/DancerProfileCreateDTO";
import { DancerProfileUpdateDTO } from "@DTOs/dancer_profile/DancerProfileUpdateDTO";
import { DancerProfileQueryDTO } from "@DTOs/dancer_profile/DancerProfileQueryDTO";

/**
 * Filtro automatico sul nickname (`RF-ACC-9`). È volutamente minimo e centralizzato:
 * il nickname è l'unico dato dell'autore che in fase 1b finirà proiettato su un
 * maxischermo, e il vincolo si costruisce adesso.
 */
const NICKNAME_PATTERN = /^[a-zA-Z0-9._-]{3,24}$/;
const NICKNAME_BLOCKLIST = ["admin", "god", "mirada", "staff", "support", "root"];

@Service()
export class DancerProfileService {
    constructor(private readonly dancerProfileRepository: DancerProfileRepository) {}

    public async save(principalId: number, dto: DancerProfileCreateDTO): Promise<DancerProfile> {
        Log.info(`[DancerProfile Service]: creating dancer profile for user (id ${principalId})`);

        const existing = await this.dancerProfileRepository.findByUserId(principalId);
        if (existing) {
            Log.warn(`[DancerProfile Service]: user (id ${principalId}) already owns a dancer profile (id ${existing.id})`);
            throw new httpErrors.BadRequest("Questo utente ha già un profilo da ballerino.");
        }

        await this.assertNicknameAvailable(dto.nickname);

        const profile = await this.dancerProfileRepository.save({ ...dto, userId: principalId });
        Log.info(`[DancerProfile Service]: dancer profile created '${profile.nickname}' (id ${profile.id})`);
        return profile;
    }

    /**
     * `DANCER_PROFILE` è concesso al solo `DANCER` con scope `#OWN` (§3.8): fuori
     * da `GOD` un utente vede e tocca esclusivamente il proprio profilo. È lo stesso
     * principio di isolamento del §1.5, applicato alla persona anziché all'organizzazione.
     */
    public async findById(principalId: number, id: number, options?: FindOptions): Promise<DancerProfile | null> {
        return this.dancerProfileRepository.findOne(
            { id, deleted: false, ...(await this.ownershipWhere(principalId)) },
            options,
        );
    }

    public async findByUserId(userId: number, options?: FindOptions): Promise<DancerProfile | null> {
        return this.dancerProfileRepository.findByUserId(userId, options);
    }

    public async paginate(
        principalId: number,
        query: DancerProfileQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<DancerProfile>> {
        const ownership = await this.ownershipWhere(principalId);
        return this.dancerProfileRepository.paginate(
            { AND: [this.createQueryFromPayload(query), ownership] },
            options,
        );
    }

    private async ownershipWhere(principalId: number): Promise<Prisma.DancerProfileWhereInput> {
        return (await isGod(principalId)) ? {} : { userId: principalId };
    }

    /**
     * `nickname` è ammesso nel DTO ma non è un aggiornamento come gli altri: passa dal
     * filtro e incrementa `nicknameChangeCount` con la data del cambio (§4.3, `RF-ACC-9`).
     */
    public async updateById(principalId: number, id: number, dto: DancerProfileUpdateDTO): Promise<DancerProfile> {
        const profile = await this.findByIdOrThrow(principalId, id);

        const isNicknameChanging = !!dto.nickname && dto.nickname !== profile.nickname;
        if (isNicknameChanging) {
            await this.assertNicknameAvailable(dto.nickname!);
            Log.info(`[DancerProfile Service]: changing nickname of dancer profile (id ${id}) from '${profile.nickname}' to '${dto.nickname}'`);
        }

        Log.info(`[DancerProfile Service]: updating dancer profile (id ${id})`);
        return this.dancerProfileRepository.update(
            { id },
            {
                ...dto,
                ...(isNicknameChanging
                    ? {
                        nicknameChangedAt: new Date(),
                        nicknameChangeCount: profile.nicknameChangeCount + 1,
                    }
                    : {}),
            },
        );
    }

    public async safeDeleteById(principalId: number, id: number): Promise<DancerProfile> {
        await this.findByIdOrThrow(principalId, id);
        Log.info(`[DancerProfile Service]: soft deleting dancer profile (id ${id})`);
        return this.dancerProfileRepository.safeDeleteById(id);
    }

    private async assertNicknameAvailable(nickname: string): Promise<void> {
        if (!NICKNAME_PATTERN.test(nickname)) {
            throw new httpErrors.BadRequest(
                "Il nickname può contenere solo lettere, numeri, punto, trattino e underscore, da 3 a 24 caratteri.",
            );
        }

        if (NICKNAME_BLOCKLIST.includes(nickname.toLowerCase())) {
            throw new httpErrors.BadRequest("Questo nickname non è disponibile.");
        }

        const taken = await this.dancerProfileRepository.findByNickname(nickname);
        if (taken) {
            Log.warn(`[DancerProfile Service]: nickname '${nickname}' already taken (id ${taken.id})`);
            throw new httpErrors.BadRequest("Questo nickname è già in uso.");
        }
    }

    private async findByIdOrThrow(principalId: number, id: number): Promise<DancerProfile> {
        const profile = await this.findById(principalId, id);
        if (!profile) {
            Log.warn(`[DancerProfile Service]: dancer profile (id ${id}) not found`);
            throw new httpErrors.NotFound("Profilo da ballerino non trovato.");
        }
        return profile;
    }

    private createQueryFromPayload(payload: DancerProfileQueryDTO): Prisma.DancerProfileWhereInput {
        const valueQuery: Prisma.DancerProfileWhereInput[] = [
            createObjectWithoutThrow(payload.value, { nickname: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(payload.value, { city: { contains: payload.value, mode: "insensitive" } }),
        ].filter(o => Object.values(o).length > 0);

        const query: Prisma.DancerProfileWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(valueQuery.length, { OR: valueQuery }),
            createObjectWithoutThrow(payload.preferredRole?.length, { preferredRole: { in: payload.preferredRole } }),
            createObjectWithoutThrow(payload.city, { city: { equals: payload.city, mode: "insensitive" } }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
