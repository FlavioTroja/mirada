import { configureServiceTest } from "fastify-decorators/testing";
import { DeclaredDanceRole } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";
import { ActivityService } from "@services/ActivityService";
import { createEventScenario, createRegistration } from "../fixtures/capacity";
import { createCheckIn, createTicketFor } from "../fixtures/tickets";

/**
 * Le righe d'attività dei percorsi caldi — `21-dashboard.md` §4. Lì si chiamano
 * senza aspettarle (la porta non attende la Dashboard), quindi qui si provano
 * direttamente: che frase compongono, e per quale organizzazione.
 */
describe("ActivityService — i percorsi caldi", () => {
    let activity: ActivityService;
    const prisma = () => getPrismaClient();

    beforeAll(async () => {
        activity = await configureServiceTest({ service: ActivityService });
    });

    const latest = (organizationId: number) =>
        prisma().activity.findFirstOrThrow({ where: { organizationId }, orderBy: { id: "desc" } });

    it("un ingresso diventa «Ingresso di <chi> · <dove>»", async () => {
        const scenario = await createEventScenario({ sessions: 1 });
        await prisma().session.update({ where: { id: scenario.sessionIds[0]! }, data: { name: { it: "Milonga di gala" } } });
        const { ticket, registrationId } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            holderName: "Sara",
            holderSurname: "Pugliese",
        });
        const operator = await prisma().user.findFirstOrThrow({ where: { username: "god" } });
        const checkIn = await createCheckIn({ ticketId: ticket.id, sessionId: scenario.sessionIds[0]!, registrationId, operatorUserId: operator.id });

        await activity.checkIn(scenario.event.id, scenario.sessionIds[0]!, { reason: "SCANNED", checkInId: checkIn.id });

        expect(await latest(scenario.organizationId)).toMatchObject({
            kind: "CHECK_IN",
            staff: false,
            text: "Ingresso di Sara Pugliese · Milonga di gala",
        });
    });

    it("un carrello da molte persone è una riga sola, non una per persona", async () => {
        const scenario = await createEventScenario({ sessions: 0 });
        await prisma().event.update({ where: { id: scenario.event.id }, data: { title: { it: "Tango Festival Bari" } } });
        const ids: number[] = [];
        for (let i = 0; i < 5; i += 1) {
            ids.push((await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.LEADER })).id);
        }
        const before = await prisma().activity.count({ where: { organizationId: scenario.organizationId } });

        await activity.registrationsCreated({ id: scenario.event.id, organizationId: scenario.organizationId }, ids);

        expect(await prisma().activity.count({ where: { organizationId: scenario.organizationId } })).toBe(before + 1);
        expect((await latest(scenario.organizationId)).text).toBe("5 nuove iscrizioni a Tango Festival Bari");
    });

    it("un incasso porta l'importo in centesimi e la cifra in euro nella frase", async () => {
        const scenario = await createEventScenario({ sessions: 0 });
        await prisma().event.update({ where: { id: scenario.event.id }, data: { title: { it: "Tango Festival Bari" } } });

        await activity.balanceSettled(
            { id: 1, eventId: scenario.event.id, holderName: "Davide", holderSurname: "Greco" },
            7_050,
            false,
        );

        const row = await latest(scenario.organizationId);
        expect(row.kind).toBe("PAYMENT");
        expect(row.amount).toBe(7_050);
        expect(row.text).toBe("Saldo di 70,50\u00a0€ incassato alla cassa · Davide Greco, Tango Festival Bari");
    });
});
