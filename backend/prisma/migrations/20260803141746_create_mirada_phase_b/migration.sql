-- CreateEnum
CREATE TYPE "DanceRole" AS ENUM ('LEADER', 'FOLLOWER');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SALES_CLOSED', 'RUNNING', 'ENDED', 'ARCHIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalesCloseCriterion" AS ENUM ('DATE', 'QUOTA_EXHAUSTED', 'MANUAL', 'EVENT_START');

-- CreateEnum
CREATE TYPE "FiscalDeclarationKind" AS ENUM ('ORGANIZATION_FRAMEWORK', 'EVENT_ATTESTATION');

-- CreateEnum
CREATE TYPE "RequirementBlocking" AS ENUM ('PURCHASE', 'ENTRY', 'NONE');

-- CreateEnum
CREATE TYPE "RequirementVerification" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "SaleUnit" AS ENUM ('PER_PERSON', 'PER_COUPLE');

-- CreateEnum
CREATE TYPE "TicketTypeVisibility" AS ENUM ('PUBLIC', 'CODE_RESTRICTED');

-- CreateEnum
CREATE TYPE "PriceTierKind" AS ENUM ('BY_DATE', 'BY_QUANTITY', 'COMBINED');

-- AlterTable
ALTER TABLE "RefundPolicy" ADD COLUMN     "derivedFromPolicyId" INTEGER;

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "eventTypeId" INTEGER NOT NULL,
    "venueId" INTEGER NOT NULL,
    "title" JSONB NOT NULL,
    "slug" TEXT NOT NULL,
    "description" JSONB NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "contentLanguage" TEXT NOT NULL,
    "secondLanguage" TEXT,
    "tags" TEXT[],
    "posterVerticalFileId" INTEGER,
    "posterHorizontalFileId" INTEGER,
    "posterSquareFileId" INTEGER,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "refundPolicyId" INTEGER,
    "refundPolicyText" JSONB NOT NULL DEFAULT '{}',
    "minorsAdmitted" BOOLEAN NOT NULL DEFAULT false,
    "minorsConditions" JSONB,
    "salesCloseAt" TIMESTAMP(3),
    "salesCloseCriteria" "SalesCloseCriterion"[],
    "manageExternalChannels" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalDeclaration" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "eventId" INTEGER,
    "kind" "FiscalDeclarationKind" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "frameworkLabel" TEXT NOT NULL,
    "statementText" TEXT NOT NULL,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "declaredByUserId" INTEGER NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "name" JSONB NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "room" TEXT,
    "level" TEXT,
    "allocationWeight" INTEGER NOT NULL DEFAULT 1,
    "isImplicit" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventCast" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "artistId" INTEGER NOT NULL,
    "kind" "ArtistKind" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventCast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRequirement" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "requirementTypeId" INTEGER NOT NULL,
    "label" JSONB NOT NULL,
    "text" JSONB NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "blocking" "RequirementBlocking" NOT NULL DEFAULT 'NONE',
    "verification" "RequirementVerification" NOT NULL DEFAULT 'AUTOMATIC',
    "dueAt" TIMESTAMP(3),
    "config" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventService" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "serviceTypeId" INTEGER NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "price" INTEGER NOT NULL DEFAULT 0,
    "refundCutoffAt" TIMESTAMP(3),
    "attributesConfig" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketType" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "basePrice" INTEGER NOT NULL DEFAULT 0,
    "saleUnit" "SaleUnit" NOT NULL DEFAULT 'PER_PERSON',
    "roleConstraint" "DanceRole",
    "consumesRoleQuota" BOOLEAN NOT NULL DEFAULT true,
    "saleOpensAt" TIMESTAMP(3),
    "saleClosesAt" TIMESTAMP(3),
    "visibility" "TicketTypeVisibility" NOT NULL DEFAULT 'PUBLIC',
    "accessCode" TEXT,
    "minPerOrder" INTEGER NOT NULL DEFAULT 1,
    "maxPerOrder" INTEGER NOT NULL DEFAULT 10,
    "indicatedLevel" TEXT,
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTypeSession" (
    "id" SERIAL NOT NULL,
    "ticketTypeId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketTypeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceTier" (
    "id" SERIAL NOT NULL,
    "ticketTypeId" INTEGER NOT NULL,
    "kind" "PriceTierKind" NOT NULL,
    "price" INTEGER NOT NULL,
    "validUntil" TIMESTAMP(3),
    "maxQuantity" INTEGER,
    "soldQuantity" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_organizationId_status_idx" ON "Event"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Event_startAt_idx" ON "Event"("startAt");

-- CreateIndex
CREATE INDEX "Event_slug_idx" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "FiscalDeclaration_organizationId_kind_idx" ON "FiscalDeclaration"("organizationId", "kind");

-- CreateIndex
CREATE INDEX "FiscalDeclaration_eventId_idx" ON "FiscalDeclaration"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalDeclaration_organizationId_kind_eventId_version_key" ON "FiscalDeclaration"("organizationId", "kind", "eventId", "version");

-- CreateIndex
CREATE INDEX "Session_eventId_idx" ON "Session"("eventId");

-- CreateIndex
CREATE INDEX "Session_eventId_startAt_idx" ON "Session"("eventId", "startAt");

-- CreateIndex
CREATE INDEX "EventCast_eventId_idx" ON "EventCast"("eventId");

-- CreateIndex
CREATE INDEX "EventCast_artistId_idx" ON "EventCast"("artistId");

-- CreateIndex
CREATE INDEX "EventRequirement_eventId_idx" ON "EventRequirement"("eventId");

-- CreateIndex
CREATE INDEX "EventRequirement_requirementTypeId_idx" ON "EventRequirement"("requirementTypeId");

-- CreateIndex
CREATE INDEX "EventService_eventId_idx" ON "EventService"("eventId");

-- CreateIndex
CREATE INDEX "EventService_serviceTypeId_idx" ON "EventService"("serviceTypeId");

-- CreateIndex
CREATE INDEX "TicketType_eventId_idx" ON "TicketType"("eventId");

-- CreateIndex
CREATE INDEX "TicketType_accessCode_idx" ON "TicketType"("accessCode");

-- CreateIndex
CREATE INDEX "TicketTypeSession_sessionId_idx" ON "TicketTypeSession"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketTypeSession_ticketTypeId_sessionId_key" ON "TicketTypeSession"("ticketTypeId", "sessionId");

-- CreateIndex
CREATE INDEX "PriceTier_ticketTypeId_idx" ON "PriceTier"("ticketTypeId");

-- CreateIndex
CREATE INDEX "RefundPolicy_derivedFromPolicyId_idx" ON "RefundPolicy"("derivedFromPolicyId");

-- AddForeignKey
ALTER TABLE "RefundPolicy" ADD CONSTRAINT "RefundPolicy_derivedFromPolicyId_fkey" FOREIGN KEY ("derivedFromPolicyId") REFERENCES "RefundPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "EventType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_posterVerticalFileId_fkey" FOREIGN KEY ("posterVerticalFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_posterHorizontalFileId_fkey" FOREIGN KEY ("posterHorizontalFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_posterSquareFileId_fkey" FOREIGN KEY ("posterSquareFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_refundPolicyId_fkey" FOREIGN KEY ("refundPolicyId") REFERENCES "RefundPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDeclaration" ADD CONSTRAINT "FiscalDeclaration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDeclaration" ADD CONSTRAINT "FiscalDeclaration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDeclaration" ADD CONSTRAINT "FiscalDeclaration_declaredByUserId_fkey" FOREIGN KEY ("declaredByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCast" ADD CONSTRAINT "EventCast_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCast" ADD CONSTRAINT "EventCast_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRequirement" ADD CONSTRAINT "EventRequirement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRequirement" ADD CONSTRAINT "EventRequirement_requirementTypeId_fkey" FOREIGN KEY ("requirementTypeId") REFERENCES "RequirementType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventService" ADD CONSTRAINT "EventService_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventService" ADD CONSTRAINT "EventService_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketType" ADD CONSTRAINT "TicketType_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTypeSession" ADD CONSTRAINT "TicketTypeSession_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTypeSession" ADD CONSTRAINT "TicketTypeSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceTier" ADD CONSTRAINT "PriceTier_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
