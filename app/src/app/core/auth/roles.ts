/**
 * Ruoli e gating dell'interfaccia — §1 e matrice §3.8 del frontend-brief.
 *
 * `GOD` è **implicito allow-all** e non è mai un ruolo dell'interfaccia.
 * Le azioni non permesse **non compaiono**: non compaiono disabilitate.
 */

/** Insieme chiuso dei ruoli del §3.8. */
export type AppRole = 'GOD' | 'OWNER' | 'EVENT_MANAGER' | 'CHECKIN_OPERATOR' | 'DANCER';

export const APP_ROLES: readonly AppRole[] = [
  'GOD',
  'OWNER',
  'EVENT_MANAGER',
  'CHECKIN_OPERATOR',
  'DANCER',
];

/**
 * `ADMIN` e `USER` sono residui del template `@keijo/create-be` e non
 * appartengono al dominio Mirada Tango: non concedono nulla (nota 3 del §3.10).
 */
export function toAppRole(roleName: string): AppRole | null {
  return (APP_ROLES as readonly string[]).includes(roleName) ? (roleName as AppRole) : null;
}

/** Ruolo del membro dell'organizzazione (`OrgMemberRole`, §3.5). */
export type OrgMemberRole = 'OWNER' | 'EVENT_MANAGER' | 'CHECKIN_OPERATOR';

export const ORG_MEMBER_ROLE_LABEL: Record<OrgMemberRole, string> = {
  OWNER: 'Titolare',
  EVENT_MANAGER: 'Responsabile eventi',
  CHECKIN_OPERATOR: 'Operatore check-in',
};

/**
 * Le capacità che l'interfaccia consulta. Sono un'espressione diretta della
 * matrice §3.8, non un modello parallelo.
 */
export interface Capabilities {
  /** `/dashboard` — cruscotto **dell'evento**, per chi un evento lo organizza. */
  dashboard: boolean;
  /** `/reports` — riepilogo economico ed esportazioni. */
  reports: boolean;
  /** `/platform` — cataloghi ed elenco organizzazioni. */
  platform: boolean;
  /**
   * `/platform/summary` — il cruscotto **della piattaforma**, di chi possiede il
   * prodotto e guarda i clienti invece del proprio festival.
   *
   * È una capacità distinta da `dashboard` e non un suo grado superiore: le due
   * pagine rispondono a domande diverse e nessun ruolo le vuole entrambe.
   */
  platformDashboard: boolean;
  /** `/organization` — anagrafica, dati fiscali, membri, policy. */
  organization: boolean;
  /** `/events` — workspace di costruzione dell'evento. */
  events: boolean;
  /** Scrittura sull'evento e sui suoi figli. */
  eventsWrite: boolean;
  /** `POST /events/:id/publish` — concesso anche a `EVENT_MANAGER` (decisione D-E). */
  publishEvent: boolean;
  /** `/directory` — location e cast riutilizzabili. */
  directory: boolean;
  directoryWrite: boolean;
  /** `/registrations` — elenco iscritti. */
  registrations: boolean;
  /** Scrittura sull'iscrizione (il `CHECKIN_OPERATOR` è in sola lettura). */
  registrationsWrite: boolean;
  /** Rimborsi: riservati all'`OWNER` (decisione D-D). */
  refunds: boolean;
}

const NONE: Capabilities = {
  dashboard: false,
  reports: false,
  platform: false,
  platformDashboard: false,
  organization: false,
  events: false,
  eventsWrite: false,
  publishEvent: false,
  directory: false,
  directoryWrite: false,
  registrations: false,
  registrationsWrite: false,
  refunds: false,
};

export function capabilitiesOf(roles: readonly AppRole[]): Capabilities {
  const has = (role: AppRole) => roles.includes(role);

  // ── GOD gestisce la piattaforma, non gli eventi ────────────────────────────
  // Il backend lo tratta come allow-all (§3.10 nota 8) e continua a farlo: qui
  // si decide **cosa gli si mostra**, che è un'altra cosa dal cosa gli è
  // permesso. Un'interfaccia che gli mette davanti «Eventi» e «Iscritti» lo
  // invita a lavorare dentro il festival di un cliente, che non è il suo
  // mestiere: il suo è sapere quanti clienti ci sono, chi vende, chi è fermo e
  // chi non può ancora incassare. Le pagine di tenant restano costruite e
  // funzionanti — semplicemente non sono le sue.
  if (has('GOD')) {
    return { ...NONE, platform: true, platformDashboard: true };
  }

  if (has('OWNER')) {
    return {
      ...NONE,
      dashboard: true,
      reports: true,
      organization: true,
      events: true,
      eventsWrite: true,
      publishEvent: true,
      directory: true,
      directoryWrite: true,
      registrations: true,
      registrationsWrite: true,
      refunds: true,
    };
  }

  if (has('EVENT_MANAGER')) {
    return {
      ...NONE,
      dashboard: true,
      reports: true,
      events: true,
      eventsWrite: true,
      publishEvent: true,
      directory: true,
      directoryWrite: true,
      registrations: true,
      registrationsWrite: true,
    };
  }

  if (has('CHECKIN_OPERATOR')) {
    // `/check-in` e `/registrations` in sola lettura — e nient'altro (§1).
    return { ...NONE, registrations: true };
  }

  // `DANCER` non entra in questa applicazione: la sua superficie è `www`.
  return { ...NONE };
}
