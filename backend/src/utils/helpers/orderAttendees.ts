import { OrderLine } from "@prisma/client";
import { OrderAttendeeDTO } from "@DTOs/order/OrderReserveDTO";

/**
 * Un partecipante **come è scritto sulla riga d'ordine** — backend-brief §3.6.
 *
 * ── Perché `registrationId` è qui e non su una colonna ───────────────────────
 * Il §4.11 non dichiara alcuna chiave esterna fra `Order` e `Registration`, e lo
 * schema non ne ha una: `Registration` discende da `Event`, non dall'ordine. Ma
 * `abandon`, la scadenza della prenotazione e `confirm-partial` **devono** poter
 * risalire dalle righe dell'ordine alle iscrizioni da rilasciare — e risalirci
 * per email dell'intestatario sarebbe fragile in esattamente il caso che il
 * dominio ammette: due persone omonime, un'email corretta dopo l'ordine, una
 * riga di servizio senza titolo.
 *
 * L'identificativo dell'iscrizione viaggia perciò **dentro** `attendees`, che è
 * già `Json` e già dichiarato come l'elenco dei partecipanti della riga. È
 * un'**aggiunta** alla forma del §3.6, non un cambio: i cinque campi dichiarati
 * restano tutti, con lo stesso nome e lo stesso significato. La sola alternativa
 * a costo zero — una colonna `orderLineId` su `Registration` — richiederebbe una
 * migrazione su una tabella già popolata dalla fase C, che il compito non
 * prevede. Dichiarato nel rapporto come scostamento con ragione.
 */
export type OrderAttendeeRecord = OrderAttendeeDTO & {
    /** L'iscrizione nata da questo partecipante. Assente sulle righe di servizio pure. */
    registrationId?: number | null;
};

/** Legge `OrderLine.attendees` senza mai lanciare: un JSON malformato vale elenco vuoto. */
export function readOrderAttendees(line: Pick<OrderLine, "attendees">): OrderAttendeeRecord[] {
    if (!Array.isArray(line.attendees)) {
        return [];
    }
    return (line.attendees as unknown[]).filter(
        (entry): entry is OrderAttendeeRecord => !!entry && typeof entry === "object",
    );
}

/**
 * Le iscrizioni impegnate da un insieme di righe d'ordine, deduplicate e in
 * ordine crescente.
 *
 * L'ordine crescente non è cosmetico: `CapacityEngineService.release` tocca le
 * quote in ordine di id, e passargli sempre le iscrizioni nello stesso ordine
 * mantiene la stessa difesa contro i deadlock anche sul percorso di rilascio.
 */
export function registrationIdsOfLines(lines: Pick<OrderLine, "attendees">[]): number[] {
    const ids = new Set<number>();
    for (const line of lines) {
        for (const attendee of readOrderAttendees(line)) {
            if (attendee.registrationId) {
                ids.add(attendee.registrationId);
            }
        }
    }
    return [...ids].sort((a, b) => a - b);
}
