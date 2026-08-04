import { config } from "dotenv";
config({ path: ".env.test" });
import "tsconfig-paths/register";
import "reflect-metadata";
import { initializePrismaClient, getPrismaClient } from "@utils/adapters/prisma";
import { seed } from "./seed-test";
import { APIServer } from "../src/server";

export default async function () {
    console.log(process.env.DATABASE_URL);
    const dbUrl = process.env.DATABASE_URL || "";
    // Safety check to prevent something bad to happen, comment this at your own risk
    if (!dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1")) {
        throw new Error(`DATABASE_URL does not point to localhost. Aborting tests to prevent accidental data loss. DATABASE_URL: ${dbUrl}`);
    }

    await initializePrismaClient();

    if (process.env.SEED_TEST === "true") {
        await seed(getPrismaClient());
    }

    const apiServer = new APIServer();
    const app = apiServer.instance;

    await app.ready();

    // La porta era cablata a 5000, la stessa su cui gira il server di sviluppo di
    // questo progetto: con `yarn dev` (o un `node dist/src/main.js` rimasto vivo)
    // la suite moriva in avvio con EADDRINUSE, prima di eseguire un solo test.
    // `TEST_HTTP_PORT` è dichiarata in `.env.test`; in sua assenza vale il 5000 di serie.
    const port = Number(process.env.TEST_HTTP_PORT ?? 5000);
    await apiServer.start("localhost", port, "test");

    (globalThis as any).__TEST_APP__ = app;
    (globalThis as any).__TEST_API_SERVER__ = apiServer;
}
