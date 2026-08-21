import fastifyCron from "fastify-cron";
import { Log } from "@utils/adapters/log";
import { FastifyApplication } from "../../../../types";

/**
 * Le istanze su cui il plugin è già stato registrato.
 *
 * ⚠️ **`fastify-cron` decora l'istanza con `cron`, e Fastify rifiuta di essere
 * decorato due volte con lo stesso nome.** Registrare il plugin una volta per
 * job — che è ciò che questo file faceva finché i job erano uno solo — fa
 * fallire l'AVVIO al secondo: `FST_ERR_DEC_ALREADY_PRESENT`, e il processo
 * esce. Misurato aggiungendo `reconcile-sales-channels` accanto a
 * `release-expired-reservations`.
 *
 * Un `WeakSet` sull'istanza e non un booleano di modulo: la suite di test
 * costruisce più `APIServer` nello stesso processo, e una bandiera globale
 * farebbe saltare la registrazione sulla **seconda** istanza — che si
 * ritroverebbe senza `cron` e senza alcun job, in silenzio.
 */
const withPlugin = new WeakSet<FastifyApplication>();

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

        if (!withPlugin.has(server)) {
            // Registrato **senza job**: i job si aggiungono uno per uno qui
            // sotto, così ogni classe resta padrona del proprio.
            server.register(fastifyCron, { jobs: [] });
            withPlugin.add(server);
        }

        // `after` e non una chiamata diretta: `server.cron` esiste solo quando
        // avvio ha finito di caricare il plugin, che non è ancora avvenuto nel
        // costruttore di `APIServer`.
        server.after(() => {
            server.cron.createJob({
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
            });
        });
    }
}
