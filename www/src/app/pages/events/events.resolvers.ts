import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { EventStore } from '../../stores/event.store';
import { PublicEvent } from '../../core/domain/models';
import { pageFromParams, queryFromParams } from './events-search.page';

/**
 * I dati delle due pagine pubbliche si caricano in un **resolver**, non nel
 * componente: la navigazione non si completa finché la promessa non è risolta,
 * e la resa lato server esce quindi con il contenuto vero già dentro l'HTML.
 * È tutto il motivo per cui `www` esiste come applicazione separata.
 */

export const eventsSearchResolver: ResolveFn<boolean> = async (route) => {
  const store = inject(EventStore);
  await store.search(queryFromParams(route.queryParams), pageFromParams(route.queryParams));
  return true;
};

export const eventDetailResolver: ResolveFn<PublicEvent | null> = async (route) => {
  const store = inject(EventStore);
  const slug = route.paramMap.get('slug') ?? '';
  const event = await store.loadBySlug(slug);
  // La disponibilità viva entra già nella prima resa: i numeri della scheda non
  // devono comparire un secondo dopo l'idratazione. Il polling parte poi, nel
  // solo browser (§3.9: l'anonimo non ha WebSocket).
  if (event) await store.loadAvailability(event.id);
  return event;
};
