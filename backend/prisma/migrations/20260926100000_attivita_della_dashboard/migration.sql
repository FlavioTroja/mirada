-- ═══════════════════════════════════════════════════════════════════════════
-- L'attività per organizzazione — `21-dashboard.md` §4
--
-- La colonna «In tempo reale» e il «Registro di oggi» della Dashboard. Non si
-- appoggia a `Log`, che non ha organizzazione.
--
-- ⚠️ Solo aggiunte: una tabella nuova e due enum. Il rollback dell'immagine
-- resta possibile.
-- ═══════════════════════════════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "ActivityKind" AS ENUM ('CHECK_IN', 'REGISTRATION', 'PAYMENT', 'CALENDAR', 'PROSPECT');

-- CreateEnum
CREATE TYPE "ActivitySeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "Activity" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "kind" "ActivityKind" NOT NULL,
    "severity" "ActivitySeverity" NOT NULL DEFAULT 'INFO',
    "text" TEXT NOT NULL,
    "actorName" TEXT,
    "staff" BOOLEAN NOT NULL DEFAULT false,
    "amount" INTEGER,
    "eventId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activity_organizationId_createdAt_idx" ON "Activity"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

