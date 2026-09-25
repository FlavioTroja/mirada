-- ═══════════════════════════════════════════════════════════════════════════
-- Il calendario dell'organizzatore — `20-calendario.md`
--
-- Due colonne su `Session` (che cosa è, e di quale serie fa parte) e una tabella
-- nuova per gli impegni dello staff che non sono né lezioni né eventi.
--
-- ⚠️ Solo aggiunte, con default: nessuna riga esistente cambia significato e il
-- rollback dell'immagine resta possibile. Le sessioni di oggi nascono `REGULAR`
-- e senza serie, che è esattamente ciò che sono.
-- ═══════════════════════════════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "SessionKind" AS ENUM ('REGULAR', 'OPEN_DAY');

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "kind" "SessionKind" NOT NULL DEFAULT 'REGULAR',
ADD COLUMN     "seriesId" UUID;

-- CreateTable
CREATE TABLE "Appointment" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "venueId" INTEGER,
    "room" TEXT,
    "seriesId" UUID,
    "createdById" INTEGER NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Appointment_organizationId_startAt_idx" ON "Appointment"("organizationId", "startAt");

-- CreateIndex
CREATE INDEX "Appointment_seriesId_idx" ON "Appointment"("seriesId");

-- CreateIndex
CREATE INDEX "Appointment_venueId_idx" ON "Appointment"("venueId");

-- CreateIndex
CREATE INDEX "Session_seriesId_idx" ON "Session"("seriesId");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

