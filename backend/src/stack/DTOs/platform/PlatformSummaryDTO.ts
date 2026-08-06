import { z } from "zod";
import {
    EventStatusSchema,
    OrganizationStatusSchema,
    PayoutStatusSchema,
} from "@prisma-gen/zod";

/**
 * `GET /platform/summary` — **il cruscotto del gestore della piattaforma**.
 *
 * Non è il cruscotto d'evento visto più in grande: è un'altra domanda. Un
 * organizzatore chiede «come va il mio festival»; chi gestisce la piattaforma
 * chiede «quanti clienti ho, chi vende, chi è fermo, chi non può ancora
 * incassare». Le due pagine condividono i numeri e non l'intenzione.
 *
 * Vale anche qui la distinzione `RB21`: **impegnato** e **venduto** restano due
 * grandezze separate, e gli importi sono al lordo dei rimborsi finché `Refund`
 * non esiste.
 */

/** Un cliente della piattaforma, con ciò che serve a capire se sta funzionando. */
export const PlatformOrganizationRowSchema = z.object({
    organizationId: z.number().int(),
    name: z.string(),
    status: OrganizationStatusSchema,
    payoutStatus: PayoutStatusSchema,
    /** I titolari: chi chiamare quando qualcosa non va. */
    owners: z.object({ userId: z.number().int(), username: z.string(), fullName: z.string() }).array(),
    events: z.number().int(),
    publishedEvents: z.number().int(),
    registrations: z.number().int(),
    /** Centesimi interi, ordini `PAID`, al lordo dei rimborsi. */
    revenue: z.number().int(),
    presaleRights: z.number().int(),
});

/** Una riga d'evento nell'elenco unico di tutta la piattaforma. */
export const PlatformEventRowSchema = z.object({
    eventId: z.number().int(),
    slug: z.string(),
    title: z.unknown(),
    status: EventStatusSchema,
    startAt: z.date(),
    endAt: z.date(),
    organizationId: z.number().int(),
    organizationName: z.string(),
    registrations: z.number().int(),
});

export const PlatformSummarySchema = z.object({
    generatedAt: z.date(),

    organizations: z.object({
        total: z.number().int(),
        byStatus: z.record(z.string(), z.number().int()),
        /** Quante possono davvero incassare: senza, un evento pubblicato non vende. */
        payoutEnabled: z.number().int(),
    }),

    events: z.object({
        total: z.number().int(),
        byStatus: z.record(z.string(), z.number().int()),
        /** In corso adesso, secondo il calendario e non secondo lo stato. */
        running: z.number().int(),
        upcoming: z.number().int(),
    }),

    registrations: z.object({
        /** Attive: `CONFIRMED` e `TO_CONFIRM`, le stesse dell'invariante I6. */
        total: z.number().int(),
    }),

    revenue: z.object({
        paidOrders: z.number().int(),
        /** Ciò che spetta agli organizzatori. */
        subtotal: z.number().int(),
        /** Ciò che trattiene la piattaforma: è il ricavo del prodotto. */
        presaleRights: z.number().int(),
        total: z.number().int(),
    }),

    byOrganization: PlatformOrganizationRowSchema.array(),
    eventsList: PlatformEventRowSchema.array(),

    /**
     * Ciò su cui il riepilogo **non** è calcolato, dichiarato in risposta e non
     * lasciato dedurre (`RB21`).
     */
    perimeter: z.object({
        note: z.string(),
        missingEntities: z.string().array(),
    }),
});

export type PlatformSummaryDTO = z.infer<typeof PlatformSummarySchema>;
