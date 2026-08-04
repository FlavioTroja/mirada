/**
 * Un'unica sorgente di verità per i ruoli: il seed di test riusa quello di sviluppo.
 * Le concessioni di `prisma/seed-data/seed_permissions.ts` puntano ai ruoli del
 * §3.8 (OWNER, EVENT_MANAGER, CHECKIN_OPERATOR, DANCER): se il DB di test non li
 * contenesse, ogni upsert di PermissionConfig fallirebbe sulla chiave esterna.
 */
export { seed_roles } from "../../prisma/seed-data/seed_roles";
