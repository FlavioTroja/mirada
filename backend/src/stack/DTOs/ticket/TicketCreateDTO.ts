import { z } from "zod";
import { TicketOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * §4.12 — `code`, `qrIssuedAt`, `qrRevokedAt`, `status` e `pdfFileId` **non
 * compaiono**: sono calcolati dal server.
 *
 * `code` in particolare **è** il QR firmato Ed25519 (assunzione `AS-7`): un
 * biglietto il cui codice arriva dal client è un biglietto che il client può
 * fabbricare, ed è esattamente ciò contro cui esiste la firma.
 *
 * Nota di percorso: nella matrice §3.8 `CREATE#TICKET` non è concesso ad alcun
 * ruolo dell'interfaccia — i biglietti nascono da una riga d'ordine pagata
 * (fase D2) o da un'emissione manuale di pass (`POST /events/:id/pass-issuances/bulk`).
 * La rotta di creazione del dialetto resta dichiarata, ed è di fatto riservata a
 * `GOD`.
 */
export const TicketCreateSchema = withoutMetadata(TicketOptionalDefaultsSchema)
    .omit({
        code: true,
        status: true,
        qrIssuedAt: true,
        qrRevokedAt: true,
        pdfFileId: true,
    });

export type TicketCreateDTO = z.infer<typeof TicketCreateSchema>;
