-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "tags" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "salesCloseCriteria" SET DEFAULT ARRAY[]::"SalesCloseCriterion"[];
