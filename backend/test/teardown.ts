import { getPrismaClient } from "@utils/adapters/prisma";
import { cancelAllAvailabilityWindows } from "@services/AvailabilityBroadcastService";
import { APIServer } from "../src/server";

export default async function () {
    const apiServer: APIServer = (globalThis as any).__TEST_API_SERVER__;

    // La finestra di aggregazione di `event/availability-changed` è ~1,5 s (§3.9):
    // un timer aperto dall'ultima richiesta scadrebbe DOPO la chiusura del client
    // Prisma e proverebbe a risolvere i destinatari su una connessione già chiusa.
    // Questo teardown vive nello stesso registro di moduli dell'app di test, quindi
    // raggiunge le finestre aperte dai controller; `setup-after-env.ts` fa lo stesso
    // per quelle aperte dai test di servizio.
    cancelAllAvailabilityWindows();

    if (apiServer) {
        await apiServer.stop();
    }
    await getPrismaClient().$disconnect();
}
