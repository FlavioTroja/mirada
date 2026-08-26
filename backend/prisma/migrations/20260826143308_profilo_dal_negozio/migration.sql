-- AlterTable
ALTER TABLE "ExternalSale" ADD COLUMN     "customerLocale" TEXT,
ADD COLUMN     "externalCustomerId" TEXT;

-- AlterTable
ALTER TABLE "SalesChannel" ADD COLUMN     "attendeeNameAttributeName" TEXT,
ADD COLUMN     "roleAttributeName" TEXT;
