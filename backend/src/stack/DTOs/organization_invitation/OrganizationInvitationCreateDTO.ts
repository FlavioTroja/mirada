import { z } from "zod";

/**
 * Corpo di `POST /organization-invitations/create`.
 *
 * Il **ruolo non si chiede**: oggi si invitano solo titolari. Gli altri due
 * ruoli — responsabile eventi e operatore check-in — si assegnano dal backoffice
 * a chi un'utenza ce l'ha già, e non hanno bisogno di una strada d'ingresso
 * propria. Metterlo qui adesso vorrebbe dire esporre una scelta che il servizio
 * ignora.
 */
export const OrganizationInvitationCreateSchema = z.object({
    organizationId: z.number().int().positive(),
    email: z.string().email("Serve un indirizzo email valido."),
});

export type OrganizationInvitationCreateDTO = z.infer<typeof OrganizationInvitationCreateSchema>;
