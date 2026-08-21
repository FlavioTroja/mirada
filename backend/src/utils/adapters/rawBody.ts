import { FastifyRequest } from "fastify";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { FastifyApplication } from "../../../types";

/**
 * Il corpo grezzo delle notifiche dei canali di vendita — fase E.
 *
 * ── Il problema, e perché non ha un sintomo ─────────────────────────────────
 * La firma di un webhook è un HMAC calcolato **sui byte** che il prestatore ha
 * spedito. Fastify, come ogni framework, consegna al gestore un oggetto già
 * analizzato: da lì i byte originali non si ricostruiscono. `JSON.stringify` di
 * ciò che è stato analizzato produce **byte diversi** — ordine delle chiavi,
 * spaziatura, sequenze di escape dei caratteri non ASCII — e quindi una firma
 * diversa.
 *
 * Il guasto non somiglia a un guasto: le notifiche cominciano semplicemente a
 * essere rifiutate **tutte**, il prestatore riprova per qualche ora e poi
 * disattiva la sottoscrizione. Nessuna eccezione, nessuna riga rossa: le vendite
 * smettono di arrivare.
 *
 * ── Perché solo su quelle rotte ─────────────────────────────────────────────
 * Trattenere il corpo grezzo di **ogni** richiesta significa tenere in memoria
 * una seconda copia di ogni caricamento e di ogni corpo di ricerca. Il costo si
 * paga dove serve, e serve sulle sole rotte firmate.
 */

/**
 * Prefisso delle rotte che ricevono notifiche firmate. **Deve restare allineato
 * alla rotta di `SalesChannelController`**: se le due stringhe divergono, la
 * verifica della firma smette di funzionare senza che nulla fallisca — che è
 * esattamente il guasto descritto sopra.
 */
export const SIGNED_WEBHOOK_PATH_PREFIX = "/api/sales-channels/webhook/";

/** Il corpo grezzo trattenuto, se questa richiesta è su una rotta firmata. */
export function readRawBody(req: FastifyRequest): Buffer {
    const raw = (req as FastifyRequest & { rawBody?: Buffer }).rawBody;
    if (!raw) {
        // Irraggiungibile finché il prefisso qui sopra e la rotta del controller
        // dicono la stessa cosa. Esiste perché il giorno in cui non la diranno,
        // la richiesta fallisca **rumorosamente** invece di rifiutare in silenzio
        // ogni firma per sempre.
        Log.error("[RawBody Adapter]: raw body requested on a route that does not capture it — check SIGNED_WEBHOOK_PATH_PREFIX");
        throw new httpErrors.InternalServerError("Corpo grezzo della notifica non disponibile.");
    }
    return raw;
}

/**
 * Sostituisce l'analizzatore JSON di Fastify con uno che, sulle sole rotte
 * firmate, trattiene i byte originali prima di analizzarli.
 *
 * Va registrato **prima** dei controller.
 */
export function registerRawBodyCapture(server: FastifyApplication): void {
    Log.info("Setup raw body capture for signed webhooks!");

    server.addContentTypeParser(
        "application/json",
        { parseAs: "buffer" },
        (req, body: Buffer, done) => {
            if (req.url?.startsWith(SIGNED_WEBHOOK_PATH_PREFIX)) {
                (req as typeof req & { rawBody?: Buffer }).rawBody = body;
            }

            if (!body.length) {
                // Corpo vuoto: `JSON.parse("")` solleva, e un `SyntaxError` qui
                // uscirebbe come 500. Un corpo assente è una richiesta senza
                // corpo, non un guasto del server.
                done(null, undefined);
                return;
            }

            try {
                done(null, JSON.parse(body.toString("utf8")));
            } catch (err) {
                done(new httpErrors.BadRequest(`Corpo JSON non valido: ${(err as Error).message}`), undefined);
            }
        },
    );
}
