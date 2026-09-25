import { z } from "zod";

/**
 * `GET /dashboard/activity` — la colonna «In tempo reale» e, con
 * `staffOnly=true`, il «Registro di oggi» (`21-dashboard.md` §4).
 */
export const DashboardActivityQuerySchema = z.object({
    /** Da quando. Senza, le ultime 24 ore. */
    since: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    staffOnly: z.enum(["true", "false"]).default("false").transform(value => value === "true"),
});
export type DashboardActivityQueryDTO = z.infer<typeof DashboardActivityQuerySchema>;
