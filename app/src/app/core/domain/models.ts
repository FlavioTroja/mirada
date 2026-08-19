import { I18nText } from '../i18n/i18n-text';
import { OrgMemberRole } from '../auth/roles';
import {
  ArtistKind,
  DanceRole,
  DeclaredDanceRole,
  EventStatus,
  FiscalDeclarationKind,
  OrganizationStatus,
  PayoutStatus,
  PriceTierKind,
  QuotaReservedFor,
  QuotaScope,
  RegistrationChannel,
  RegistrationStatus,
  RequirementBlocking,
  RequirementKind,
  RequirementVerification,
  SaleUnit,
  SalesCloseCriterion,
  TicketTypeVisibility,
} from './enums';

/**
 * Forme delle entità del §3.6.
 *
 * Ogni entità porta implicitamente `id: number` (`Int` autoincrement, nota 2 del
 * §3.10), `createdAt`, `updatedAt`, `deleted`. Ogni `…Id` è un `number`.
 * Gli importi sono in **centesimi interi**.
 */
export interface Entity {
  id: number;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
}

export interface Address extends Entity {
  country?: string | null;
  state?: string | null;
  province?: string | null;
  city?: string | null;
  zipCode?: string | null;
  address?: string | null;
  number?: string | null;
  note?: string | null;
}

/**
 * `File` — entità della foundation (§3.4). Si **crea** con
 * `POST /files/upload-image` e non si aggiorna né si cancella mai: quando la
 * locandina cambia si **sostituisce il riferimento** sull'entità che la porta,
 * non si modifica il file.
 *
 * Nota: `Entity.deleted` non è mai valorizzato su `File`.
 */
export interface StoredFile extends Entity {
  name: string;
  path: string;
  /** URL assoluto servito dal backend: usabile direttamente in `<img src>`. */
  url: string;
  mimeType: string;
  size: number;
}

export interface Organization extends Entity {
  name: string;
  legalName: string;
  legalForm: string;
  vatNumber?: string | null;
  taxCode?: string | null;
  addressId?: number | null;
  address?: Address | null;
  contactEmail: string;
  contactPhone?: string | null;
  website?: string | null;
  status: OrganizationStatus;
  /** Calcolati dal server a partire dal prestatore di pagamento: mai inviati. */
  stripeAccountId?: string | null;
  payoutStatus: PayoutStatus;
  payoutCheckedAt?: string | null;
  termsVersion?: string | null;
  termsAcceptedAt?: string | null;
  logoFileId?: number | null;
  /** Popolabile con `populate=logoFile`. */
  logoFile?: StoredFile | null;
}

/** Esito di `GET /organizations/:id/payout-status` (`RF-ORG-12`). */
export interface PayoutStatusReport {
  organizationId?: number;
  payoutStatus: PayoutStatus;
  payoutCheckedAt?: string | null;
  stripeAccountId?: string | null;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  pendingBalance?: number | null;
  requirements?: string[];
  currentlyDue?: string[];
  pastDue?: string[];
  disabledReason?: string | null;
}

export interface OrganizationMember extends Entity {
  organizationId: number;
  userId: number;
  role: OrgMemberRole;
  invitedAt?: string | null;
  acceptedAt?: string | null;
  user?: { id: number; username: string } | null;
  organization?: Organization | null;
}

/**
 * L'invito a entrare in un'organizzazione come titolare.
 *
 * Nessun campo porta il gettone, ed è voluto: l'API restituisce l'invito senza
 * di esso, perché l'originale esiste solo dentro il link partito per posta e in
 * banca dati ne resta la sola impronta.
 */
export interface OrganizationInvitation extends Entity {
  organizationId: number;
  email: string;
  role: OrgMemberRole;
  invitedById: number;
  expiresAt: string;
  acceptedAt?: string | null;
  acceptedById?: number | null;
  revokedAt?: string | null;
}

export interface FiscalDeclaration extends Entity {
  organizationId: number;
  eventId?: number | null;
  kind: FiscalDeclarationKind;
  version: number;
  frameworkLabel: string;
  statementText: string;
  declaredAt: string;
  declaredByUserId: number;
  declaredBy?: { id: number; username: string } | null;
  ipAddress: string;
  event?: MiradaEvent | null;
}

export interface RefundPolicyTier {
  daysBefore: number;
  percent: number;
}

export interface RefundPolicy extends Entity {
  name: I18nText;
  tiers: RefundPolicyTier[];
  transferDeadlineHours: number;
  feeRefundable: boolean;
  isPlatformPreset: boolean;
  organizationId?: number | null;
  /** Preset di piattaforma da cui la policy discende: è il termine di paragone. */
  derivedFromPolicyId?: number | null;
  derivedFromPolicy?: RefundPolicy | null;
}

export interface EventType extends Entity {
  name: I18nText;
  slug: string;
  /** Le cinque capacità **generano il wizard** di creazione evento. */
  capMultiSession: boolean;
  capRoleQuotas: boolean;
  capLevels: boolean;
  capCast: boolean;
  capCouple: boolean;
  defaultTemplate?: unknown;
  active: boolean;
  sortOrder: number;
}

export interface RequirementType extends Entity {
  name: I18nText;
  kind: RequirementKind;
  configSchema?: unknown;
  active: boolean;
}

export interface ServiceType extends Entity {
  name: I18nText;
  attributesSchema?: unknown;
  active: boolean;
}

export interface Venue extends Entity {
  organizationId?: number | null;
  name: string;
  addressId: number;
  address?: Address | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Proposta come default alla quota di capienza della sala, mai imposta. */
  capacity?: number | null;
  floorNotes?: string | null;
  airConditioning: boolean;
  parking: boolean;
  accessibility?: string | null;
  notes?: string | null;
}

export interface Artist extends Entity {
  organizationId?: number | null;
  name: string;
  kind: ArtistKind;
  bio?: I18nText | null;
  photoFileId?: number | null;
  /** Popolabile con `populate=photoFile`. */
  photoFile?: StoredFile | null;
  website?: string | null;
}

/** `Event` — il nome DOM è già occupato, quindi il modello si chiama `MiradaEvent`. */
export interface MiradaEvent extends Entity {
  organizationId: number;
  organization?: Organization | null;
  eventTypeId: number;
  eventType?: EventType | null;
  venueId: number;
  venue?: Venue | null;
  title: I18nText;
  slug: string;
  description: I18nText;
  startAt: string;
  endAt: string;
  contentLanguage: string;
  secondLanguage?: string | null;
  tags: string[];
  /** I **tre ritagli** della locandina (`RF-EVT-3`), popolabili con `populate`. */
  posterVerticalFileId?: number | null;
  posterVerticalFile?: StoredFile | null;
  posterHorizontalFileId?: number | null;
  posterHorizontalFile?: StoredFile | null;
  posterSquareFileId?: number | null;
  posterSquareFile?: StoredFile | null;
  status: EventStatus;
  refundPolicyId?: number | null;
  refundPolicyText: I18nText;
  minorsAdmitted: boolean;
  minorsConditions?: I18nText | null;
  salesCloseAt?: string | null;
  salesCloseCriteria: SalesCloseCriterion[];
  manageExternalChannels: boolean;
  publishedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
}

export interface Session extends Entity {
  eventId: number;
  name: I18nText;
  startAt: string;
  endAt: string;
  room?: string | null;
  level?: string | null;
  /** Peso di ripartizione (`RF-EVT-36`), default uniforme. */
  allocationWeight: number;
  isImplicit: boolean;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  sortOrder: number;
}

export interface EventCast extends Entity {
  eventId: number;
  artistId: number;
  artist?: Artist | null;
  kind: ArtistKind;
  sortOrder: number;
}

export interface EventRequirement extends Entity {
  eventId: number;
  requirementTypeId: number;
  requirementType?: RequirementType | null;
  label: I18nText;
  text: I18nText;
  mandatory: boolean;
  blocking: RequirementBlocking;
  verification: RequirementVerification;
  dueAt?: string | null;
  config?: unknown;
  sortOrder: number;
}

export interface EventService extends Entity {
  eventId: number;
  serviceTypeId: number;
  serviceType?: ServiceType | null;
  name: I18nText;
  description?: I18nText | null;
  /** Centesimi interi. */
  price: number;
  refundCutoffAt?: string | null;
  attributesConfig?: unknown;
  sortOrder: number;
}

export interface TicketType extends Entity {
  eventId: number;
  name: I18nText;
  description?: I18nText | null;
  /** Centesimi interi. */
  basePrice: number;
  saleUnit: SaleUnit;
  roleConstraint?: DanceRole | null;
  consumesRoleQuota: boolean;
  saleOpensAt?: string | null;
  saleClosesAt?: string | null;
  visibility: TicketTypeVisibility;
  accessCode?: string | null;
  minPerOrder: number;
  maxPerOrder: number;
  indicatedLevel?: string | null;
  highlighted: boolean;
  sortOrder: number;
  sessions?: TicketTypeSession[];
  priceTiers?: PriceTier[];
}

/** Figlio posseduto: `PATCH /ticket-types/:id/sessions` con l'array intero. */
export interface TicketTypeSession {
  id: number;
  ticketTypeId?: number;
  sessionId: number;
  session?: Session | null;
  toBeDisconnected?: boolean;
}

/** Figlio posseduto: `PATCH /ticket-types/:id/price-tiers` con l'array intero. */
export interface PriceTier {
  id: number;
  ticketTypeId?: number;
  kind: PriceTierKind;
  /** Centesimi interi. */
  price: number;
  validUntil?: string | null;
  maxQuantity?: number | null;
  /** Calcolato dal server. */
  soldQuantity?: number;
  sortOrder?: number;
  toBeDisconnected?: boolean;
}

/** Esito di `POST /ticket-types/:id/price-preview` (`RF-EVT-26`). */
export interface PricePreview {
  price: number;
  tierId?: number | null;
  kind?: PriceTierKind | null;
  expiresAt?: string | null;
  remainingAtThisPrice?: number | null;
  criterion?: string | null;
}

export interface CapacityQuota extends Entity {
  eventId: number;
  scope: QuotaScope;
  /** Riferimento polimorfo senza chiave esterna: `Session`, `TicketType` o `EventService`. */
  scopeId?: number | null;
  role?: DanceRole | null;
  limit: number;
  /** Calcolato dal server: nessun DTO di scrittura lo accetta. */
  consumed: number;
  limiting: boolean;
  reservedFor?: QuotaReservedFor | null;
  imbalanceTolerance?: number | null;
  overbookAllowance: number;
  publiclyVisible: boolean;
}

/**
 * L'account di chi si è iscritto, per quel poco che serve a una lista.
 *
 * Non è l'utente intero di proposito: qui basta il ritratto. Un'iscrizione può
 * benissimo non averne uno — si compra un biglietto anche per un'altra persona,
 * e chi arriva dalla biglietteria fisica un account non ce l'ha proprio.
 */
export interface RegistrationAccount extends Entity {
  username: string;
  /** La fotografia caricata nel profilo personale. */
  logoFileId?: number | null;
  /** Popolabile con `populate=personUser.logoFile`. */
  logoFile?: StoredFile | null;
  /** Ritratto indicato come indirizzo, invece che caricato come file. */
  avatarUrl?: string | null;
}

export interface Registration extends Entity {
  eventId: number;
  event?: MiradaEvent | null;
  personUserId?: number | null;
  /** Popolabile con `populate=personUser`. Nullo per chi si iscrive senza account. */
  personUser?: RegistrationAccount | null;
  holderName: string;
  holderSurname: string;
  holderEmail: string;
  /** Ciò che la persona ha scelto. */
  declaredRole: DeclaredDanceRole;
  /** Il ruolo effettivo, calcolato dal server. Mai fuso con quello dichiarato. */
  assignedRole?: DanceRole | null;
  channel: RegistrationChannel;
  status: RegistrationStatus;
  confirmedAt?: string | null;
  declinedAt?: string | null;
  coupleId?: number | null;
  couple?: Couple | null;
  isMinor: boolean;
  guardianUserId?: number | null;
  quotaConsumptions?: QuotaConsumption[];
}

export interface Couple extends Entity {
  eventId: number;
  dissolvedAt?: string | null;
  registrations?: Registration[];
}

export interface QuotaConsumption extends Entity {
  capacityQuotaId: number;
  capacityQuota?: CapacityQuota | null;
  registrationId: number;
  quantity: number;
}

/** Esito di `POST /events/:id/orphan-sessions/resolve` (`RF-EVT-24`). */
export interface OrphanSessionResolution {
  sessionId: number;
  ticketTypesWithoutSession: {
    id: number;
    name: unknown;
    issuedTicketCount: number;
    /** Sui titoli venduti l'aggiunta è ammessa **solo come miglioria**. */
    sold: boolean;
    canAddSession: boolean;
  }[];
}
