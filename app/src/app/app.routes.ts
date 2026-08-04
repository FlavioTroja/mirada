// keijo-ui: scaffolded — do not remove this marker if you intend to re-run ng add
import { Routes } from '@angular/router';
import { authGuard, requireCapability } from './core/auth/auth.guard';

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
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
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

  // -------------------------------------------------------------- /platform
  { path: 'platform', pathMatch: 'full', redirectTo: 'platform/event-types' },
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

  { path: '**', redirectTo: 'dashboard' },
];
