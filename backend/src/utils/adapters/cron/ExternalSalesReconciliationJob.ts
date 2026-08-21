import { getInstanceByToken } from "fastify-decorators";
import { CronJob } from "@utils/adapters/cron/CronJob";
import { Log } from "@utils/adapters/log";
import { SalesChannelService } from "@services/SalesChannelService";

/**
 * # La riconciliazione dei canali di vendita esterni — fase E
 *
 * ── Perché esiste, se c'è già il webhook ────────────────────────────────────
 * Perché i webhook si perdono, e non lo dicono. Il backend fermo dieci minuti
 * per un aggiornamento, una rete che cade, il prestatore che dopo una serie di
 * consegne fallite **disattiva la sottoscrizione**: in tutti e tre i casi quelle
 * vendite non tornano più da sole, e l'unica traccia che qualcosa manca è la
 * persona che si presenta all'ingresso senza biglietto.
 *
 * Il webhook è la verità immediata, questa passata è la verità definitiva. Non
 * sono due strade alternative: sono due ruoli diversi, e servono entrambi.
 *
 * ── Ogni dieci minuti, e non di più ─────────────────────────────────────────
 * La passata **interroga un servizio di terzi** per ogni canale attivo, e ogni
 * negozio ha un tetto di richieste al minuto che vale per l'intero negozio: una
 * frequenza più alta consumerebbe la quota dell'organizzatore per rileggere
 * quasi sempre nulla. Dieci minuti è il ritardo massimo con cui una vendita
 * perduta si recupera, e per una vendita che il webhook ha già mancato è un
 * ritardo che nessuno nota.
 *
 * ── Due passate, in quest'ordine ────────────────────────────────────────────
 * Prima si **riprende** ciò che è già in casa e non è stato elaborato: non costa
 * nulla, non chiede niente a nessuno, e può risolversi da solo. Poi si
 * **interroga** il negozio per ciò che non è mai arrivato. L'ordine inverso
 * chiederebbe fuori ciò che si aveva già dentro.
 *
 * ── La rotta manuale ────────────────────────────────────────────────────────
 * `POST /api/cron/reconcile-sales-channels` esegue **gli stessi metodi**. Un job
 * che si potesse lanciare solo aspettando non sarebbe collaudabile — ed è anche
 * il tasto che si preme quando un organizzatore telefona dicendo «ho venduto e
 * non lo vedo».
 */
export class ExternalSalesReconciliationJob extends CronJob {
    static override readonly jobName = "reconcile-sales-channels";

    /** Ogni dieci minuti. Vedi la nota sulla frequenza. */
    static override readonly cronTime = "*/10 * * * *";

    protected static override async tick(): Promise<void> {
        const service = getInstanceByToken<SalesChannelService>(SalesChannelService);

        const retried = await service.retryPending();
        const reconciled = await service.reconcile();

        if (retried.ingested || reconciled.salesIngested || reconciled.failures) {
            Log.info(
                `[ExternalSalesReconciliation Handler]: recovered ${retried.ingested} pending and `
                + `${reconciled.salesIngested} unseen sale(s) across ${reconciled.channelsExamined} channel(s) — `
                + `${reconciled.failures} channel(s) unreachable`,
            );
        }
    }
}
