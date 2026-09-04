import { KeijoIconShape, PillVariant } from '@keijo/ui';
import {
  accountBalance,
  block,
  campaign,
  cancel,
  celebration,
  check,
  checkCircle,
  checklist,
  contentCopy,
  creditCard,
  description,
  doneAll,
  draft,
  editNote,
  euro,
  eventSeat,
  favorite,
  handshake,
  howToReg,
  inventory,
  key,
  lock,
  lockOpen,
  meetingRoom,
  musicNote,
  nightlife,
  numbers,
  payments,
  pending,
  percent,
  person,
  playArrow,
  publish,
  qrCode,
  restaurant,
  rule,
  scale,
  schedule,
  sell,
  storefront,
  swapHoriz,
  theaters,
  visibility,
  warning,
} from '@keijo/ui/icons';

/**
 * Enumerazioni del §3.5 con le **etichette italiane** del §1.
 *
 * La tabella di corrispondenza del §1 è **vincolante**:
 *  - `TicketType` è «Titolo d'ingresso», **mai** «biglietto»;
 *  - `Registration` è «Iscrizione», la persona nell'evento;
 *  - `LEADER` / `FOLLOWER` sono «Leader» / «Follower», **mai** «uomo/donna»:
 *    nel tango il ruolo è indipendente dal genere (`RB6`).
 *
 * Ogni stato porta variante **e icona semantica** (`KEIJO-PILL-ICON-SEMANTIC`):
 * l'icona deriva dallo stato, non è una sola icona riusata ovunque.
 */

export interface StatusUi {
  label: string;
  variant: PillVariant;
  icon: KeijoIconShape;
  /** Spiegazione breve, usata nei tooltip dove lo stato non è ovvio. */
  hint?: string;
}

// ---------------------------------------------------------------------------
// Ruoli di ballo
// ---------------------------------------------------------------------------

export type DanceRole = 'LEADER' | 'FOLLOWER';
export type DeclaredDanceRole = 'LEADER' | 'FOLLOWER' | 'FLEXIBLE';
export type PreferredDanceRole = 'LEADER' | 'FOLLOWER' | 'BOTH';

export const DANCE_ROLE_UI: Record<DanceRole, StatusUi> = {
  LEADER: { label: 'Leader', variant: 'info', icon: person },
  FOLLOWER: { label: 'Follower', variant: 'info', icon: favorite },
};

export const DECLARED_DANCE_ROLE_UI: Record<DeclaredDanceRole, StatusUi> = {
  LEADER: { label: 'Leader', variant: 'info', icon: person },
  FOLLOWER: { label: 'Follower', variant: 'info', icon: favorite },
  FLEXIBLE: {
    label: 'Ruolo flessibile',
    variant: 'default',
    icon: swapHoriz,
    hint: 'Il ruolo effettivo viene assegnato in base all’equilibrio dell’evento.',
  },
};

export const DANCE_ROLE_OPTIONS = [
  { label: 'Leader', value: 'LEADER' },
  { label: 'Follower', value: 'FOLLOWER' },
];

export const DECLARED_DANCE_ROLE_OPTIONS = [
  { label: 'Leader', value: 'LEADER' },
  { label: 'Follower', value: 'FOLLOWER' },
  { label: 'Ruolo flessibile', value: 'FLEXIBLE' },
];

// ---------------------------------------------------------------------------
// Organizzazione
// ---------------------------------------------------------------------------

export type OrganizationStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';

export const ORGANIZATION_STATUS_UI: Record<OrganizationStatus, StatusUi> = {
  PENDING: { label: 'In attesa', variant: 'warning', icon: pending },
  APPROVED: { label: 'Approvata', variant: 'success', icon: checkCircle },
  SUSPENDED: { label: 'Sospesa', variant: 'error', icon: block },
  REJECTED: { label: 'Respinta', variant: 'error', icon: cancel },
};

export const ORGANIZATION_STATUS_OPTIONS = [
  { label: 'In attesa', value: 'PENDING' },
  { label: 'Approvata', value: 'APPROVED' },
  { label: 'Sospesa', value: 'SUSPENDED' },
  { label: 'Respinta', value: 'REJECTED' },
];

export type PayoutStatus = 'NOT_CONNECTED' | 'PENDING' | 'ENABLED' | 'DISABLED';

export const PAYOUT_STATUS_UI: Record<PayoutStatus, StatusUi> = {
  NOT_CONNECTED: {
    label: 'Account non collegato',
    variant: 'default',
    icon: accountBalance,
    hint: 'Nessun account di incasso collegato: la vendita online non è ancora possibile.',
  },
  PENDING: {
    label: 'Verifica in corso',
    variant: 'warning',
    icon: schedule,
    hint: 'Il prestatore di pagamento sta ancora verificando i dati dell’organizzazione.',
  },
  ENABLED: {
    label: 'Abilitata all’incasso',
    variant: 'success',
    icon: payments,
  },
  DISABLED: {
    label: 'Incasso sospeso',
    variant: 'error',
    icon: block,
    hint: 'I biglietti già emessi restano validi e i rimborsi restano eseguibili.',
  },
};

export type FiscalDeclarationKind = 'ORGANIZATION_FRAMEWORK' | 'EVENT_ATTESTATION';

export const FISCAL_DECLARATION_KIND_UI: Record<FiscalDeclarationKind, StatusUi> = {
  ORGANIZATION_FRAMEWORK: {
    label: 'Inquadramento dell’organizzazione',
    variant: 'info',
    icon: description,
  },
  EVENT_ATTESTATION: { label: 'Attestazione di evento', variant: 'default', icon: checklist },
};

export const FISCAL_DECLARATION_KIND_OPTIONS = [
  { label: 'Inquadramento dell’organizzazione', value: 'ORGANIZATION_FRAMEWORK' },
  { label: 'Attestazione di evento', value: 'EVENT_ATTESTATION' },
];

// ---------------------------------------------------------------------------
// Evento
// ---------------------------------------------------------------------------

export type EventStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'SALES_CLOSED'
  | 'RUNNING'
  | 'ENDED'
  | 'ARCHIVED'
  | 'CANCELLED';

export const EVENT_STATUS_UI: Record<EventStatus, StatusUi> = {
  DRAFT: { label: 'Bozza', variant: 'draft', icon: editNote },
  PUBLISHED: { label: 'Pubblicato', variant: 'success', icon: publish },
  SALES_CLOSED: {
    label: 'Vendite chiuse',
    variant: 'warning',
    icon: lock,
    hint: 'L’evento si svolge regolarmente: è chiusa solo la vendita online.',
  },
  RUNNING: { label: 'In corso', variant: 'info', icon: playArrow },
  ENDED: { label: 'Concluso', variant: 'default', icon: doneAll },
  ARCHIVED: { label: 'Archiviato', variant: 'default', icon: inventory },
  CANCELLED: { label: 'Annullato', variant: 'error', icon: cancel },
};

export const EVENT_STATUS_OPTIONS = (Object.keys(EVENT_STATUS_UI) as EventStatus[]).map((key) => ({
  label: EVENT_STATUS_UI[key].label,
  value: key,
}));

export type SalesCloseCriterion = 'DATE' | 'QUOTA_EXHAUSTED' | 'MANUAL' | 'EVENT_START';

export const SALES_CLOSE_CRITERION_LABEL: Record<SalesCloseCriterion, string> = {
  DATE: 'A una data stabilita',
  QUOTA_EXHAUSTED: 'All’esaurimento delle quote',
  MANUAL: 'Chiusura manuale',
  EVENT_START: 'All’inizio dell’evento',
};

export const SALES_CLOSE_CRITERION_OPTIONS = (
  Object.keys(SALES_CLOSE_CRITERION_LABEL) as SalesCloseCriterion[]
).map((key) => ({ label: SALES_CLOSE_CRITERION_LABEL[key], value: key }));

export type ArtistKind = 'TEACHER' | 'DJ' | 'ORCHESTRA';

export const ARTIST_KIND_UI: Record<ArtistKind, StatusUi> = {
  TEACHER: { label: 'Maestro', variant: 'info', icon: person },
  DJ: { label: 'DJ', variant: 'default', icon: musicNote },
  ORCHESTRA: { label: 'Orchestra', variant: 'default', icon: theaters },
};

export const ARTIST_KIND_OPTIONS = (Object.keys(ARTIST_KIND_UI) as ArtistKind[]).map((key) => ({
  label: ARTIST_KIND_UI[key].label,
  value: key,
}));

// ---------------------------------------------------------------------------
// Titolo d'ingresso — mai «biglietto» (§1)
// ---------------------------------------------------------------------------

export type SaleUnit = 'PER_PERSON' | 'PER_COUPLE';

export const SALE_UNIT_UI: Record<SaleUnit, StatusUi> = {
  PER_PERSON: { label: 'Per persona', variant: 'default', icon: person },
  PER_COUPLE: { label: 'Per coppia', variant: 'info', icon: handshake },
};

export const SALE_UNIT_OPTIONS = [
  { label: 'Per persona', value: 'PER_PERSON' },
  { label: 'Per coppia', value: 'PER_COUPLE' },
];

export type TicketTypeVisibility = 'PUBLIC' | 'CODE_RESTRICTED';

export const TICKET_TYPE_VISIBILITY_UI: Record<TicketTypeVisibility, StatusUi> = {
  PUBLIC: { label: 'Pubblico', variant: 'success', icon: visibility },
  CODE_RESTRICTED: { label: 'Con codice', variant: 'warning', icon: key },
};

export const TICKET_TYPE_VISIBILITY_OPTIONS = [
  { label: 'Pubblico', value: 'PUBLIC' },
  { label: 'Con codice di accesso', value: 'CODE_RESTRICTED' },
];

export type PriceTierKind = 'BY_DATE' | 'BY_QUANTITY' | 'COMBINED';

export const PRICE_TIER_KIND_UI: Record<PriceTierKind, StatusUi> = {
  BY_DATE: { label: 'A data', variant: 'info', icon: schedule },
  BY_QUANTITY: { label: 'A quantità', variant: 'info', icon: numbers },
  COMBINED: { label: 'Combinato', variant: 'default', icon: scale },
};

export const PRICE_TIER_KIND_OPTIONS = (Object.keys(PRICE_TIER_KIND_UI) as PriceTierKind[]).map(
  (key) => ({ label: PRICE_TIER_KIND_UI[key].label, value: key }),
);

// ---------------------------------------------------------------------------
// Quote di capienza
// ---------------------------------------------------------------------------

export type QuotaScope = 'EVENT' | 'SESSION' | 'TICKET_TYPE' | 'SERVICE';

export const QUOTA_SCOPE_UI: Record<QuotaScope, StatusUi> = {
  EVENT: { label: 'Evento', variant: 'info', icon: celebration },
  SESSION: { label: 'Sessione', variant: 'default', icon: nightlife },
  TICKET_TYPE: { label: 'Titolo d’ingresso', variant: 'default', icon: sell },
  SERVICE: { label: 'Servizio', variant: 'default', icon: restaurant },
};

export const QUOTA_SCOPE_OPTIONS = (Object.keys(QUOTA_SCOPE_UI) as QuotaScope[]).map((key) => ({
  label: QUOTA_SCOPE_UI[key].label,
  value: key,
}));

export type QuotaReservedFor = 'COMPLIMENTARY' | 'EXTERNAL_CHANNEL';

export const QUOTA_RESERVED_FOR_UI: Record<QuotaReservedFor, StatusUi> = {
  COMPLIMENTARY: { label: 'Accrediti', variant: 'default', icon: celebration },
  EXTERNAL_CHANNEL: { label: 'Canali esterni', variant: 'default', icon: storefront },
};

export const QUOTA_RESERVED_FOR_OPTIONS = [
  { label: 'Nessuno (vendita ordinaria)', value: '' },
  { label: 'Accrediti', value: 'COMPLIMENTARY' },
  { label: 'Canali esterni', value: 'EXTERNAL_CHANNEL' },
];

// ---------------------------------------------------------------------------
// Requisiti
// ---------------------------------------------------------------------------

export type RequirementKind = 'DECLARATION' | 'CUSTOM_FIELD';

export const REQUIREMENT_KIND_UI: Record<RequirementKind, StatusUi> = {
  DECLARATION: { label: 'Dichiarazione', variant: 'info', icon: description },
  CUSTOM_FIELD: { label: 'Campo personalizzato', variant: 'default', icon: editNote },
};

export const REQUIREMENT_KIND_OPTIONS = [
  { label: 'Dichiarazione', value: 'DECLARATION' },
  { label: 'Campo personalizzato', value: 'CUSTOM_FIELD' },
];

export type RequirementBlocking = 'PURCHASE' | 'ENTRY' | 'NONE';

export const REQUIREMENT_BLOCKING_UI: Record<RequirementBlocking, StatusUi> = {
  PURCHASE: { label: 'Blocca l’acquisto', variant: 'error', icon: block },
  ENTRY: { label: 'Blocca l’ingresso', variant: 'warning', icon: meetingRoom },
  NONE: { label: 'Non blocca', variant: 'default', icon: check },
};

export const REQUIREMENT_BLOCKING_OPTIONS = [
  { label: 'Non blocca', value: 'NONE' },
  { label: 'Blocca l’acquisto', value: 'PURCHASE' },
  { label: 'Blocca l’ingresso', value: 'ENTRY' },
];

export type RequirementVerification = 'AUTOMATIC' | 'MANUAL';

export const REQUIREMENT_VERIFICATION_UI: Record<RequirementVerification, StatusUi> = {
  AUTOMATIC: { label: 'Automatica', variant: 'default', icon: rule },
  MANUAL: { label: 'Manuale', variant: 'warning', icon: howToReg },
};

export const REQUIREMENT_VERIFICATION_OPTIONS = [
  { label: 'Automatica', value: 'AUTOMATIC' },
  { label: 'Manuale', value: 'MANUAL' },
];

export type RequirementOutcomeStatus =
  | 'TO_PROVIDE'
  | 'UNDER_REVIEW'
  | 'VALID'
  | 'REJECTED'
  | 'EXPIRED';

export const REQUIREMENT_OUTCOME_STATUS_UI: Record<RequirementOutcomeStatus, StatusUi> = {
  TO_PROVIDE: { label: 'Da fornire', variant: 'warning', icon: pending },
  UNDER_REVIEW: { label: 'In verifica', variant: 'info', icon: schedule },
  VALID: { label: 'Valido', variant: 'success', icon: checkCircle },
  REJECTED: { label: 'Respinto', variant: 'error', icon: cancel },
  EXPIRED: { label: 'Scaduto', variant: 'error', icon: schedule },
};

// ---------------------------------------------------------------------------
// Iscrizione — la persona nell'evento, non il titolo economico (§1)
// ---------------------------------------------------------------------------

export type RegistrationStatus = 'CONFIRMED' | 'TO_CONFIRM' | 'DECLINED';

export const REGISTRATION_STATUS_UI: Record<RegistrationStatus, StatusUi> = {
  CONFIRMED: { label: 'Confermata', variant: 'success', icon: checkCircle },
  TO_CONFIRM: { label: 'Da confermare', variant: 'warning', icon: pending },
  DECLINED: { label: 'Rifiutata', variant: 'error', icon: cancel },
};

export const REGISTRATION_STATUS_OPTIONS = (
  Object.keys(REGISTRATION_STATUS_UI) as RegistrationStatus[]
).map((key) => ({ label: REGISTRATION_STATUS_UI[key].label, value: key }));

export type RegistrationChannel =
  | 'ONLINE_SALE'
  | 'DOOR_SALE'
  | 'COMPLIMENTARY'
  | 'EXTERNAL_CHANNEL';

export const REGISTRATION_CHANNEL_UI: Record<RegistrationChannel, StatusUi> = {
  ONLINE_SALE: { label: 'Vendita online', variant: 'default', icon: euro },
  DOOR_SALE: { label: 'Vendita alla porta', variant: 'default', icon: meetingRoom },
  COMPLIMENTARY: { label: 'Accredito', variant: 'default', icon: celebration },
  EXTERNAL_CHANNEL: { label: 'Canale esterno', variant: 'default', icon: storefront },
};

export const REGISTRATION_CHANNEL_OPTIONS = (
  Object.keys(REGISTRATION_CHANNEL_UI) as RegistrationChannel[]
).map((key) => ({ label: REGISTRATION_CHANNEL_UI[key].label, value: key }));

// ---------------------------------------------------------------------------
// Il saldo incassato al botteghino — `14-acconto-e-saldo.md` §6
// ---------------------------------------------------------------------------

export type BalanceSettlementMethod = 'CASH' | 'POS' | 'SATISPAY' | 'BANK_TRANSFER' | 'OTHER';

/**
 * Come il saldo è stato materialmente incassato.
 *
 * È una **spunta, non un prestatore di pagamento**: Mirada non incassa nulla,
 * prende nota di ciò che qualcuno ha preso in mano. Nessuna di queste voci apre
 * un flusso, chiama un'API o produce una ricevuta — gli adempimenti fiscali su
 * quel contante restano dell'organizzatore (`RB26`).
 */
export const BALANCE_SETTLEMENT_METHOD_UI: Record<BalanceSettlementMethod, StatusUi> = {
  CASH: { label: 'Contanti', variant: 'default', icon: euro },
  POS: { label: 'POS', variant: 'default', icon: creditCard },
  SATISPAY: { label: 'Satispay', variant: 'default', icon: qrCode },
  BANK_TRANSFER: { label: 'Bonifico', variant: 'default', icon: accountBalance },
  // `payments` resta soltanto qui: un'icona generica per la voce generica.
  OTHER: { label: 'Altro', variant: 'default', icon: payments },
};

export const BALANCE_SETTLEMENT_METHOD_OPTIONS = (
  Object.keys(BALANCE_SETTLEMENT_METHOD_UI) as BalanceSettlementMethod[]
).map((key) => ({ label: BALANCE_SETTLEMENT_METHOD_UI[key].label, value: key }));

// ---------------------------------------------------------------------------
// Icone di supporto riesportate: le pagine non ne inventano di nuove
// ---------------------------------------------------------------------------

export const ICON = {
  copy: contentCopy,
  warning,
  percent,
  seat: eventSeat,
  draft,
  campaign,
  unlock: lockOpen,
} as const;
