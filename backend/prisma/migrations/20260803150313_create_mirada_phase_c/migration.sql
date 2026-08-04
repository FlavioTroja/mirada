-- CreateEnum
CREATE TYPE "QuotaScope" AS ENUM ('EVENT', 'SESSION', 'TICKET_TYPE', 'SERVICE');

-- CreateEnum
CREATE TYPE "QuotaReservedFor" AS ENUM ('COMPLIMENTARY', 'EXTERNAL_CHANNEL');

-- CreateEnum
CREATE TYPE "DeclaredDanceRole" AS ENUM ('LEADER', 'FOLLOWER', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('CONFIRMED', 'TO_CONFIRM', 'DECLINED');

-- CreateEnum
CREATE TYPE "RegistrationChannel" AS ENUM ('ONLINE_SALE', 'DOOR_SALE', 'COMPLIMENTARY', 'EXTERNAL_CHANNEL');

-- AlterTable
ALTER TABLE "DancerProfile" ALTER COLUMN "languages" SET DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "CapacityQuota" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "scope" "QuotaScope" NOT NULL,
    "scopeId" INTEGER,
    "role" "DanceRole",
    "limit" INTEGER NOT NULL,
    "consumed" INTEGER NOT NULL DEFAULT 0,
    "limiting" BOOLEAN NOT NULL DEFAULT true,
    "reservedFor" "QuotaReservedFor",
    "imbalanceTolerance" INTEGER,
    "overbookAllowance" INTEGER NOT NULL DEFAULT 0,
    "publiclyVisible" BOOLEAN NOT NULL DEFAULT true,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapacityQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Couple" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "dissolvedAt" TIMESTAMP(3),
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Couple_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "personUserId" INTEGER,
    "holderName" TEXT NOT NULL,
    "holderSurname" TEXT NOT NULL,
    "holderEmail" TEXT NOT NULL,
    "declaredRole" "DeclaredDanceRole" NOT NULL,
    "assignedRole" "DanceRole",
    "channel" "RegistrationChannel" NOT NULL DEFAULT 'ONLINE_SALE',
    "status" "RegistrationStatus" NOT NULL DEFAULT 'TO_CONFIRM',
    "confirmedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "coupleId" INTEGER,
    "isMinor" BOOLEAN NOT NULL DEFAULT false,
    "guardianUserId" INTEGER,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaConsumption" (
    "id" SERIAL NOT NULL,
    "capacityQuotaId" INTEGER NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotaConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CapacityQuota_eventId_scope_idx" ON "CapacityQuota"("eventId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "CapacityQuota_eventId_scope_scopeId_role_key" ON "CapacityQuota"("eventId", "scope", "scopeId", "role");

-- CreateIndex
CREATE INDEX "Couple_eventId_idx" ON "Couple"("eventId");

-- CreateIndex
CREATE INDEX "Registration_eventId_assignedRole_idx" ON "Registration"("eventId", "assignedRole");

-- CreateIndex
CREATE INDEX "Registration_eventId_status_idx" ON "Registration"("eventId", "status");

-- CreateIndex
CREATE INDEX "Registration_coupleId_idx" ON "Registration"("coupleId");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_eventId_personUserId_key" ON "Registration"("eventId", "personUserId");

-- CreateIndex
CREATE INDEX "QuotaConsumption_registrationId_idx" ON "QuotaConsumption"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "QuotaConsumption_capacityQuotaId_registrationId_key" ON "QuotaConsumption"("capacityQuotaId", "registrationId");

-- AddForeignKey
ALTER TABLE "CapacityQuota" ADD CONSTRAINT "CapacityQuota_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Couple" ADD CONSTRAINT "Couple_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_personUserId_fkey" FOREIGN KEY ("personUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_guardianUserId_fkey" FOREIGN KEY ("guardianUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaConsumption" ADD CONSTRAINT "QuotaConsumption_capacityQuotaId_fkey" FOREIGN KEY ("capacityQuotaId") REFERENCES "CapacityQuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaConsumption" ADD CONSTRAINT "QuotaConsumption_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- FASE C — vincoli aggiunti a mano, NON generabili da schema.prisma.
-- backend-brief §4.8 · `05-modello-capienza.md` §2.1 e §12.
-- ============================================================================

-- 1) UNICITÀ REALE DELLA TERNA DI IDENTITÀ DELLA QUOTA.
--    `@@unique([eventId, scope, scopeId, role])` di Prisma produce un indice
--    unico con la semantica PostgreSQL di serie: **ogni NULL è distinto**.
--    Conseguenza: due quote di capienza della sala (scope=EVENT, scopeId NULL,
--    role NULL) NON entrerebbero in conflitto, e `05` §2.1 — «non esistono due
--    quote per la stessa cosa» — resterebbe lettera morta proprio sulla quota
--    più importante. Una seconda quota di sala mai applicata è capienza non
--    controllata: si vende oltre il limite senza che nulla lo segnali.
--    L'indice viene quindi ricreato con lo STESSO NOME e le STESSE colonne ma
--    con NULLS NOT DISTINCT (PostgreSQL 15+): Prisma continua a riconoscerlo.
DROP INDEX "CapacityQuota_eventId_scope_scopeId_role_key";
CREATE UNIQUE INDEX "CapacityQuota_eventId_scope_scopeId_role_key"
    ON "CapacityQuota" ("eventId", "scope", "scopeId", "role") NULLS NOT DISTINCT;

-- 2) Contatori non negativi. È la rete di sicurezza del RILASCIO: un decremento
--    che scendesse sotto zero è deriva fra contatori e realtà (`05` §8), e va
--    fermato dove non può essere ignorato.
--    NOTA — il tetto `consumed <= limit + overbookAllowance` NON è un vincolo di
--    tabella, ed è deliberato: una quota `limiting = false` DEVE poter superare
--    il limite (contare senza bloccare, `05` §3 e caso T11), e l'emissione
--    manuale di pass non è mai bloccata dalle quote (`RB20`). L'invariante I1
--    parla infatti della sola quota-parte proveniente dalla vendita online, che
--    è garantita dall'aggiornamento CONDIZIONATO del §4.8, non dal database.
ALTER TABLE "CapacityQuota"
    ADD CONSTRAINT "CapacityQuota_consumed_non_negative" CHECK ("consumed" >= 0),
    ADD CONSTRAINT "CapacityQuota_limit_non_negative" CHECK ("limit" >= 0),
    ADD CONSTRAINT "CapacityQuota_overbook_non_negative" CHECK ("overbookAllowance" >= 0);

-- 3) Coerenza strutturale della quota (§4.8). Il servizio la verifica per primo e
--    restituisce un messaggio in italiano; questi vincoli sono il backstop che
--    impedisce a una riga incoerente di entrare da qualunque altra strada.
ALTER TABLE "CapacityQuota"
    ADD CONSTRAINT "CapacityQuota_scopeId_required" CHECK (
        ("scope" = 'EVENT' AND "scopeId" IS NULL)
        OR ("scope" <> 'EVENT' AND "scopeId" IS NOT NULL)
    ),
    -- Le quote di titolo e di servizio sono PER PERSONA, indipendentemente da
    -- come balla: il ruolo è valorizzabile solo su EVENT e SESSION.
    ADD CONSTRAINT "CapacityQuota_role_scope" CHECK (
        "role" IS NULL OR "scope" IN ('EVENT', 'SESSION')
    ),
    -- La capienza della sala e le quote di ruolo di ambito EVENT non ammettono
    -- sforamento e sono sempre limitanti: non è un limite commerciale, è un
    -- vincolo di sicurezza (`05` §5.1).
    ADD CONSTRAINT "CapacityQuota_event_scope_is_hard" CHECK (
        "scope" <> 'EVENT' OR ("overbookAllowance" = 0 AND "limiting" = true)
    );

-- 4) Un consumo registra almeno un'unità: una riga a zero occuperebbe la chiave
--    unica `(capacityQuotaId, registrationId)` senza contare nulla, e renderebbe
--    l'impegno idempotente su un consumo che non è mai avvenuto.
ALTER TABLE "QuotaConsumption"
    ADD CONSTRAINT "QuotaConsumption_quantity_positive" CHECK ("quantity" >= 1);
