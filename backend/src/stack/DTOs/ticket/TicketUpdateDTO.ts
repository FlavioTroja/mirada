import { z } from "zod";
import { TicketPartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * §4.12 — l'`Update` tocca il **nominativo** e lo **stato**, nulla più.
 *
 * Fuori `code`, `qrIssuedAt` e `qrRevokedAt`: il QR si rigenera trasferendo il
 * biglietto o si invalida rimborsandolo, mai scrivendolo. Fuori anche
 * `registrationId`, `eventId` e `ticketTypeId`, perché spostare un biglietto da
 * un'iscrizione o da un titolo a un altro **muove capienza**, e la capienza si
 * muove solo dentro il motore.
 *
 * `bearer` è fuori per una ragione precisa: un pass al portatore non è
 * trasferibile, e renderlo nominale con un `PATCH` aggirerebbe il divieto invece
 * di rimuoverlo.
 *
 * `status` resta scrivibile perché è ciò che realizza la «revoca» del biglietto
 * (`CANCELLED`) elencata fra le azioni di riga di `/tickets`. **Non esiste e non
 * deve esistere uno stato `USED`**: l'utilizzo non è uno stato del biglietto, è
 * una riga di `CheckIn` sulla coppia biglietto–sessione (`09` §7).
 */
export const TicketUpdateSchema = withoutMetadata(TicketPartialSchema)
    .omit({
        orderLineId: true,
        passIssuanceId: true,
        eventId: true,
        ticketTypeId: true,
        registrationId: true,
        code: true,
        bearer: true,
        qrIssuedAt: true,
        qrRevokedAt: true,
        pdfFileId: true,
    });

export type TicketUpdateDTO = z.infer<typeof TicketUpdateSchema>;
