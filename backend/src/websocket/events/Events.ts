/**
 * Central registry of every WebSocket event name the backend pushes to the frontend.
 * Keep ALL event strings here — never inline them in services. Namespaced
 * `<domain>/<action>` style, mirroring `@mqtt/topics/Topics`.
 */
export const Events = {
    /** Sent by the server right after a client authenticates its connection. */
    SYSTEM_WELCOME: "system/welcome",
    /** A Log row was saved and its recipients must be notified live. */
    LOG_NOTIFICATION: "log/notification",
    /**
     * The capacity counters of an event moved (commit or release). Notification and
     * refetch trigger, never a data channel: the frontend re-calls the REST endpoint.
     * Aggregated over a ~1.5s window by `AvailabilityBroadcastService` (backend-brief §3.9).
     */
    EVENT_AVAILABILITY_CHANGED: "event/availability-changed",
    /** A registration entered the event — the organizer's dashboard must refetch (§4.10). */
    REGISTRATION_CREATED: "registration/created",
    /**
     * Un'iscrizione gia esistente e cambiata: confermata, rifiutata, cancellata,
     * o le e stato riassegnato il ruolo. Ai membri dell'organizzazione.
     *
     * Distinto da `registration/created` e non fuso con esso: chi ascolta vuole
     * quasi sempre cose diverse dai due. Il flusso «iscrizioni in arrivo»
     * aggiunge una riga solo sul primo; l'elenco iscritti e la scheda della
     * singola persona devono rileggere su entrambi. Un evento unico costringerebbe
     * ognuno dei due a distinguere il caso dal payload, che e il modo in cui una
     * distinzione si perde.
     */
    REGISTRATION_UPDATED: "registration/updated",
    /**
     * A ticket changed holder (§4.12). Sent to BOTH parties and to the organization
     * members: the old holder's QR stops opening the door, the new holder's starts.
     */
    TICKET_TRANSFERRED: "ticket/transferred",
    /**
     * Somebody entered a session (§4.13). **Immediate, never aggregated**: this is the
     * live presence counter, and a safety figure that arrives late is a wrong figure.
     */
    CHECKIN_REGISTERED: "checkin/registered",
    /**
     * The 15-minute hold of an order lapsed and the scheduler released it (§4.11,
     * `RF-PAY-24`). Sent to the BUYER — nobody else has anything to do about it.
     * The buyer's cart page must stop counting down and say why, instead of letting
     * the user pay for seats that are no longer held.
     */
    ORDER_RESERVATION_EXPIRED: "order/reservation-expired",
    /**
     * An order was paid (§4.11). Sent to the BUYER. In phase D2 it is the Stripe
     * webhook that publishes it; today `POST /orders/:id/confirm-free` does, on the
     * very same code path minus the adapter.
     */
    PAYMENT_SUCCEEDED: "payment/succeeded",
    /**
     * Una vendita dichiarata da un negozio esterno è entrata nel sistema (fase E).
     * Inviato ai MEMBRI dell'organizzazione, mai in diffusione: è una vendita di
     * quell'organizzatore e di nessun altro.
     *
     * Perché non basta `event/availability-changed`, che parte comunque: quello
     * dice che i contatori si sono mossi, questo dice **da dove**. In apertura
     * vendite l'organizzatore deve poter distinguere il proprio negozio dal
     * proprio sito, altrimenti vede un numero salire senza sapere cosa sta
     * funzionando.
     */
    EXTERNAL_SALE_INGESTED: "external-sale/ingested",
    /**
     * Una vendita esterna è **ferma** e aspetta una mano umana — prodotto non
     * mappato, evento che non gestisce i canali esterni, titolo cancellato.
     *
     * È il solo evento della fase E che chiede un'azione invece di aggiornare uno
     * schermo, ed è **immediato, mai aggregato**: qualcuno ha pagato e non ha il
     * biglietto, e ogni minuto di ritardo è un minuto in cui quella persona
     * scrive all'organizzatore.
     */
    EXTERNAL_SALE_QUARANTINED: "external-sale/quarantined",
    /**
     * Un saldo è stato incassato al botteghino (`14` §8, `RF-SAL-17`). Ai MEMBRI
     * dell'organizzazione, nella stessa forma di `external-sale/ingested`.
     *
     * Serve a due schermi che non si parlano: il cruscotto — «atteso al
     * botteghino · già incassato · ancora aperto» — e la scheda della persona,
     * che qualcuno può avere aperta mentre un'altra postazione incassa. Senza,
     * chi guarda la scheda vede un residuo che è già stato pagato e lo chiede una
     * seconda volta.
     *
     * ⚠️ **Non porta la cifra**, come nessun altro segnale di questo backend: è
     * una notifica e un invito a rileggere, mai un canale di dati. Un fotogramma
     * vecchio non deve poter contraddire la banca dati, e l'importo di un residuo
     * ha per giunta un permesso suo (`RB27`).
     */
    BALANCE_SETTLED: "balance/settled",
} as const;

export type EventName = (typeof Events)[keyof typeof Events];
