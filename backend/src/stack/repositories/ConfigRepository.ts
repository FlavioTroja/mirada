import { Service } from "fastify-decorators";
import { provide } from "inversify-binding-decorators";
import { BaseRepository } from "@repositories/BaseRepository";

@Service()
@provide(ConfigRepository)
export class ConfigRepository extends BaseRepository<"config"> {

    constructor() {
        super("config");
    }

}