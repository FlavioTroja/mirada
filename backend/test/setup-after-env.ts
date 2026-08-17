import "tsconfig-paths/register";
import "reflect-metadata";
import { getPrismaClient, initializePrismaClient } from "@utils/adapters/prisma";
import { seed } from "./seed-test";
import { cancelAllAvailabilityWindows } from "@services/AvailabilityBroadcastService";

/**
 * Il limite di tempo del gancio qui sotto.
 *
 * ── Perché non basta quello di serie ─────────────────────────────────────────
 * Jest concede 15 secondi a un gancio, ed è una misura pensata per una funzione
 * che prepara qualche oggetto in memoria. Questo gancio invece **svuota e
 * ripopola un Postgres vero**, una volta per ogni file di test: misurato su
 * questa macchina a riposo impiega fra 5,7 e 7,4 secondi.
 *
 * Un margine di sette secondi sembra ampio e non lo è: le suite girano in serie
 * sulla stessa istanza, e basta un file che lascia connessioni da chiudere o un
 * po' di contesa sul disco perché il gancio superi la soglia. Il risultato è la
 * modalità di guasto peggiore da diagnosticare — **suite diverse rosse a ogni
 * esecuzione, senza una sola asserzione fallita**, solo `Exceeded timeout`.
 *
 * Alzare il limite non nasconde un difetto: non c'è niente in un truncate più
 * seed che debba stare in quindici secondi, e il valore di serie non è mai stato
 * scelto pensando a questo gancio. Se un giorno il seed sforasse anche questo
 * limite, sarebbe una notizia vera — non un rumore di fondo.
 */
const SEED_TIMEOUT_MS = 120_000;

/**
 * Runs before each test file.
 * When SEED_TEST=true, re-seeds the database so every suite starts from a known state.
 * When SEED_TEST is not true, the database is left as-is between suites.
 */
beforeAll(async () => {
    await initializePrismaClient();

    if (process.env.SEED_TEST === "true") {
        await seed(getPrismaClient());
    }
}, SEED_TIMEOUT_MS);

afterAll(async () => {
    // La finestra di aggregazione di `event/availability-changed` è ~1,5 s: senza
    // questa chiusura un timer aperto dall'ultimo test scadrebbe DOPO il
    // `$disconnect()` e proverebbe a leggere i destinatari su una connessione
    // chiusa, sporcando il file successivo con errori Prisma fuori contesto.
    cancelAllAvailabilityWindows();
    await getPrismaClient().$disconnect();
});
