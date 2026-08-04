import { BaseRepository } from "@repositories/BaseRepository";
import { Service } from "fastify-decorators";

@Service()
export class RoleToUserRepository extends BaseRepository<"roleToUser"> {
    constructor() {
        super("roleToUser");
    }
}