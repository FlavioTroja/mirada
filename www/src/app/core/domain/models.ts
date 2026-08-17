/**
 * Forme consumate dall'applicazione pubblica. Sono un **sottoinsieme** del §3.6:
 * qui vive solo ciò che le tre pagine di `www` leggono davvero.
 *
 * I nomi delle entità restano inglesi (§1, decisione D-B); le etichette italiane
 * stanno nell'interfaccia. `TicketType` è «Titolo d'ingresso», mai «biglietto»:
 * il biglietto è `Ticket`, l'esemplare venduto.
 */

/** §3.5 — testo traducibile. In assenza di `en` si mostra `it` dichiarando la lingua. */
export interface I18nText {
  it?: string;
  en?: string;
  [lang: string]: string | undefined;
}

export type DanceRole = 'LEADER' | 'FOLLOWER';
export type DeclaredDanceRole = 'LEADER' | 'FOLLOWER' | 'FLEXIBLE';
export type SaleUnit = 'PER_PERSON' | 'PER_COUPLE';
export type TicketTypeVisibility = 'PUBLIC' | 'CODE_RESTRICTED';
export type PriceTierKind = 'BY_DATE' | 'BY_QUANTITY' | 'COMBINED';
export type SalesCloseCriterion = 'DATE' | 'QUOTA_EXHAUSTED' | 'MANUAL' | 'EVENT_START';
export type ArtistKind = 'TEACHER' | 'DJ' | 'ORCHESTRA';

// ───────────────────────────────────────────────────────────────────────────
// Ricerca pubblica — `POST /api/public/events/` (§3.7)
// ───────────────────────────────────────────────────────────────────────────

/** `query` della ricerca pubblica: elenco chiuso, dichiarato nel §3.7. */
export interface PublicEventQuery {
  value?: string;
  city?: string;
  province?: string;
  region?: string;
  country?: string;
  eventTypeId?: number;
  /** `from`/`to` filtrano sulla **sovrapposizione** con l'intervallo dell'evento. */
  from?: string;
  to?: string;
  /** Restringe a ciò che ha ancora capienza **per quel ruolo di ballo**. */
  role?: DanceRole;
}

export interface PublicCardAvailability {
  soldOut: boolean;
  remaining: number | null;
  roles?: { leader: number | null; follower: number | null };
  rolesOnHold?: { leader: boolean; follower: boolean };
}

export interface PublicEventCard {
  id: number;
  slug: string;
  title: I18nText;
  startAt: string;
  endAt: string;
  eventType: { id: number; slug: string; name: I18nText };
  venue: {
    id: number;
    name: string;
    city?: string | null;
    province?: string | null;
    region?: string | null;
    country?: string | null;
  };
  organization: { id: number; name: string };
  posterVerticalUrl?: string | null;
  posterHorizontalUrl?: string | null;
  posterSquareUrl?: string | null;
  /** Centesimi interi, come ogni importo (§3.1). */
  priceFrom: number | null;
  availability: PublicCardAvailability;
}

// ───────────────────────────────────────────────────────────────────────────
// Scheda evento — `GET /api/public/events/:slug` (§3.7)
// ───────────────────────────────────────────────────────────────────────────

export interface PublicFile {
  id: number;
  url?: string | null;
  path?: string | null;
  name?: string | null;
}

export interface PublicSession {
  id: number;
  name: I18nText;
  startAt: string;
  endAt: string;
  room?: string | null;
  level?: string | null;
  allocationWeight: number;
  isImplicit: boolean;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  sortOrder: number;
}

export interface PublicArtist {
  id: number;
  name: string;
  kind: ArtistKind;
  bio?: I18nText | null;
  photoFileId?: number | null;
  photoFile?: PublicFile | null;
  website?: string | null;
}

export interface PublicEventCast {
  id: number;
  artistId: number;
  kind: ArtistKind;
  sortOrder: number;
  artist: PublicArtist;
}

export interface PublicPriceTier {
  id: number;
  kind: PriceTierKind;
  price: number;
  validUntil?: string | null;
  maxQuantity?: number | null;
  soldQuantity: number;
  sortOrder: number;
}

export interface PublicTicketTypeSession {
  id: number;
  ticketTypeId: number;
  sessionId: number;
}

export interface PublicTicketType {
  id: number;
  name: I18nText;
  description?: I18nText | null;
  basePrice: number;
  saleUnit: SaleUnit;
  roleConstraint?: DanceRole | null;
  consumesRoleQuota: boolean;
  saleOpensAt?: string | null;
  saleClosesAt?: string | null;
  visibility: TicketTypeVisibility;
  minPerOrder: number;
  maxPerOrder: number;
  indicatedLevel?: string | null;
  highlighted: boolean;
  sortOrder: number;
  sessions?: PublicTicketTypeSession[];
  priceTiers?: PublicPriceTier[];
}

export interface PublicEventRequirement {
  id: number;
  label: I18nText;
  text: I18nText;
  mandatory: boolean;
  blocking: 'PURCHASE' | 'ENTRY' | 'NONE';
  verification: 'AUTOMATIC' | 'MANUAL';
  dueAt?: string | null;
  sortOrder: number;
}

export interface PublicEventService {
  id: number;
  name: I18nText;
  description?: I18nText | null;
  price: number;
  refundCutoffAt?: string | null;
  sortOrder: number;
}

export interface PublicAddress {
  country?: string | null;
  province?: string | null;
  city?: string | null;
  zipCode?: string | null;
  address?: string | null;
  number?: string | null;
  region?: string | null;
}

export interface PublicVenue {
  id: number;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  capacity?: number | null;
  accessibility?: string | null;
  airConditioning: boolean;
  parking: boolean;
  notes?: string | null;
  address?: PublicAddress | null;
}

export interface PublicOrganization {
  id: number;
  name: string;
  legalName?: string | null;
  website?: string | null;
  contactEmail?: string | null;
  logoFileId?: number | null;
}

export interface PublicEvent {
  id: number;
  slug: string;
  title: I18nText;
  description: I18nText;
  startAt: string;
  endAt: string;
  contentLanguage: string;
  secondLanguage?: string | null;
  tags: string[];
  status: string;
  refundPolicyText: I18nText;
  refundPolicy?: { name: I18nText; tiers?: unknown } | null;
  minorsAdmitted: boolean;
  minorsConditions?: I18nText | null;
  salesCloseAt?: string | null;
  salesCloseCriteria: SalesCloseCriterion[];
  publishedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  organization: PublicOrganization;
  eventType: { id: number; slug: string; name: I18nText };
  venue: PublicVenue;
  posterVerticalFile?: PublicFile | null;
  posterHorizontalFile?: PublicFile | null;
  posterSquareFile?: PublicFile | null;
  sessions: PublicSession[];
  casts: PublicEventCast[];
  requirements: PublicEventRequirement[];
  services: PublicEventService[];
  ticketTypes: PublicTicketType[];
}

// ───────────────────────────────────────────────────────────────────────────
// Disponibilità viva — `POST /api/public/events/:id/availability` (§3.7)
// ───────────────────────────────────────────────────────────────────────────

export interface TicketTypeAvailability {
  id: number;
  /** Conta le sole quote `publiclyVisible`; `soldOut` guarda **tutte** le limitanti. */
  remaining: number | null;
  soldOut: boolean;
  /** Sintesi: «questo titolo è bloccato per almeno un ruolo». */
  roleOnHold: boolean;
  /** Quale ruolo è bloccato. Il backend oggi lo espone solo a livello di evento. */
  rolesOnHold?: { leader: boolean; follower: boolean };
  activeTier?: {
    price: number;
    expiresAt?: string | null;
    remainingAtThisPrice?: number | null;
  } | null;
}

export interface EventAvailability {
  eventId?: number;
  ticketTypes: TicketTypeAvailability[];
  roles: { leader: number | null; follower: number | null };
  rolesOnHold?: { leader: boolean; follower: boolean };
  imbalance: number;
  imbalanceTolerance: number | null;
}

// ───────────────────────────────────────────────────────────────────────────
// Ordine, prenotazione (§3.7)
// ───────────────────────────────────────────────────────────────────────────

export interface OrderAttendee {
  name: string;
  surname: string;
  email: string;
  declaredRole: DeclaredDanceRole;
}

export interface OrderReserveLine {
  ticketTypeId?: number;
  eventServiceId?: number;
  quantity: number;
}

export interface Order {
  id: number;
  purchaseId: number;
  organizationId: number;
  eventId: number;
  status: 'PENDING_PAYMENT' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
  subtotal: number;
  presaleRights: number;
  total: number;
  expiresAt?: string | null;
  paidAt?: string | null;
}

export interface ReserveOutcome {
  purchase: { id: number; totalAmount: number; totalPresaleRights: number };
  orders: Order[];
  expiresAt: string;
  registrationIds?: number[];
}

export interface Ticket {
  id: number;
  eventId: number;
  ticketTypeId: number;
  code: string;
  status: 'VALID' | 'TRANSFERRED' | 'CANCELLED' | 'REFUNDED';
  holderName: string;
  holderSurname: string;
  holderEmail?: string | null;
  bearer: boolean;
  qrIssuedAt: string;
}

export interface FulfilmentOutcome {
  order: Order;
  payment: { id: number; provider: 'NONE' | 'STRIPE'; status: string; amount: number };
  tickets: Ticket[];
  confirmedRegistrationIds: number[];
}

/** `POST /api/users/register` (§3.7) — il template usa `firstName`/`lastName`. */
export interface RegisterPayload {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  /**
   * L'evento da cui parte l'iscrizione. Il server lo usa per nominarlo
   * nell'email di conferma e per riportare qui la persona dopo il clic, invece
   * di lasciarla su una pagina di benvenuto generica a ricominciare da capo.
   */
  eventSlug?: string | null;
}

export interface AuthenticatedUser {
  id: number;
  username: string;
  wsCode?: string;
  person?: {
    name: string;
    surname: string;
    contact?: { email?: string | null } | null;
  } | null;
  /** Popolato da `GET /auth/profile`: serve il ritratto già in testata. */
  dancerProfile?: DancerProfile | null;
}

/** Ruolo che la persona preferisce ballare. `BOTH` non è un'incertezza: è una scelta. */
export type PreferredDanceRole = 'LEADER' | 'FOLLOWER' | 'BOTH';

/**
 * **Il profilo da ballerino** — `GET/POST/PATCH /api/dancer-profiles` (§4.3).
 *
 * È una riga distinta da `User` e da `Person`, e la distinzione conta: `Person`
 * è l'anagrafica che serve a emettere un biglietto — nome, cognome, codice
 * fiscale — mentre questo è ciò che la persona sceglie di mostrare di sé come
 * ballerina. Il primo si corregge, il secondo si cambia quando si vuole.
 *
 * Il `nickname` è unico su tutta la piattaforma e il server conta quante volte
 * viene cambiato: in fase 1b finirà proiettato su un maxischermo in milonga.
 */
export interface DancerProfile {
  id: number;
  userId: number;
  nickname: string;
  preferredRole: PreferredDanceRole;
  city?: string | null;
  languages: string[];
  birthDate?: string | null;
  declaredLevel?: string | null;
  avatarFileId?: number | null;
  /** Popolabile con `populate=avatarFile`. */
  avatarFile?: PublicFile | null;
  nicknameChangedAt?: string | null;
  nicknameChangeCount?: number;
}
