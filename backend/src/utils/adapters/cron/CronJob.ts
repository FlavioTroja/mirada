import fastifyCron from "fastify-cron";
import { Log } from "@utils/adapters/log";
import { FastifyApplication } from "../../../../types";

export abstract class CronJob {
    static readonly jobName: string;
    static readonly cronTime: string;

    protected static async tick(): Promise<void> {
        throw new Error(`[CronJob][tick] not implemented`);
    }

    public static runJob(server: FastifyApplication): void {
        const jobName = this.jobName;
        const cronTime = this.cronTime;
        const tick = this.tick.bind(this);

        Log.info(`[CronJob][runJob] registering ${jobName} (${cronTime})`);
        server.register(fastifyCron, {
            jobs: [
                {
                    name: jobName,
                    cronTime,
                    startWhenReady: true,
                    onTick: async () => {
                        try {
                            await tick();
                        } catch (err) {
                            Log.error(`[cron][${jobName}] ${(err as Error).message}`);
                        }
                    },
                },
            ],
        });
    }
}
