// keijo-ui: scaffolded — do not remove this marker if you intend to re-run ng add
import { Routes } from '@angular/router';
import { authGuard, landingRedirect, requireCapability } from './core/auth/auth.guard';

/**
 * Rotte dell'applicazione `app`.
 *
 * Sette rotte di sidebar (§2, limitato a ciò che ha un endpoint vivo):
 * `/dashboard`, `/events`, `/registrations`, `/reports`, `/directory`,
 * `/organization`, `/platform`. Restano fuori `/tickets`, `/orders` e
 * `/check-in`: le basi REST di `Ticket`, `Order` e `CheckIn` non sono ancora
 * esposte.
 *
 * `/login` e `/settings` non sono voci di sidebar: la prima è fuori sessione,
 * la seconda vive nel menu utente (`KEIJO-SIDEBAR-NO-SETTINGS`).
 */
export const routes: Routes = [
  // La radice è la PRESENTAZIONE del prodotto, e non ha guardia: ci arriva chi
  // non sa ancora cosa sia Mirada. Chi ha già una sessione non la vede — il
  // componente lo porta dove il suo ruolo atterra, che non è lo stesso posto per
  // tutti (`landingFor`): un organizzatore al cruscotto del suo evento, chi
  // gestisce la piattaforma al riepilogo dei clienti.
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
    data: { showBackButton: false },
  },

  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
    data: { showBackButton: false },
  },

  // Il ritorno da Authentik. Fuori dalla shell come `/login`, e senza guardia:
  // ci si arriva **prima** di avere una sessione, che è proprio ciò che questa
  // rotta serve ad aprire.
  //
  // ⚠️ Il percorso è registrato fra gli URI di reindirizzamento del provider su
  // Authentik, con corrispondenza stretta: rinominarlo qui senza rinominarlo
  // là fa fallire l'accesso con un 400 del fornitore.
  // Il primo accesso di chi su mirada non c'era ancora: apre la sua
  // organizzazione, oppure accetta l'invito che ha in mano. Fuori dalla shell e
  // senza guardia, come `/login`: qui la sessione non c'è ancora.
  {
    path: 'registrazione',
    loadComponent: () =>
      import('./pages/login/registrazione.component').then((m) => m.RegistrazioneComponent),
    data: { showBackButton: false },
  },

  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./pages/login/sso-callback.component').then((m) => m.SsoCallbackComponent),
    data: { showBackButton: false },
  },

  // ------------------------------------------------------------- /dashboard
  {
    path: 'dashboard',
    canActivate: [requireCapability('dashboard')],
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },

  // --------------------------------------------------------------- /reports
  {
    path: 'reports',
    pathMatch: 'full',
    canActivate: [requireCapability('reports')],
    loadComponent: () =>
      import('./pages/reports/reports.component').then((m) => m.ReportsComponent),
  },
  {
    path: 'reports/exports',
    canActivate: [requireCapability('reports')],
    loadComponent: () =>
      import('./pages/reports/report-exports.component').then((m) => m.ReportExportsComponent),
  },

  // --------------------------------------------------------------- /courses
  //
  // **Gli stessi componenti di `/events`, sotto un percorso proprio.** Un corso è
  // un `Event` con un `EventType` di famiglia `COURSE` (`15-corsi.md` §2.1), e
  // sdoppiare le pagine significherebbe due copie della stessa schermata che fra
  // sei mesi divergono.
  //
  // Il percorso però è suo: `/events/123` per un corso contraddirebbe la voce di
  // menù da cui si è arrivati, e l'indirizzo è la prima cosa che una persona
  // copia e manda a un collega.
  {
    path: 'courses',
    canActivate: [requireCapability('events')],
    loadComponent: () =>
      import('./pages/events/events-list.component').then((m) => m.EventsListComponent),
  },
  {
    path: 'courses/new',
    canActivate: [requireCapability('eventsWrite')],
    loadComponent: () =>
      import('./pages/events/event-detail.component').then((m) => m.EventDetailComponent),
  },
  {
    path: 'courses/:id',
    canActivate: [requireCapability('events')],
    loadComponent: () =>
      import('./pages/events/event-detail.component').then((m) => m.EventDetailComponent),
  },
  {
    path: 'courses/:id/sessions',
    canActivate: [requireCapability('events')],
    loadComponent: () =>
      import('./pages/events/event-sessions.component').then((m) => m.EventSessionsComponent),
  },
  {
    path: 'courses/:id/ticket-types',
    canActivate: [requireCapability('events')],
    loadComponent: () =>
      import('./pages/events/event-ticket-types.component').then((m) => m.EventTicketTypesComponent),
  },
  {
    path: 'courses/:id/ticket-types/:ttId/sessions',
    canActivate: [requireCapability('events')],
    loadComponent: () =>
      import('./pages/events/ticket-type-sessions.component').then(
        (m) => m.TicketTypeSessionsComponent,
      ),
  },
  // ---------------------------------------------------------------- /events
  {
    path: 'events',
    canActivate: [requireCapability('events')],
    loadComponent: () =>
      import('./pages/events/events-list.component').then((m) => m.EventsListComponent),
  },
  {
    path: 'events/new',
    canActivate: [requireCapability('eventsWrite')],
    loadComponent: () =>
      import('./pages/events/event-detail.component').then((m) => m.EventDetailComponent),
  },
  {
    path: 'events/:id',
    canActivate: [requireCapability('events')],
    loadComponent: () =>
      import('./pages/events/event-detail.component').then((m) => m.EventDetailComponent),
  },
  {
    path: 'events/:id/sessions',
    canActivate: [requireCapability('events')],
    loadComponent: () =>
      import('./pages/events/event-sessions.component').then((m) => m.EventSessionsComponent),
  },
  {
    path: 'events/:id/cast',
    canActivate: [requireCapability('events')],
    loadComponent: () =>
      import('./pages/events/event-cast.component').then((m) => m.EventCastComponent),
  },
  {
    path: 'events/:id/ticket-types',
    canActivate: [requireCapability('events')],
    loadComponent: () =>
      import('./pages/events/event-ticket-types.component').then((m) => m.EventTicketTypesComponent),
  },
  {
    path: 'events/:id/ticket-types/:ttId/sessions',
    canActivate: [requireCapability('events')],
    loadComponent: () =>
      import('./pages/events/ticket-type-sessions.component').then(
        (m) => m.TicketTypeSessionsComponent,
      ),
  },
  {
    path: 'events/:id/ticket-types/:ttId/price-tiers',
    canActivate: [requireCapability('events')],
    loadComponent: () =>
      import('./pages/events/ticket-type-price-tiers.component').then(
        (m) => m.TicketTypePriceTiersComponent,
      ),
  },
  {
    path: 'events/:id/quotas',
    canActivate: [requireCapability('events')],
    loadComponent: () =>
      import('./pages/events/event-quotas.component').then((m) => m.EventQuotasComponent),
  },
  {
    path: 'events/:id/requirements',
    canActivate: [requireCapability('events')],
    loadComponent: () =>
      import('./pages/events/event-requirements.component').then(
        (m) => m.EventRequirementsComponent,
      ),
  },
  {
    path: 'events/:id/services',
    canActivate: [requireCapability('events')],
    loadComponent: () =>
      import('./pages/events/event-services.component').then((m) => m.EventServicesComponent),
  },

  // --------------------------------------------------------- /registrations
  {
    path: 'registrations',
    canActivate: [requireCapability('registrations')],
    loadComponent: () =>
      import('./pages/registrations/registrations-list.component').then(
        (m) => m.RegistrationsListComponent,
      ),
  },
  {
    path: 'registrations/:id',
    canActivate: [requireCapability('registrations')],
    loadComponent: () =>
      import('./pages/registrations/registration-detail.component').then(
        (m) => m.RegistrationDetailComponent,
      ),
  },

  // ------------------------------------------------------------- /directory
  { path: 'directory', pathMatch: 'full', redirectTo: 'directory/venues' },
  {
    path: 'directory/venues',
    canActivate: [requireCapability('directory')],
    loadComponent: () => import('./pages/directory/venues.component').then((m) => m.VenuesComponent),
  },
  {
    path: 'directory/artists',
    canActivate: [requireCapability('directory')],
    loadComponent: () =>
      import('./pages/directory/artists.component').then((m) => m.ArtistsComponent),
  },

  // ---------------------------------------------------------- /organization
  {
    path: 'organization',
    canActivate: [requireCapability('organization')],
    loadComponent: () =>
      import('./pages/organization/organization-profile.component').then(
        (m) => m.OrganizationProfileComponent,
      ),
  },
  {
    path: 'organization/invitations',
    canActivate: [requireCapability('organization')],
    loadComponent: () =>
      import('./pages/organization/organization-invitations.component').then(
        (m) => m.OrganizationInvitationsComponent,
      ),
  },
  {
    path: 'organization/payout',
    canActivate: [requireCapability('organization')],
    loadComponent: () =>
      import('./pages/organization/organization-payout.component').then(
        (m) => m.OrganizationPayoutComponent,
      ),
  },
  {
    path: 'organization/fiscal',
    canActivate: [requireCapability('organization')],
    loadComponent: () =>
      import('./pages/organization/organization-fiscal.component').then(
        (m) => m.OrganizationFiscalComponent,
      ),
  },
  {
    path: 'organization/members',
    canActivate: [requireCapability('organization')],
    loadComponent: () =>
      import('./pages/organization/organization-members.component').then(
        (m) => m.OrganizationMembersComponent,
      ),
  },
  {
    path: 'organization/refund-policies',
    canActivate: [requireCapability('organization')],
    loadComponent: () =>
      import('./pages/organization/organization-refund-policies.component').then(
        (m) => m.OrganizationRefundPoliciesComponent,
      ),
  },
  // I negozi esterni collegati, la traduzione dei loro prodotti e i codici di
  // acconto (fase E e `14-acconto-e-saldo.md`). Sta sotto `/organization`
  // perché un negozio è dell'organizzazione, non di un evento: lo stesso
  // negozio vende le edizioni di tutti gli anni.
  {
    path: 'organization/sales-channels',
    canActivate: [requireCapability('organization')],
    loadComponent: () =>
      import('./pages/organization/organization-sales-channels.component').then(
        (m) => m.OrganizationSalesChannelsComponent,
      ),
  },

  // -------------------------------------------------------------- /platform
  {
    path: 'platform',
    pathMatch: 'full',
    canActivate: [requireCapability('platformDashboard')],
    loadComponent: () =>
      import('./pages/platform/platform-dashboard.component').then(
        (m) => m.PlatformDashboardComponent,
      ),
  },
  {
    path: 'platform/event-types',
    canActivate: [requireCapability('platform')],
    loadComponent: () =>
      import('./pages/platform/platform-event-types.component').then(
        (m) => m.PlatformEventTypesComponent,
      ),
  },
  {
    path: 'platform/requirement-types',
    canActivate: [requireCapability('platform')],
    loadComponent: () =>
      import('./pages/platform/platform-requirement-types.component').then(
        (m) => m.PlatformRequirementTypesComponent,
      ),
  },
  {
    path: 'platform/service-types',
    canActivate: [requireCapability('platform')],
    loadComponent: () =>
      import('./pages/platform/platform-service-types.component').then(
        (m) => m.PlatformServiceTypesComponent,
      ),
  },
  {
    path: 'platform/refund-presets',
    canActivate: [requireCapability('platform')],
    loadComponent: () =>
      import('./pages/platform/platform-refund-presets.component').then(
        (m) => m.PlatformRefundPresetsComponent,
      ),
  },
  {
    path: 'platform/organizations',
    canActivate: [requireCapability('platform')],
    loadComponent: () =>
      import('./pages/platform/platform-organizations.component').then(
        (m) => m.PlatformOrganizationsComponent,
      ),
  },

  // Preferenze utente — raggiungibile dal menu utente, mai dalla sidebar.
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/settings/settings.component').then((m) => m.SettingsComponent),
    data: { showBackButton: true },
  },

  { path: '**', canActivate: [landingRedirect], children: [] },
];
