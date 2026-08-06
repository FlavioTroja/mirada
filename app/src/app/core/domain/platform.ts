import { EventStatus, OrganizationStatus, PayoutStatus } from './enums';

/**
 * `GET /platform/summary` — la forma del cruscotto di piattaforma.
 *
 * Vive in un file suo e non accanto a `dashboard.ts` perché è un'altra domanda:
 * quello risponde «come va il mio festival», questo «come vanno i miei clienti».
 */

export interface PlatformOwner {
  userId: number;
  username: string;
  fullName: string;
}

export interface PlatformOrganizationRow {
  organizationId: number;
  name: string;
  status: OrganizationStatus;
  payoutStatus: PayoutStatus;
  owners: PlatformOwner[];
  events: number;
  publishedEvents: number;
  registrations: number;
  /** Centesimi interi, ordini saldati, al lordo dei rimborsi. */
  revenue: number;
  presaleRights: number;
}

export interface PlatformEventRow {
  eventId: number;
  slug: string;
  title?: unknown;
  status: EventStatus;
  startAt: string;
  endAt: string;
  organizationId: number;
  organizationName: string;
  registrations: number;
}

export interface PlatformSummary {
  generatedAt: string;
  organizations: {
    total: number;
    byStatus: Record<string, number>;
    payoutEnabled: number;
  };
  events: {
    total: number;
    byStatus: Record<string, number>;
    running: number;
    upcoming: number;
  };
  registrations: { total: number };
  revenue: {
    paidOrders: number;
    subtotal: number;
    presaleRights: number;
    total: number;
  };
  byOrganization: PlatformOrganizationRow[];
  eventsList: PlatformEventRow[];
  perimeter: { note: string; missingEntities: string[] };
}
