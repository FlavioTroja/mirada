// keijo-ui: scaffolded — do not remove this marker if you intend to re-run ng add
import { KeijoSidebarRoute } from '@keijo/ui';
import {
  adminPanelSettings,
  badge,
  celebration,
  dashboard,
  domain,
  howToReg,
  summarize,
} from '@keijo/ui/icons';
import { Capabilities } from '../core/auth/roles';

/**
 * Registro delle voci di sidebar, **nell'ordine dichiarato dal §2**.
 *
 * **Nessuna categoria `settings`** (`KEIJO-SIDEBAR-NO-SETTINGS`): le preferenze
 * utente vivono nel menu utente in fondo alla sidebar, fuori dalla navigazione.
 *
 * Il §2 del brief dichiara dieci rotte; qui ne compaiono **sette** — quelle i
 * cui endpoint esistono nel backend. `/tickets`, `/orders` e `/check-in` non
 * compaiono: le basi REST di `Ticket`, `Order` e `CheckIn` non sono ancora
 * esposte. Meglio assenti che presenti e rotte.
 *
 * Le voci sono filtrate per **capacità del ruolo** (§1, §3.8): ciò che il ruolo
 * non può fare **non compare**, non compare disabilitato.
 */
/**
 * **Dove atterra chi entra.** `/dashboard` è il cruscotto di un evento e non
 * esiste per chi la piattaforma la gestisce: mandarcelo lo farebbe rimbalzare.
 */
export function landingFor(can: Capabilities): string {
  if (can.platformDashboard) return '/platform';
  if (can.dashboard) return '/dashboard';
  if (can.events) return '/events';
  return '/registrations';
}

export function sidebarRoutesFor(can: Capabilities): KeijoSidebarRoute[] {
  const routes: KeijoSidebarRoute[] = [];

  // ── La navigazione di chi gestisce la piattaforma ──────────────────────────
  // È una navigazione **diversa**, non un sovrainsieme di quella di un
  // organizzatore: chi possiede il prodotto guarda i clienti, non i festival.
  // Le voci di tenant non compaiono perché non sono il suo mestiere — e una
  // sidebar che le mostrasse lo inviterebbe a lavorare dentro l'evento di
  // qualcun altro.
  if (can.platformDashboard) {
    routes.push({ icon: dashboard, label: 'Cruscotto', path: '/platform' });
    routes.push({ icon: domain, label: 'Organizzatori', path: '/platform/organizations' });
    routes.push({
      icon: adminPanelSettings,
      label: 'Cataloghi',
      path: '/platform/event-types',
      children: [
        { icon: adminPanelSettings, label: 'Tipi evento', path: '/platform/event-types' },
        { icon: adminPanelSettings, label: 'Tipi requisito', path: '/platform/requirement-types' },
        { icon: adminPanelSettings, label: 'Tipi servizio', path: '/platform/service-types' },
        { icon: adminPanelSettings, label: 'Preset di rimborso', path: '/platform/refund-presets' },
      ],
    });
    return routes;
  }

  if (can.dashboard) {
    routes.push({ icon: dashboard, label: 'Cruscotto', path: '/dashboard' });
  }

  if (can.events) {
    routes.push({ icon: celebration, label: 'Eventi', path: '/events' });
  }

  if (can.registrations) {
    routes.push({ icon: howToReg, label: 'Iscritti', path: '/registrations' });
  }

  if (can.reports) {
    routes.push({
      icon: summarize,
      label: 'Report',
      path: '/reports',
      children: [
        { icon: summarize, label: 'Riepilogo', path: '/reports' },
        { icon: summarize, label: 'Esportazioni', path: '/reports/exports' },
      ],
    });
  }

  if (can.directory) {
    routes.push({
      icon: badge,
      label: 'Anagrafiche',
      path: '/directory',
      children: [
        { icon: badge, label: 'Location', path: '/directory/venues' },
        { icon: badge, label: 'Cast', path: '/directory/artists' },
      ],
    });
  }

  if (can.organization) {
    routes.push({
      icon: domain,
      label: 'Organizzazione',
      path: '/organization',
      children: [
        { icon: domain, label: 'Anagrafica', path: '/organization' },
        { icon: domain, label: 'Incasso', path: '/organization/payout' },
        { icon: domain, label: 'Dichiarazioni', path: '/organization/fiscal' },
        { icon: domain, label: 'Membri', path: '/organization/members' },
        { icon: domain, label: 'Policy di rimborso', path: '/organization/refund-policies' },
      ],
    });
  }

  return routes;
}
