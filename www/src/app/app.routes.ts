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
  {
    // Il proprio account. Il rinvio di chi non è entrato lo fa la pagina, non un
    // guard: la sessione vive in `localStorage` e sul server non esiste, quindi
    // un guard eseguito in prima resa caccerebbe fuori anche chi è entrato.
    path: 'profilo',
    loadComponent: () => import('./pages/account/profile.page').then((m) => m.ProfilePage),
  },
  {
    // Dove atterra il tasto dell'email di conferma. Il gettone arriva in query
    // string perché un link in un'email non può fare altro; la pagina lo toglie
    // subito dalla barra e lo rispedisce nel corpo di una POST.
    path: 'conferma-email',
    loadComponent: () =>
      import('./pages/checkout/confirm-email.page').then((m) => m.ConfirmEmailPage),
  },
  { path: '**', redirectTo: 'eventi' },
];
