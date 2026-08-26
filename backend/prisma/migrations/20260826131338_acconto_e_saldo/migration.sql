-- CreateEnum
CREATE TYPE "BalanceSettlementMethod" AS ENUM ('CASH', 'POS', 'SATISPAY', 'BANK_TRANSFER', 'OTHER');

-- AlterEnum
ALTER TYPE "OrgMemberRole" ADD VALUE 'BOX_OFFICE';

-- AlterEnum
ALTER TYPE "RoleName" ADD VALUE 'BOX_OFFICE';

-- AlterTable
ALTER TABLE "ExternalSale" ADD COLUMN     "balanceDueAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "depositPaidAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nonTicketDepositAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ticketListAmount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "balanceDueAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "balanceSettledAmount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SalesChannelDepositCode" (
    "id" SERIAL NOT NULL,
    "salesChannelId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesChannelDepositCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceSettlement" (
    "id" SERIAL NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "BalanceSettlementMethod" NOT NULL,
    "operatorUserId" INTEGER NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),
    "deviceId" TEXT,
    "offline" BOOLEAN NOT NULL DEFAULT false,
    "deviceReference" TEXT,
    "conflictWithId" INTEGER,
    "note" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BalanceSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesChannelDepositCode_salesChannelId_idx" ON "SalesChannelDepositCode"("salesChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesChannelDepositCode_salesChannelId_code_key" ON "SalesChannelDepositCode"("salesChannelId", "code");

-- CreateIndex
CREATE INDEX "BalanceSettlement_registrationId_idx" ON "BalanceSettlement"("registrationId");

-- CreateIndex
CREATE INDEX "BalanceSettlement_operatorUserId_idx" ON "BalanceSettlement"("operatorUserId");

-- CreateIndex
CREATE INDEX "BalanceSettlement_conflictWithId_idx" ON "BalanceSettlement"("conflictWithId");

-- CreateIndex
CREATE INDEX "BalanceSettlement_collectedAt_idx" ON "BalanceSettlement"("collectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BalanceSettlement_deviceId_deviceReference_key" ON "BalanceSettlement"("deviceId", "deviceReference");

-- AddForeignKey
ALTER TABLE "SalesChannelDepositCode" ADD CONSTRAINT "SalesChannelDepositCode_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceSettlement" ADD CONSTRAINT "BalanceSettlement_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceSettlement" ADD CONSTRAINT "BalanceSettlement_operatorUserId_fkey" FOREIGN KEY ("operatorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceSettlement" ADD CONSTRAINT "BalanceSettlement_conflictWithId_fkey" FOREIGN KEY ("conflictWithId") REFERENCES "BalanceSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
