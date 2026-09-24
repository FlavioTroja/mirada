-- ═══════════════════════════════════════════════════════════════════════════
-- I prospect dell'open day — `19-prospect.md`
--
-- Chi viene all'open day di un corso e non si iscrive, raccolto dalla scuola per
-- essere ricontattato all'apertura del corso successivo.
--
-- ⚠️ Nessuna colonna `deleted`: cancellare un prospect lo cancella davvero. È un
-- dato personale raccolto col consenso, e chi chiede di essere tolto va tolto.
-- ═══════════════════════════════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('TO_CONTACT', 'CONTACTED', 'NOT_INTERESTED');

-- CreateTable
CREATE TABLE "Prospect" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "sourceEventId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "preferredRole" "PreferredDanceRole",
    "note" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "status" "ProspectStatus" NOT NULL DEFAULT 'TO_CONTACT',
    "contactedAt" TIMESTAMP(3),
    "convertedRegistrationId" INTEGER,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Prospect_organizationId_status_idx" ON "Prospect"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Prospect_sourceEventId_idx" ON "Prospect"("sourceEventId");

-- CreateIndex
CREATE INDEX "Prospect_convertedRegistrationId_idx" ON "Prospect"("convertedRegistrationId");

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_convertedRegistrationId_fkey" FOREIGN KEY ("convertedRegistrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

