-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('NOT_CONNECTED', 'PENDING', 'ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "OrgMemberRole" AS ENUM ('OWNER', 'EVENT_MANAGER', 'CHECKIN_OPERATOR');

-- CreateEnum
CREATE TYPE "PreferredDanceRole" AS ENUM ('LEADER', 'FOLLOWER', 'BOTH');

-- CreateEnum
CREATE TYPE "ArtistKind" AS ENUM ('TEACHER', 'DJ', 'ORCHESTRA');

-- CreateEnum
CREATE TYPE "RequirementKind" AS ENUM ('DECLARATION', 'CUSTOM_FIELD');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RoleName" ADD VALUE 'OWNER';
ALTER TYPE "RoleName" ADD VALUE 'EVENT_MANAGER';
ALTER TYPE "RoleName" ADD VALUE 'CHECKIN_OPERATOR';
ALTER TYPE "RoleName" ADD VALUE 'DANCER';

-- CreateTable
CREATE TABLE "EventType" (
    "id" SERIAL NOT NULL,
    "name" JSONB NOT NULL,
    "slug" TEXT NOT NULL,
    "capMultiSession" BOOLEAN NOT NULL DEFAULT false,
    "capRoleQuotas" BOOLEAN NOT NULL DEFAULT false,
    "capLevels" BOOLEAN NOT NULL DEFAULT false,
    "capCast" BOOLEAN NOT NULL DEFAULT false,
    "capCouple" BOOLEAN NOT NULL DEFAULT false,
    "defaultTemplate" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementType" (
    "id" SERIAL NOT NULL,
    "name" JSONB NOT NULL,
    "kind" "RequirementKind" NOT NULL,
    "configSchema" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceType" (
    "id" SERIAL NOT NULL,
    "name" JSONB NOT NULL,
    "attributesSchema" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "legalForm" TEXT NOT NULL,
    "vatNumber" TEXT,
    "taxCode" TEXT,
    "addressId" INTEGER,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "website" TEXT,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'PENDING',
    "stripeAccountId" TEXT,
    "payoutStatus" "PayoutStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "payoutCheckedAt" TIMESTAMP(3),
    "termsVersion" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "logoFileId" INTEGER,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DancerProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "nickname" TEXT NOT NULL,
    "preferredRole" "PreferredDanceRole" NOT NULL DEFAULT 'BOTH',
    "city" TEXT,
    "languages" TEXT[],
    "birthDate" TIMESTAMP(3),
    "declaredLevel" TEXT,
    "avatarFileId" INTEGER,
    "nicknameChangedAt" TIMESTAMP(3),
    "nicknameChangeCount" INTEGER NOT NULL DEFAULT 0,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DancerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "OrgMemberRole" NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER,
    "name" TEXT NOT NULL,
    "addressId" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "capacity" INTEGER,
    "floorNotes" TEXT,
    "airConditioning" BOOLEAN NOT NULL DEFAULT false,
    "parking" BOOLEAN NOT NULL DEFAULT false,
    "accessibility" TEXT,
    "notes" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artist" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER,
    "name" TEXT NOT NULL,
    "kind" "ArtistKind" NOT NULL,
    "bio" JSONB,
    "photoFileId" INTEGER,
    "website" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundPolicy" (
    "id" SERIAL NOT NULL,
    "name" JSONB NOT NULL,
    "tiers" JSONB NOT NULL DEFAULT '[]',
    "transferDeadlineHours" INTEGER NOT NULL DEFAULT 0,
    "feeRefundable" BOOLEAN NOT NULL DEFAULT false,
    "isPlatformPreset" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" INTEGER,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefundPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventType_slug_key" ON "EventType"("slug");

-- CreateIndex
CREATE INDEX "EventType_active_idx" ON "EventType"("active");

-- CreateIndex
CREATE INDEX "EventType_sortOrder_idx" ON "EventType"("sortOrder");

-- CreateIndex
CREATE INDEX "RequirementType_active_idx" ON "RequirementType"("active");

-- CreateIndex
CREATE INDEX "RequirementType_kind_idx" ON "RequirementType"("kind");

-- CreateIndex
CREATE INDEX "ServiceType_active_idx" ON "ServiceType"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeAccountId_key" ON "Organization"("stripeAccountId");

-- CreateIndex
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateIndex
CREATE INDEX "Organization_payoutStatus_idx" ON "Organization"("payoutStatus");

-- CreateIndex
CREATE UNIQUE INDEX "DancerProfile_userId_key" ON "DancerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DancerProfile_nickname_key" ON "DancerProfile"("nickname");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationId_idx" ON "OrganizationMember"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_role_key" ON "OrganizationMember"("organizationId", "userId", "role");

-- CreateIndex
CREATE INDEX "Venue_organizationId_idx" ON "Venue"("organizationId");

-- CreateIndex
CREATE INDEX "Venue_addressId_idx" ON "Venue"("addressId");

-- CreateIndex
CREATE INDEX "Artist_organizationId_idx" ON "Artist"("organizationId");

-- CreateIndex
CREATE INDEX "Artist_kind_idx" ON "Artist"("kind");

-- CreateIndex
CREATE INDEX "RefundPolicy_organizationId_idx" ON "RefundPolicy"("organizationId");

-- CreateIndex
CREATE INDEX "RefundPolicy_isPlatformPreset_idx" ON "RefundPolicy"("isPlatformPreset");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_logoFileId_fkey" FOREIGN KEY ("logoFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DancerProfile" ADD CONSTRAINT "DancerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DancerProfile" ADD CONSTRAINT "DancerProfile_avatarFileId_fkey" FOREIGN KEY ("avatarFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artist" ADD CONSTRAINT "Artist_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artist" ADD CONSTRAINT "Artist_photoFileId_fkey" FOREIGN KEY ("photoFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundPolicy" ADD CONSTRAINT "RefundPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
