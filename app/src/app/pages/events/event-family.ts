import { EventType, EventTypeFamily } from '../../core/domain/models';
import { UiLang, resolveI18n } from '../../core/i18n/i18n-text';

/**
 * **Le due porte sulla stessa tabella** — `15-corsi.md` §2.1.
 *
 * Un corso è un `Event` con un `EventType` di famiglia `COURSE`: stessa entità,
 * stesse `Session`, stesso motore di capienza. Ciò che cambia è **il mestiere** —
 * costruire un festival e far girare un trimestre sono due lavori diversi — e
 * quindi la lista da cui si arriva, il percorso, e le parole.
 *
 * Questo file è l'unico posto in cui quella differenza è scritta. Sparpagliarla
 * in un `@if` per componente significa, al terzo tipo evento, sei punti da tenere
 * allineati a mano — che è esattamente il difetto che il lessico sul catalogo
 * esiste per togliere.
 */

/** Da quale porta si è entrati. L'URL è la fonte: è ciò che la persona ha scelto. */
export function familyFromUrl(url: string): EventTypeFamily {
  return url.startsWith('/courses') ? 'COURSE' : 'EVENT';
}

export function basePathFor(family: EventTypeFamily): string {
  return family === 'COURSE' ? '/courses' : '/events';
}

/** Il nome della cosa, al singolare: «Corso» o «Evento». */
export function entityLabelFor(family: EventTypeFamily): string {
  return family === 'COURSE' ? 'Corso' : 'Evento';
}

/** Il nome della cosa, al plurale: «Corsi» o «Eventi». */
export function collectionLabelFor(family: EventTypeFamily): string {
  return family === 'COURSE' ? 'Corsi' : 'Eventi';
}

/**
 * **Come si chiamano le sessioni di questo tipo**, al plurale.
 *
 * La parola viene dal catalogo (`EventType.sessionsLabel`), non dal codice: la
 * stessa riga `Session` è «Lezione 3» in un corso e «Seminario del sabato» in un
 * festival. Il ripiego è «Sessioni», che è ciò che il sistema ha sempre detto.
 *
 * ⚠️ Si legge dal **tipo dell'evento**, non dalla famiglia: due tipi della stessa
 * famiglia possono chiamarle diversamente, ed è il punto di avere un campo invece
 * di un `if`.
 */
export function sessionsLabelOf(
  eventType: EventType | null | undefined,
  lang: UiLang = 'it',
): string {
  // `resolveI18n` è il risolutore di casa: gestisce già il ripiego sull'altra
  // lingua e le stringhe vuote. Riscriverlo qui avrebbe prodotto due regole di
  // traduzione che prima o poi si contraddicono.
  return resolveI18n(eventType?.sessionsLabel, lang)?.text ?? 'Sessioni';
}
