import "dotenv/config";
import "module-alias/register";
import "reflect-metadata";

import { APIServer } from "./server";
import { initializePrismaClient } from "@utils/adapters/prisma";
import { Log } from "@utils/adapters/log";
import { seed } from "../prisma/seed";

async function start() {
    const prismaClient = await initializePrismaClient();

    if (process.env.SEED_DB === "true") {
        await seed(prismaClient);
    }


    const apiServer = new APIServer();
    await apiServer.start();

    const graceful = async () => {
        // Stop accepting work first, then tear down the broker and DB connections.
        await apiServer.stop();
        await prismaClient.$disconnect();
        process.exit(0);
    };

    // Stop graceful
    process.on("SIGTERM", graceful);
    process.on("SIGINT", graceful);
}

start()
    .catch(err => {
        Log.error(`Couldn't start server: ${err.message} ${err.stack}`);
        process.exit(-1);
    });
