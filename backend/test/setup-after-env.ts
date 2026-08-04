import "tsconfig-paths/register";
import "reflect-metadata";
import { getPrismaClient, initializePrismaClient } from "@utils/adapters/prisma";
import { seed } from "./seed-test";
import { cancelAllAvailabilityWindows } from "@services/AvailabilityBroadcastService";

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
});

afterAll(async () => {
    // La finestra di aggregazione di `event/availability-changed` è ~1,5 s: senza
    // questa chiusura un timer aperto dall'ultimo test scadrebbe DOPO il
    // `$disconnect()` e proverebbe a leggere i destinatari su una connessione
    // chiusa, sporcando il file successivo con errori Prisma fuori contesto.
    cancelAllAvailabilityWindows();
    await getPrismaClient().$disconnect();
});
