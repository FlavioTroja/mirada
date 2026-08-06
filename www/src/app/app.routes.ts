import { Routes } from '@angular/router';
import { eventDetailResolver, eventsSearchResolver } from './pages/events/events.resolvers';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'eventi' },
  {
    path: 'eventi',
    loadComponent: () => import('./pages/events/events-search.page').then((m) => m.EventsSearchPage),
    resolve: { search: eventsSearchResolver },
    // I filtri vivono nella query string: senza questo, cambiare filtro non
    // rieseguirebbe il resolver e la pagina resterebbe sui vecchi risultati.
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
  },
  {
    path: 'eventi/:slug/iscrizione',
    loadComponent: () => import('./pages/checkout/checkout.page').then((m) => m.CheckoutPage),
    resolve: { event: eventDetailResolver },
  },
  {
    path: 'eventi/:slug',
    loadComponent: () => import('./pages/events/event-detail.page').then((m) => m.EventDetailPage),
    resolve: { event: eventDetailResolver },
  },
  {
    path: 'accedi',
    loadComponent: () => import('./pages/checkout/login.page').then((m) => m.LoginPage),
  },
  { path: '**', redirectTo: 'eventi' },
];
