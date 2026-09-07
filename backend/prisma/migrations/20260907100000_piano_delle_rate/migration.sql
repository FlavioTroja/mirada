-- ═══════════════════════════════════════════════════════════════════════════
-- Il piano delle rate — `18-rate.md`
--
-- Incassare a rate funzionava già: `Registration.balanceDueAmount` più tante
-- righe di `BalanceSettlement` quante ne servono. Ciò che mancava era sapere
-- QUANDO le rate erano attese, e quindi chi è in ritardo.
--
-- ⚠️ Nessuna colonna di stato su questa tabella: il piano è una previsione, i
-- versamenti sono i fatti, e il ritardo è il confronto fra i due (`RB34`).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "PaymentInstalment" (
    "id" SERIAL NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentInstalment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentInstalment_registrationId_dueAt_idx" ON "PaymentInstalment"("registrationId", "dueAt");
CREATE INDEX "PaymentInstalment_dueAt_idx" ON "PaymentInstalment"("dueAt");

ALTER TABLE "PaymentInstalment"
  ADD CONSTRAINT "PaymentInstalment_registrationId_fkey"
  FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
