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

/**
 * Un ingresso registrato alla porta — `CheckIn` del backend (`RF-CHK-*`).
 *
 * ── Due momenti, e non sono lo stesso ───────────────────────────────────────
 * `scannedAt` e il momento della scansione **sul dispositivo**, e vale come ora
 * d'ingresso. `syncedAt` e il momento in cui la riga e arrivata al server, ed e
 * valorizzato **solo** sugli ingressi passati dalla coda offline: la porta deve
 * funzionare senza rete, e quando la rete torna gli ingressi arrivano tutti
 * insieme, anche mezz'ora dopo.
 *
 * Chi presenta un flusso deve mostrare `scannedAt`, mai l'ora di arrivo del
 * frame: e il numero di persone in sala a dipenderne.
 */
export interface CheckIn extends Entity {
  ticketId: number;
  sessionId: number;
  session?: Session | null;
  registrationId: number;
  /** Popolabile con `populate=registration`: e da qui che si prende il nome. */
  registration?: Registration | null;
  operatorUserId: number;
  kind: 'OPERATOR' | 'MANUAL_SEARCH' | 'EXTERNAL_ENTRY';
  scannedAt: string;
  /** Nullo sugli ingressi registrati online. */
  syncedAt?: string | null;
  /** La postazione che ha scansionato. */
  deviceId: string;
  offline: boolean;
  /** Punta all'ingresso gia registrato quando la coda rileva un doppio ingresso. */
  conflictWithId?: number | null;
  /** Valorizzato quando l'ingresso e stato annullato (`RF-CHK-9`). */
  revokedAt?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// I canali di vendita esterni, e l'acconto (`14-acconto-e-saldo.md`)
// ═══════════════════════════════════════════════════════════════════════════

export type SalesChannelProvider = 'SHOPIFY';
export type SalesChannelStatus = 'ACTIVE' | 'PAUSED' | 'DISABLED';

/**
 * Il negozio esterno collegato all'organizzazione — fase E.
 *
 * ⚠️ **I due segreti non tornano mai indietro.** `webhookSecret` e `credentials`
 * entrano in chiaro e finiscono cifrati in colonna: nella risposta non esiste
 * una lettura che li restituisca. Un modulo che li ripresentasse vuoti come
 * «campo da riempire» spingerebbe a riscriverli a ogni salvataggio, e a
 * riscriverli sbagliati.
 */
export interface SalesChannel extends Entity {
  organizationId: number;
  provider: SalesChannelProvider;
  /** Il nome che l'organizzatore legge nel back-office. */
  label: string;
  /** Il segmento in URL del webhook — generato dal server, mai scelto dal client. */
  publicId: string;
  /** Il dominio del negozio presso il prestatore (`qualcosa.myshopify.com`). */
  externalShopId: string;
  status: SalesChannelStatus;
  lastReconciledAt?: string | null;
  /**
   * Come si chiama, sul negozio, il campo che porta il **ruolo di ballo** — e
   * quello che porta il **nominativo del partecipante**.
   *
   * Nulli quando il negozio non li chiede, che è il caso di partenza: allora
   * l'iscrizione nasce flessibile e intestata a chi ha comprato. Non sono dati
   * che un negozio possiede: esistono solo se l'organizzatore li domanda al
   * checkout, e il nome del campo lo sceglie lui.
   */
  roleAttributeName?: string | null;
  attendeeNameAttributeName?: string | null;
  mappings?: SalesChannelMapping[];
  depositCodes?: SalesChannelDepositCode[];
}

/**
 * La traduzione prodotto del negozio → titolo d'ingresso.
 *
 * `ticketTypeId` nullo **è un valore, non un'assenza**: significa «questo
 * articolo non è un biglietto, ignoralo», ed è ciò che tiene fuori dalla
 * quarantena l'ordine misto — pass più maglietta — che è il caso normale.
 */
export interface SalesChannelMapping extends Entity {
  salesChannelId: number;
  externalProductId: string;
  /** `''` = qualunque variante del prodotto. */
  externalVariantId: string;
  ticketTypeId?: number | null;
  ticketType?: TicketType | null;
  /** Quanti posti vale un'unità: un «pacchetto coppia» ne vale due. */
  seatsPerUnit: number;
}

/**
 * Un codice sconto che, sul negozio, significa «acconto» (`14` §3.1).
 *
 * ── La percentuale non serve al calcolo, ed è il punto ──────────────────────
 * Il codice **marca** la vendita come acconto; a dire quanto manca è l'importo
 * che quel codice ha scontato, che il negozio consegna esatto. Il `30` in
 * `ACCONTO_30` è un'etichetta per gli umani: il giorno in cui l'organizzatore
 * cambiasse la percentuale senza rinominare il codice, un calcolo fondato sul
 * nome sbaglierebbe in silenzio.
 */
export interface SalesChannelDepositCode extends Entity {
  salesChannelId: number;
  /** Normalizzato dal server: maiuscolo, senza spazi. */
  code: string;
  label: string;
}

/** Il residuo di una persona, con le sue righe di incasso (`RF-SAL-14`). */
export interface RegistrationBalance {
  registrationId: number;
  eventId: number;
  holderName: string;
  holderSurname: string;
  /** Quanto è nato con la vendita, in centesimi. Immutabile. */
  dueAmount: number;
  /** Quanto ne è stato incassato: la somma delle righe. */
  settledAmount: number;
  /** `dueAmount - settledAmount`. Negativo = incassato in eccesso: è un conflitto. */
  openAmount: number;
  settlements: BalanceSettlement[];
}

export type BalanceSettlementMethod = 'CASH' | 'POS' | 'SATISPAY' | 'BANK_TRANSFER' | 'OTHER';

/**
 * Un saldo incassato al botteghino — `14` §6.
 *
 * **Si registra, non si contabilizza** (`RB26`): non è un incasso della
 * piattaforma e non produce alcuna riga di pagamento. Il metodo è una spunta,
 * non un prestatore: Mirada non incassa nulla, prende nota.
 */
export interface BalanceSettlement extends Entity {
  registrationId: number;
  registration?: Registration | null;
  /** Centesimi interi, sempre positivi. */
  amount: number;
  method: BalanceSettlementMethod;
  operatorUserId: number;
  /** Il momento della riscossione **sul dispositivo**: è quando i soldi sono passati di mano. */
  collectedAt: string;
  /** Nullo sugli incassi registrati online. */
  syncedAt?: string | null;
  /** La postazione. Nullo sul saldo registrato dal back-office. */
  deviceId?: string | null;
  offline: boolean;
  deviceReference?: string | null;
  /** Valorizzato quando la riga nasce in conflitto con un incasso già registrato. */
  conflictWithId?: number | null;
  note?: string | null;
}
