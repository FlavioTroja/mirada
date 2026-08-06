import { DanceRole, DeclaredDanceRole, EventStatus, QuotaReservedFor, QuotaScope } from './enums';

/**
 * Forme di `GET /events/:id/dashboard` e `POST /events/:id/exports` (§3.7).
 *
 * **`RB21` è realizzato nella forma, non a parole.** Ogni sezione porta
 * `available` e `basedOn`; se non calcolabile porta `requires` e `reason`.
 * Una sezione `available: false` **non va nascosta né mostrata come zero**: va
 * presentata come *non ancora calcolabile*, con il motivo che il backend
 * fornisce. Un cruscotto che scrive «incasso netto: 0 €» quando gli ordini non
 * esistono mente all'organizzatore la sera dell'evento.
 *
 * Attenzione ai nomi: `committedByTicketType` è ciò che il motore di capienza ha
 * **impegnato**, non venduto; `soldByTicketType` esiste **vuota e motivata**.
 * Non vanno fuse e la prima non va chiamata «venduto».
 */

/** Parte comune a ogni sezione calcolabile. */
export interface AvailableSection {
  available: true;
  /** Le entità su cui la sezione è calcolata (`RB21`). */
  basedOn: string[];
  /** Avvertenza del backend sul significato esatto dei numeri. */
  note?: string;
}

/** Parte comune a ogni sezione **non** calcolabile. */
export interface UnavailableSection {
  available: false;
  /** Le entità che mancano perché il calcolo esista. */
  requires: string[];
  /** Il motivo, in italiano, così come lo scrive il backend. */
  reason: string;
}

export type Section<T> = (AvailableSection & T) | UnavailableSection;

export function isAvailable<T>(section: Section<T> | undefined | null): section is AvailableSection & T {
  return !!section && section.available === true;
}

export function unavailableOf<T>(section: Section<T> | undefined | null): UnavailableSection | null {
  return section && section.available === false ? section : null;
}

/** Perimetro del cruscotto: cosa non è ancora costruito, dichiarato in testa. */
export interface DashboardPerimeter {
  note: string;
  missingEntities: string[];
}

export interface RoleQuotaLine {
  id: number;
  role: DanceRole;
  limit: number;
  consumed: number;
  remaining: number | null;
  imbalanceTolerance?: number | null;
}

export interface RegistrationsByRole {
  leader: number;
  follower: number;
  unassigned: number;
  total: number;
  declared: Partial<Record<DeclaredDanceRole, number>>;
  /** Con il **segno**: positivo = eccesso di leader. */
  imbalance: number;
  imbalanceTolerance: number | null;
  roleQuotas: RoleQuotaLine[];
}

export interface CapacityRoom {
  limit: number;
  consumed: number;
  remaining: number;
}

export interface CapacityQuotaLine {
  id: number;
  scope: QuotaScope;
  scopeId: number | null;
  /**
   * Il nome dell'entità a cui la quota si riferisce — `I18nText`, oppure `null`
   * per l'ambito `EVENT`, che un nome non ce l'ha perché è l'evento stesso.
   *
   * Senza, il cruscotto elencava ventotto righe che dicevano «Sessione 0 / 30»
   * venti volte identiche: il `scopeId` da solo non è un'informazione che un
   * organizzatore possa usare.
   */
  scopeName?: unknown;
  /** Inizio della sessione — solo per l'ambito `SESSION`, dove il nome si ripete. */
  scopeStartAt?: string | null;
  role: DanceRole | null;
  reservedFor: QuotaReservedFor | null;
  limit: number;
  consumed: number;
  remaining: number;
  limiting: boolean;
}

export interface CapacitySection {
  /** `null` quando la capienza della sala non è configurata: assenza di quota
   *  significa **assenza di vincolo**, non zero posti. */
  room: CapacityRoom | null;
  quotas: CapacityQuotaLine[];
}

/**
 * Unità **impegnate** dal motore, mai «vendute». `null` = nessuna quota configurata.
 *
 * La chiave è `ticketTypeId` e non `id`: è il nome che il §3 usa, e dichiararlo
 * `id` non era un dettaglio di stile — `@for … track item.id` produceva la
 * stessa chiave vuota su ogni riga e Angular rifiutava l'elenco con `NG0955`.
 */
export interface CommittedLine {
  ticketTypeId: number;
  name?: unknown;
  limit: number | null;
  committed: number | null;
  remaining: number | null;
}

export interface CommittedSection {
  items: CommittedLine[];
}

/** Servizi accessori impegnati: stessa forma dei titoli, chiave diversa. */
export interface ServiceLine {
  eventServiceId: number;
  name?: unknown;
  price: number;
  limit: number | null;
  committed: number | null;
  remaining: number | null;
}

export interface ServicesSection {
  items: ServiceLine[];
}

/**
 * Venduto per titolo — **il saldato**, non l'impegnato.
 *
 * Le due grandezze divergono per tutta la durata di una prenotazione di quindici
 * minuti, e il cruscotto non le somma mai (`RB21`).
 */
export interface SoldLine {
  ticketTypeId: number;
  name?: unknown;
  basePrice: number;
  sold: number;
  /** Centesimi, al lordo dei rimborsi finché `Refund` non esiste. */
  gross: number;
}

export interface SoldSection {
  items: SoldLine[];
  servicesGross: number;
}

/**
 * Il denaro. Tre destinatari diversi, tre numeri diversi: `subtotal`
 * all'organizzatore, `presaleRights` alla piattaforma, `total` pagato dal
 * compratore. `cashed` è ciò che è davvero transitato e può essere minore di
 * `total`, perché un ordine a importo zero si chiude senza pagamento.
 */
export interface RevenueSection {
  paidOrders: number;
  zeroAmountOrders: number;
  subtotal: number;
  presaleRights: number;
  total: number;
  cashed: number;
}

/** Presenze — asse distinto dalle quote (`RB19`), mai sommato ai contatori. */
export interface AttendanceSessionLine {
  sessionId: number;
  name?: unknown;
  startAt: string;
  entries: number;
}

export interface AttendanceSection {
  totalEntries: number;
  distinctTickets: number;
  openConflicts: number;
  bySession: AttendanceSessionLine[];
}

/** Requisiti mancanti — solo nome e conteggio, mai il contenuto (`RB12`). */
export interface MissingRequirementLine {
  eventRequirementId: number;
  label?: unknown;
  blocking: string;
  mandatory: boolean;
  missing: number;
}

export interface MissingRequirementsSection {
  registrationsWithMissing: number;
  byRequirement: MissingRequirementLine[];
}

export interface CouplesSection {
  complete: number;
  incomplete: number;
  dissolved: number;
  total: number;
}

export interface ConfiguredRequirement {
  eventRequirementId: number;
  label?: unknown;
  mandatory?: boolean;
  blocking?: string;
  verification?: string;
}

export interface RequirementsSection {
  configured: ConfiguredRequirement[];
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface TrendSection {
  granularity: string;
  points: TrendPoint[];
}

export interface EventDashboard {
  eventId: number;
  slug: string;
  status: EventStatus;
  generatedAt: string;
  perimeter: DashboardPerimeter;
  /**
   * Le sezioni, indicizzate per nome. L'elenco dei nomi è del backend e non va
   * congelato qui: la pagina legge quelli che conosce con `DashboardStore.section<T>()`
   * e presenta comunque **tutte** quelle dichiarate non calcolabili.
   *
   * Nomi noti oggi: `registrationsByRole` (`RegistrationsByRole`), `capacity`
   * (`CapacitySection`), `committedByTicketType` e `committedServices`
   * (`CommittedSection` — **impegnato**, non venduto), `couples`
   * (`CouplesSection`), `requirements` (`RequirementsSection`),
   * `registrationsTrend` (`TrendSection`), più `soldByTicketType`,
   * `netRevenue`, `missingRequirements` e `attendance`, che il backend
   * restituisce **vuote e motivate**.
   */
  sections: Record<string, Section<Record<string, unknown>> | undefined>;
}

/** `kind` ammessi da `POST /events/:id/exports` — elenco chiuso del §3.7. */
export const EXPORT_KINDS = [
  'REGISTRATIONS',
  'ORDERS',
  'REVENUE',
  'ATTENDANCE',
  'SALES_BY_SESSION',
] as const;

export type ExportKind = (typeof EXPORT_KINDS)[number];

export interface ExportKindUi {
  kind: ExportKind;
  label: string;
  /** Perché esiste: non è una comodità, in un caso è un vincolo di posizionamento. */
  description: string;
}

/**
 * `SALES_BY_SESSION` resta **visibile e dichiarato indisponibile**: è una delle
 * tre condizioni che reggono il posizionamento fiscale della piattaforma
 * (`RF-BKO-9`), e nasconderlo lo farebbe dimenticare.
 */
export const EXPORT_KIND_UI: ExportKindUi[] = [
  {
    kind: 'REGISTRATIONS',
    label: 'Iscritti',
    description:
      'Una riga per iscrizione: nominativo, ruolo dichiarato e assegnato, canale, stato. ' +
      'Nessun contatto oltre l’email del titolare, nessun contenuto dei requisiti.',
  },
  {
    kind: 'ORDERS',
    label: 'Ordini',
    description: 'Una riga per ordine, con righe, diritti di prevendita e stato del pagamento.',
  },
  {
    kind: 'REVENUE',
    label: 'Incassi',
    description: 'Incassato, rimborsato e diritti di prevendita maturati.',
  },
  {
    kind: 'ATTENDANCE',
    label: 'Presenze',
    description: 'Ingressi registrati per sessione, sulla coppia biglietto–sessione.',
  },
  {
    kind: 'SALES_BY_SESSION',
    label: 'Vendite con dettaglio per sessione',
    description:
      'Il venduto attribuito alle singole sessioni con il loro peso di ripartizione ' +
      '(`RF-BKO-9`): una delle tre condizioni che reggono il posizionamento fiscale ' +
      'della piattaforma. Non va tagliata né semplificata.',
  },
];

/** Esito di `POST /events/:id/exports`. */
export interface ExportResult {
  fileUrl: string;
  fileId: number;
  kind: ExportKind;
  columns: string[];
  rows: number;
  generatedAt: string;
  /** Le entità su cui il tracciato è calcolato (`RB21`). */
  basedOn: string[];
}
