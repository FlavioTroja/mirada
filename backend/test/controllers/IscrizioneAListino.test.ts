import { DeclaredDanceRole, QuotaScope, RegistrationChannel, RegistrationStatus } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";
import { login } from "../helpers";
import { createEventScenario, createQuota, readConsumed } from "../fixtures/capacity";

const app = (globalThis as any).__TEST_APP__;

let sequence = 0;
const unique = (prefix: string) => `${prefix}${Date.now().toString(36)}${++sequence}`;

/**
 * **L'iscrizione a listino dal back-office** — `POST /api/registrations/enrol`,
 * `15-corsi.md` §3.
 *
 * È la via della segreteria, e porta addosso tre garanzie che non si vedono
 * guardando il modulo:
 *
 *  1. **il prezzo lo decide il server**, sempre e solo dal listino;
 *  2. **la capienza si impegna**, o le quote per ruolo sono una cifra falsa;
 *  3. **una classe piena avvisa, non rifiuta** (`RB30`).
 */
describe("L'iscrizione a listino (back-office)", () => {
    const prisma = () => getPrismaClient();

    async function iscrivi(god: string, body: Record<string, unknown>) {
        return app.inject({
            method: "POST",
            url: "/api/registrations/enrol",
            headers: { authorization: god },
            payload: body,
        });
    }

    function allievo(extra: Record<string, unknown> = {}) {
        const tag = unique("allievo");
        return {
            holderName: "Marta",
            holderSurname: "Conti",
            holderEmail: `${tag}@test.it`,
            declaredRole: DeclaredDanceRole.FOLLOWER,
            ...extra,
        };
    }

    it("crea un'iscrizione confermata con il dovuto preso DAL LISTINO", async () => {
        const god = await login(app, "god", "god");
        const scenario = await createEventScenario();

        const res = await iscrivi(god, {
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            ...allievo(),
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();

        // 9.000 centesimi è il `basePrice` del titolo nel fixture: la cifra viene
        // da lì e da nessun'altra parte.
        expect(body.dueAmount).toBe(9_000);

        const reg = await prisma().registration.findUniqueOrThrow({ where: { id: body.registration.id } });
        expect(reg.status).toBe(RegistrationStatus.CONFIRMED);
        expect(reg.channel).toBe(RegistrationChannel.DOOR_SALE);
        // Il dovuto NASCE qui e non si muove più; il versato parte da zero.
        expect(reg.balanceDueAmount).toBe(9_000);
        expect(reg.balanceSettledAmount).toBe(0);
    });

    it("ignora un importo mandato dal client: il prezzo non arriva mai da fuori", async () => {
        const god = await login(app, "god", "god");
        const scenario = await createEventScenario();

        const res = await iscrivi(god, {
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            ...allievo(),
            // Non esiste nello schema: Zod lo scarta. Se un giorno qualcuno
            // aggiungesse il campo «per comodità», questa prova cadrebbe.
            amount: 1,
            balanceDueAmount: 1,
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().dueAmount).toBe(9_000);
        const reg = await prisma().registration.findUniqueOrThrow({
            where: { id: res.json().registration.id },
        });
        expect(reg.balanceDueAmount).toBe(9_000);
    });

    it("IMPEGNA la capienza — senza, la classe risulta vuota mentre è piena", async () => {
        const god = await login(app, "god", "god");
        const scenario = await createEventScenario();
        const quota = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.EVENT,
            limit: 10,
        });

        expect(await readConsumed(quota.id)).toBe(0);

        const res = await iscrivi(god, {
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            ...allievo(),
        });
        expect(res.statusCode).toBe(200);

        // È la trappola del §3.3: `save()` non impegna, e un `enrol()` che si
        // dimenticasse la commit lascerebbe questo contatore a zero.
        expect(await readConsumed(quota.id)).toBe(1);
    });

    it("una classe piena AVVISA e lascia passare (`RB30`)", async () => {
        const god = await login(app, "god", "god");
        const scenario = await createEventScenario();
        const quota = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.EVENT,
            limit: 1,
            consumed: 1,
        });

        const res = await iscrivi(god, {
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            ...allievo(),
        });

        // Non 409: chi è allo sportello non dev'essere rifiutato dal software.
        // Decide l'insegnante, che sa se in sala ci sta un'altra coppia.
        expect(res.statusCode).toBe(200);
        expect(res.json().warnings.length).toBeGreaterThan(0);
        expect(await readConsumed(quota.id)).toBe(2);
    });

    it("NON emette biglietti: il check-in di un corso è fuori dal taglio", async () => {
        const god = await login(app, "god", "god");
        const scenario = await createEventScenario();

        const res = await iscrivi(god, {
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            ...allievo(),
        });

        const tickets = await prisma().ticket.count({
            where: { registrationId: res.json().registration.id },
        });
        expect(tickets).toBe(0);
    });

    it("CENSISCE l'allievo nell'anagrafica di piattaforma (`16` §3)", async () => {
        const god = await login(app, "god", "god");
        const scenario = await createEventScenario();
        const dati = allievo();

        const res = await iscrivi(god, {
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            ...dati,
        });

        const reg = await prisma().registration.findUniqueOrThrow({
            where: { id: res.json().registration.id },
            include: { person: { include: { contact: true, user: true } } },
        });
        expect(reg.personId).not.toBeNull();
        expect(reg.person!.contact.email).toBe(dati.holderEmail);
        // Censita, non registrata: nessun account, e nessun modo di entrare.
        expect(reg.person!.user).toBeNull();
    });

    it("rifiuta un titolo che appartiene a un ALTRO evento", async () => {
        const god = await login(app, "god", "god");
        const mio = await createEventScenario();
        const altrui = await createEventScenario();

        const res = await iscrivi(god, {
            eventId: mio.event.id,
            // Plausibile e sbagliato: darebbe un prezzo vero di un listino che non
            // c'entra, e impegnerebbe quote di un altro evento.
            ticketTypeId: altrui.ticketTypeId,
            ...allievo(),
        });

        expect(res.statusCode).toBe(400);
    });

    it("rifiuta la seconda iscrizione della stessa persona allo stesso evento (`RB31`)", async () => {
        const god = await login(app, "god", "god");
        const scenario = await createEventScenario();
        const dati = allievo();

        expect(
            (await iscrivi(god, {
                eventId: scenario.event.id,
                ticketTypeId: scenario.ticketTypeId,
                ...dati,
            })).statusCode,
        ).toBe(200);

        const seconda = await iscrivi(god, {
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            ...dati,
        });
        expect(seconda.statusCode).toBe(409);
    });

    it("il residuo si chiude dal registro di cassa, come un saldo alla porta", async () => {
        const god = await login(app, "god", "god");
        const scenario = await createEventScenario();

        const res = await iscrivi(god, {
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            ...allievo(),
        });
        const registrationId = res.json().registration.id;

        // È il punto del §4 di `15-corsi.md`: con `balanceDueAmount` valorizzato,
        // la cassa di `14` funziona così com'è. Nessun codice nuovo per il
        // pagamento — e le rate escono gratis, perché le righe possono essere molte.
        const primaRata = await app.inject({
            method: "POST",
            url: "/api/balance-settlements/create",
            headers: { authorization: god },
            payload: { registrationId, amount: 4_000, method: "CASH" },
        });
        expect(primaRata.statusCode).toBe(200);

        const dopo = await prisma().registration.findUniqueOrThrow({ where: { id: registrationId } });
        expect(dopo.balanceSettledAmount).toBe(4_000);
        expect(dopo.balanceDueAmount - dopo.balanceSettledAmount).toBe(5_000);
    });
});
