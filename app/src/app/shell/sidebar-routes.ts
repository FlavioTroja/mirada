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
export function sidebarRoutesFor(can: Capabilities): KeijoSidebarRoute[] {
  const routes: KeijoSidebarRoute[] = [];

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

  if (can.platform) {
    routes.push({
      icon: adminPanelSettings,
      label: 'Piattaforma',
      path: '/platform',
      children: [
        { icon: adminPanelSettings, label: 'Tipi evento', path: '/platform/event-types' },
        { icon: adminPanelSettings, label: 'Tipi requisito', path: '/platform/requirement-types' },
        { icon: adminPanelSettings, label: 'Tipi servizio', path: '/platform/service-types' },
        { icon: adminPanelSettings, label: 'Preset di rimborso', path: '/platform/refund-presets' },
        { icon: adminPanelSettings, label: 'Organizzazioni', path: '/platform/organizations' },
      ],
    });
  }

  return routes;
}
