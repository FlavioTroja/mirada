import { getInstanceByToken } from "fastify-decorators";
import { CronJob } from "@utils/adapters/cron/CronJob";
import { Log } from "@utils/adapters/log";
import { OrderReservationService } from "@services/OrderReservationService";

/**
 * # Lo scheduler delle prenotazioni scadute — backend-brief §4.11, `RF-PAY-24`
 *
 * *«Un processo periodico recupera le prenotazioni **scadute e non rilasciate** e
 * ne libera i consumi. Senza di esso, in apertura vendite i posti restano
 * bloccati da ordini abbandonati: è il rischio `R1b`, dichiarato.»*
 *
 * Non è un caso limite: è ciò che accade **ogni volta** che qualcuno chiude una
 * scheda. Quindici minuti dopo, quel posto risulta ancora occupato da nessuno, e
 * in apertura vendite bastano poche decine di carrelli abbandonati per far
 * apparire esaurito un evento che ha ancora posti.
 *
 * ── Ogni minuto, e non di più ────────────────────────────────────────────────
 * La granularità della prenotazione è il minuto e la sua durata è quindici: una
 * passata al minuto restituisce il posto entro sessanta secondi dalla scadenza,
 * che è il ritardo massimo tollerabile in apertura vendite. Più spesso
 * significherebbe interrogare la tabella senza che nulla sia scaduto nel
 * frattempo.
 *
 * ── Il lotto, non l'arretrato ────────────────────────────────────────────────
 * La passata lavora a **lotti** (`findExpiredUnreleased` è `LIMIT`ata e ordinata
 * per scadenza crescente) e apre **una transazione per prenotazione**: una
 * passata non diventa mai una transazione lunga quanto l'arretrato di una notte,
 * che terrebbe i lock sulle quote proprio mentre le vendite riaprono.
 *
 * ── La rotta manuale ─────────────────────────────────────────────────────────
 * `POST /api/cron/release-expired-reservations` esegue **lo stesso metodo**
 * (nota 7 del §3.10). Un job che si potesse lanciare solo aspettando non sarebbe
 * collaudabile.
 */
export class ReservationExpiryJob extends CronJob {
    static override readonly jobName = "release-expired-reservations";

    /** Ogni minuto. Vedi la nota sulla granularità. */
    static override readonly cronTime = "* * * * *";

    protected static override async tick(): Promise<void> {
        const service = getInstanceByToken<OrderReservationService>(OrderReservationService);
        const outcome = await service.releaseExpired();

        if (outcome.released) {
            Log.info(
                `[ReservationExpiry Handler]: released ${outcome.released} of ${outcome.examined} expired `
                + `reservation(s), freeing ${outcome.releasedRegistrations} registration(s)`,
            );
        }
    }
}
