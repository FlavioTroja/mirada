import { z } from "zod";
import { CheckInPartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * §4.13 — di un ingresso registrato resta modificabile pochissimo, ed è giusto
 * così: un check-in è il verbale di un fatto avvenuto a una certa ora a una certa
 * porta.
 *
 * `revokedAt` è fuori perché l'annullamento ha il suo endpoint
 * (`POST /check-ins/:id/revoke`, `RF-CHK-9`): passa da lì, con il suo log, non da
 * un `PATCH` generico. `conflictWithId` è fuori perché un conflitto lo dichiara
 * la sincronizzazione, non il client; la sua **risoluzione** si compie revocando
 * la riga che si scarta.
 */
export const CheckInUpdateSchema = withoutMetadata(CheckInPartialSchema)
    .pick({ kind: true });

export type CheckInUpdateDTO = z.infer<typeof CheckInUpdateSchema>;
