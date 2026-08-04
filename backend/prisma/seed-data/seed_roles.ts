import { RoleName } from "@prisma/client";

/**
 * Ruoli di piattaforma — backend-brief §1.3 / §3.8.
 *
 * `rank` cresce con la distanza dal potere: 0 = GOD, 90 = utente finale.
 * ADMIN e USER sono residui del template (vedi il commento sull'enum RoleName in
 * schema.prisma): restano seminati perché seed_users.ts li assegna, ma non
 * ricevono NESSUNA riga in PermissionConfig.
 */
export const seed_roles = [
    {
        name: RoleName.GOD,
        label: "Super Admin",
        rank: 0,
        isActive: true,
    },
    {
        name: RoleName.OWNER,
        label: "Titolare organizzazione",
        rank: 10,
        isActive: true,
    },
    {
        name: RoleName.EVENT_MANAGER,
        label: "Event Manager",
        rank: 20,
        isActive: true,
    },
    {
        name: RoleName.CHECKIN_OPERATOR,
        label: "Operatore check-in",
        rank: 30,
        isActive: true,
    },
    {
        name: RoleName.DANCER,
        label: "Ballerino",
        rank: 90,
        isActive: true,
    },
    // --- Residui del template, senza alcun permesso concesso ---
    {
        name: RoleName.ADMIN,
        label: "Admin (legacy template)",
        rank: 100,
        isActive: true,
    },
    {
        name: RoleName.USER,
        label: "User (legacy template)",
        rank: 110,
        isActive: true,
    },
]
