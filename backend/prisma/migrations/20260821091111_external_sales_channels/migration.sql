-- FASE E — I canali di vendita esterni.
--
-- Il negozio che l'organizzatore ha già (Shopify oggi, altri domani) dichiara le
-- proprie vendite invece di lasciarle digitare a mano. Non è un concetto nuovo:
-- `RegistrationChannel.EXTERNAL_CHANNEL` e `QuotaReservedFor.EXTERNAL_CHANNEL`
-- esistono dalla fase C, e `Event.manageExternalChannels` è l'interruttore per
-- evento che il `05` §5 dichiara già. Cambia soltanto chi preme il tasto.
--
-- Quattro tabelle nuove e due colonne nullable. Nessun popolamento: non esiste
-- una riga preesistente che appartenga a un canale esterno, e inventarne una
-- sarebbe peggio che lasciarla assente.
--
-- ── Perché `Registration.externalSaleId` e `Ticket.externalSaleId` sono SET NULL
-- Stessa ragione delle due provenienze che `Ticket` aveva già: un biglietto non
-- perde validità perché la vendita da cui nasce viene riorganizzata. La persona
-- è entrata, il QR vale, la traccia commerciale è un'altra cosa.
--
-- ── `SalesChannelMapping.externalVariantId` è NOT NULL con default ''
-- In PostgreSQL un indice univoco tratta ogni NULL come distinto: con la
-- variante nullable si potrebbero creare due mappature «qualunque variante» per
-- lo stesso prodotto, e la risoluzione diventerebbe casuale. La stringa vuota è
-- un valore come gli altri, e il vincolo di unicità funziona davvero.

-- CreateEnum
CREATE TYPE "SalesChannelProvider" AS ENUM ('SHOPIFY');

-- CreateEnum
CREATE TYPE "SalesChannelStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ExternalSaleStatus" AS ENUM ('RECEIVED', 'INGESTED', 'QUARANTINED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExternalSaleEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "externalSaleId" INTEGER;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "externalSaleId" INTEGER;

-- CreateTable
CREATE TABLE "SalesChannel" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "provider" "SalesChannelProvider" NOT NULL,
    "label" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "externalShopId" TEXT NOT NULL,
    "credentials" TEXT,
    "webhookSecret" TEXT NOT NULL,
    "status" "SalesChannelStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastReconciledAt" TIMESTAMP(3),
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesChannelMapping" (
    "id" SERIAL NOT NULL,
    "salesChannelId" INTEGER NOT NULL,
    "externalProductId" TEXT NOT NULL,
    "externalVariantId" TEXT NOT NULL DEFAULT '',
    "ticketTypeId" INTEGER NOT NULL,
    "seatsPerUnit" INTEGER NOT NULL DEFAULT 1,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesChannelMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalSale" (
    "id" SERIAL NOT NULL,
    "salesChannelId" INTEGER NOT NULL,
    "eventId" INTEGER,
    "externalOrderId" TEXT NOT NULL,
    "externalOrderNumber" TEXT,
    "status" "ExternalSaleStatus" NOT NULL DEFAULT 'RECEIVED',
    "buyerName" TEXT NOT NULL,
    "buyerSurname" TEXT NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "rawPayload" JSONB NOT NULL,
    "quarantineReason" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingestedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalSaleEvent" (
    "id" SERIAL NOT NULL,
    "salesChannelId" INTEGER NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "externalOrderId" TEXT,
    "payload" JSONB NOT NULL,
    "status" "ExternalSaleEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalSaleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesChannel_publicId_key" ON "SalesChannel"("publicId");

-- CreateIndex
CREATE INDEX "SalesChannel_organizationId_idx" ON "SalesChannel"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesChannel_provider_externalShopId_key" ON "SalesChannel"("provider", "externalShopId");

-- CreateIndex
CREATE INDEX "SalesChannelMapping_ticketTypeId_idx" ON "SalesChannelMapping"("ticketTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesChannelMapping_salesChannelId_externalProductId_extern_key" ON "SalesChannelMapping"("salesChannelId", "externalProductId", "externalVariantId");

-- CreateIndex
CREATE INDEX "ExternalSale_salesChannelId_status_idx" ON "ExternalSale"("salesChannelId", "status");

-- CreateIndex
CREATE INDEX "ExternalSale_eventId_idx" ON "ExternalSale"("eventId");

-- CreateIndex
CREATE INDEX "ExternalSale_buyerEmail_idx" ON "ExternalSale"("buyerEmail");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalSale_salesChannelId_externalOrderId_key" ON "ExternalSale"("salesChannelId", "externalOrderId");

-- CreateIndex
CREATE INDEX "ExternalSaleEvent_salesChannelId_status_idx" ON "ExternalSaleEvent"("salesChannelId", "status");

-- CreateIndex
CREATE INDEX "ExternalSaleEvent_externalOrderId_idx" ON "ExternalSaleEvent"("externalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalSaleEvent_salesChannelId_externalEventId_key" ON "ExternalSaleEvent"("salesChannelId", "externalEventId");

-- CreateIndex
CREATE INDEX "Registration_externalSaleId_idx" ON "Registration"("externalSaleId");

-- CreateIndex
CREATE INDEX "Ticket_externalSaleId_idx" ON "Ticket"("externalSaleId");

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_externalSaleId_fkey" FOREIGN KEY ("externalSaleId") REFERENCES "ExternalSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_externalSaleId_fkey" FOREIGN KEY ("externalSaleId") REFERENCES "ExternalSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesChannel" ADD CONSTRAINT "SalesChannel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesChannelMapping" ADD CONSTRAINT "SalesChannelMapping_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesChannelMapping" ADD CONSTRAINT "SalesChannelMapping_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalSale" ADD CONSTRAINT "ExternalSale_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalSale" ADD CONSTRAINT "ExternalSale_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalSaleEvent" ADD CONSTRAINT "ExternalSaleEvent_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
