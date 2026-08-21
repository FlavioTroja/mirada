import { DestroyRef, inject } from '@angular/core';
import { EventEnvelope, OrganizationScopedPayload, RealtimeService } from './realtime.service';

/**
 * **L'aggancio al canale vivo, in una riga.**
 *
 * Il cruscotto lo faceva a mano: venti righe fra sottoscrizione, filtro
 * sull'evento osservato e disiscrizione in `onDestroy`. Una volta sola va bene;
 * ripetuto su ogni pagina che vuole aggiornarsi da sola diventa dieci copie
 * della stessa idraulica, e la copia numero sette dimentica la disiscrizione —
 * che non fallisce, si limita a lasciare un ascoltatore vivo su un componente
 * morto, e a rifare la GET per una pagina che nessuno sta guardando.
 *
 * ── Va chiamato in contesto d'iniezione ─────────────────────────────────────
 * Costruttore o inizializzatore di campo, non `ngOnInit`: prende `DestroyRef`
 * da sé, ed e cosi che la disiscrizione smette di essere una cosa da ricordare.
 *
 * ── Resta un trigger di refetch (§3.9) ──────────────────────────────────────
 * Il gestore riceve la busta per decidere, ma il payload non deve entrare nello
 * stato: si rilegge via REST. Il compito di questo aiutante e togliere
 * l'idraulica, non cambiare la semantica.
 */
export interface LiveOptions {
  /**
   * L'evento osservato dalla pagina. Quando c'e, i frame di altri eventi sono
   * scartati.
   *
   * ⚠️ Un frame **senza** `eventId` passa comunque. Non e una svista: alcuni
   * segnali non appartengono a un evento (una notifica di registro, un
   * cambiamento a livello di organizzazione), e scartarli perche non portano un
   * campo che non possono avere renderebbe muta proprio la pagina che li
   * aspetta. E la stessa regola che il cruscotto applicava a mano.
   */
  eventId?: () => number | null | undefined;

  /**
   * Guardia: quando restituisce `false` il frame viene ignorato.
   *
   * ⚠️ **Serve soprattutto ai moduli.** Una pagina che rilegge da sola mentre
   * qualcuno sta compilando un campo gli cancella quello che ha scritto — ed e
   * il difetto peggiore che il tempo reale possa produrre, perche colpisce chi
   * sta lavorando e sembra un guasto del computer. La forma consueta e
   * `when: () => !this.form.dirty`.
   *
   * Il frame **non viene messo in coda**: si ignora e basta. Chi sta scrivendo
   * salvera, e il salvataggio rilegge comunque; accumulare refetch per
   * scaricarli tutti insieme alla chiusura del modulo non aiuterebbe nessuno.
   */
  when?: () => boolean;
}

export type LiveHandler = (frame: EventEnvelope<OrganizationScopedPayload>) => void;

/**
 * Sottoscrive uno o piu eventi e disiscrive da solo quando il componente muore.
 *
 * ```ts
 * liveOn([REALTIME_EVENTS.checkinRegistered], () => void this.store.refresh(), {
 *   eventId: () => this.store.eventId(),
 * });
 * ```
 */
export function liveOn(events: string[], handler: LiveHandler, options: LiveOptions = {}): void {
  const realtime = inject(RealtimeService);
  const destroyRef = inject(DestroyRef);

  const wanted = (frame: EventEnvelope<OrganizationScopedPayload>): boolean => {
    if (options.when && !options.when()) return false;
    if (!options.eventId) return true;

    // Un frame senza `eventId` passa sempre — vedi la nota su `LiveOptions`.
    // L'ordine dei due controlli non e indifferente: verificare prima
    // l'evento osservato scarterebbe anche i segnali che un evento non ce
    // l'hanno, e la pagina resterebbe muta finche nessuno seleziona nulla.
    const frameEventId = frame.payload?.eventId;
    if (frameEventId === undefined) return true;

    const observed = options.eventId();
    return observed !== null && observed !== undefined && frameEventId === observed;
  };

  const offs = events.map((event) =>
    realtime.on(event, (frame) => {
      if (wanted(frame)) handler(frame);
    }),
  );

  destroyRef.onDestroy(() => offs.forEach((off) => off()));
}

/**
 * Finestra di raggruppamento dei refetch, in ricezione.
 *
 * Il server aggrega gia `event/availability-changed` su ~1,5 s, ma **per
 * evento**: dieci eventi che vendono nello stesso momento producono dieci frame
 * distinti, ed e corretto che sia cosi. A riceverli e pero una pagina sola, e
 * una che rilegge le capienze evento per evento farebbe dieci giri di query per
 * mostrare lo stesso schermo. Il raggruppamento va quindi fatto **anche di qua**,
 * ed e qui che appartiene: il mittente non sa quanti eventi guardi il
 * destinatario.
 *
 * Trecento millisecondi: sotto la soglia in cui un aggiornamento smette di
 * sembrare immediato, sopra la raffica di frame che arrivano insieme.
 */
const REFRESH_COALESCE_MS = 300;

/**
 * Il caso piu frequente: «quando succede una di queste cose, ricarica».
 *
 * Esiste separato da `liveOn` perche la stragrande maggioranza delle pagine non
 * guarda il contenuto del frame — deve solo rifare la propria GET. Scriverlo
 * cosi rende evidente, leggendo la pagina, che il payload non entra nello stato.
 *
 * A differenza di `liveOn`, **raggruppa**: piu frame ravvicinati producono una
 * rilettura sola. Chi ha bisogno di ogni singolo frame — un flusso che aggiunge
 * una riga per volta — usa `liveOn`.
 */
export function liveRefresh(
  events: string[],
  refresh: () => void | Promise<unknown>,
  options: LiveOptions = {},
): void {
  const destroyRef = inject(DestroyRef);
  let timer: ReturnType<typeof setTimeout> | null = null;

  destroyRef.onDestroy(() => {
    if (timer) clearTimeout(timer);
  });

  liveOn(
    events,
    () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        void refresh();
      }, REFRESH_COALESCE_MS);
    },
    options,
  );
}
