import { Service } from "fastify-decorators";
import { Log } from "@utils/adapters/log";
import { OrganizationMemberRepository } from "@repositories/OrganizationMemberRepository";
import { UserRepository } from "@repositories/UserRepository";

/**
 * Risolve i destinatari WebSocket di un'organizzazione — backend-brief §3.9.
 *
 * Esiste per una ragione sola e vincolante: **si usa solo `sendToUser` per
 * `wsCode`, mai `broadcastToRoles`**. Un broadcast per ruolo farebbe arrivare a
 * ogni `OWNER` della piattaforma i segnali delle organizzazioni altrui, che è
 * esattamente l'isolamento che il prodotto deve garantire (§1.5). Il backend
 * risolve quindi i membri dell'organizzazione e invia a ciascuno.
 */
@Service()
export class OrganizationAudienceService {
    constructor(
        private readonly organizationMemberRepository: OrganizationMemberRepository,
        private readonly userRepository: UserRepository,
    ) {}

    /** I `wsCode` dei membri attivi dell'organizzazione. Chi non ha `wsCode` non è raggiungibile e viene escluso. */
    public async resolveMemberWsCodes(organizationId: number): Promise<string[]> {
        const members = await this.organizationMemberRepository.findMany({
            organizationId,
            deleted: false,
        });

        const userIds = [...new Set(members.map(member => member.userId))];
        if (!userIds.length) {
            Log.debug(`[OrganizationAudience Service]: organization (id ${organizationId}) has no member to notify`);
            return [];
        }

        const users = await this.userRepository.findMany({
            id: { in: userIds },
            deleted: false,
            enabled: true,
        });

        const wsCodes = users.map(user => user.wsCode).filter((code): code is string => !!code);

        Log.debug(
            `[OrganizationAudience Service]: organization (id ${organizationId}) resolved to `
            + `${wsCodes.length} reachable wsCode(s) out of ${userIds.length} member(s)`,
        );
        return wsCodes;
    }
}
