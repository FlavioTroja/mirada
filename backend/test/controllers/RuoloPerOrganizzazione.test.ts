import { getPrismaClient } from "@utils/adapters/prisma";
import { OrgMemberRole, RoleName } from "@prisma/client";
import { login } from "../helpers";
import { createEventScenario } from "../fixtures/capacity";
import { encryptPasswordSync } from "@utils/helpers/crypto";

const app = (globalThis as any).__TEST_APP__;

let sequence = 0;
const unique = (prefix: string) => `${prefix}${Date.now().toString(36)}${++sequence}`;

/**
 * **Un ruolo vale nell'organizzazione in cui è stato dato, non altrove.**
 *
 * ── Il difetto che queste prove chiudono ─────────────────────────────────────
 * Il ruolo di un'appartenenza (`OrganizationMember.role`) veniva copiato in
 * `RoleToUser`, che è **globale**, e il permesso si leggeva da lì. Lo scope era
 * l'insieme di **tutte** le organizzazioni dell'utente. Le due cose, ciascuna
 * corretta da sola, insieme davano questo:
 *
 *     Anna è OWNER della sua organizzazione A e dà una mano al festival di un
 *     collega come CHECKIN_OPERATOR dell'organizzazione B. Permessi da OWNER,
 *     scope {A, B}: può modificare gli eventi di B.
 *
 * Nel tango, dove gli organizzatori si aiutano a vicenda, è il caso normale.
 */
describe("Un ruolo vale solo nell'organizzazione in cui è stato dato", () => {
    const PASSWORD = "secret";
    const prisma = () => getPrismaClient();

    /** Anna: OWNER di A, CHECKIN_OPERATOR di B — i ruoli globali come li scriveva `OrganizationMemberService`. */
    async function anna() {
        const a = await createEventScenario();
        const b = await createEventScenario();
        const tag = unique("anna");
        const user = await prisma().user.create({
            data: {
                username: tag,
                password: encryptPasswordSync(PASSWORD),
                emailVerifiedAt: new Date(),
                roles: {
                    create: [
                        { roleName: RoleName.OWNER, isActive: true },
                        { roleName: RoleName.CHECKIN_OPERATOR, isActive: true },
                    ],
                },
                person: {
                    create: {
                        name: "Anna",
                        surname: tag,
                        personType: "USER",
                        contact: { create: { email: `${tag}@test.it` } },
                    },
                },
            },
        });
        await prisma().organizationMember.createMany({
            data: [
                { organizationId: a.organizationId, userId: user.id, role: OrgMemberRole.OWNER, acceptedAt: new Date() },
                { organizationId: b.organizationId, userId: user.id, role: OrgMemberRole.CHECKIN_OPERATOR, acceptedAt: new Date() },
            ],
        });
        return { a, b, session: await login(app, tag, PASSWORD) };
    }

    it("NON modifica un evento dell'organizzazione in cui fa solo il check-in", async () => {
        const { b, session } = await anna();

        const res = await app.inject({
            method: "PATCH",
            url: `/api/events/${b.event.id}`,
            headers: { authorization: session },
            payload: { tags: ["manomesso"] },
        });

        expect([403, 404]).toContain(res.statusCode);
        const event = await prisma().event.findUniqueOrThrow({ where: { id: b.event.id } });
        expect(event.tags).not.toContain("manomesso");
    });

    it("NON crea una sala nell'organizzazione in cui fa solo il check-in", async () => {
        const { b, session } = await anna();
        const address = await prisma().address.create({ data: { city: "Bari", country: "IT" } });

        const res = await app.inject({
            method: "POST",
            url: "/api/venues/create",
            headers: { authorization: session },
            payload: { name: "Sala abusiva", addressId: address.id, organizationId: b.organizationId },
        });

        expect(res.statusCode).toBe(403);
    });

    it("una sala senza organizzazione dichiarata nasce in A, l'unica dove può crearla", async () => {
        const { a, session } = await anna();
        const address = await prisma().address.create({ data: { city: "Bari", country: "IT" } });

        const res = await app.inject({
            method: "POST",
            url: "/api/venues/create",
            headers: { authorization: session },
            payload: { name: "Sala della titolare", addressId: address.id },
        });

        // Prima era un 400 «appartieni a più organizzazioni»: lo era, ma in B
        // non può creare sale, e la scelta non c'è.
        expect(res.statusCode).toBe(200);
        expect(res.json().organizationId).toBe(a.organizationId);
    });

    it("modifica ancora gli eventi della SUA organizzazione", async () => {
        const { a, session } = await anna();

        const res = await app.inject({
            method: "PATCH",
            url: `/api/events/${a.event.id}`,
            headers: { authorization: session },
            payload: { tags: ["della-titolare"] },
        });

        expect(res.statusCode).toBe(200);
    });

    it("legge ancora gli eventi di B, dove il check-in lo fa davvero", async () => {
        const { b, session } = await anna();

        const res = await app.inject({
            method: "GET",
            url: `/api/events/${b.event.id}`,
            headers: { authorization: session },
        });

        expect(res.statusCode).toBe(200);
    });
});
