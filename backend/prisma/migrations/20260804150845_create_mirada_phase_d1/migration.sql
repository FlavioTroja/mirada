-- CreateEnum
CREATE TYPE "RequirementOutcomeStatus" AS ENUM ('TO_PROVIDE', 'UNDER_REVIEW', 'VALID', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('VALID', 'TRANSFERRED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PassIssuanceReason" AS ENUM ('COMPLIMENTARY', 'EXTERNAL_SALE', 'GIFT', 'COURTESY');

-- CreateEnum
CREATE TYPE "CheckInKind" AS ENUM ('OPERATOR', 'MANUAL_SEARCH', 'EXTERNAL_ENTRY');

-- CreateEnum
CREATE TYPE "CheckInResult" AS ENUM ('VALID', 'ALREADY_USED', 'WRONG_EVENT', 'REFUNDED_OR_CANCELLED', 'REQUIREMENT_BLOCKED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "ReleaseReason" AS ENUM ('EXPIRED', 'ABANDONED', 'PAYMENT_FAILED', 'COMPLETED');

-- CreateTable
CREATE TABLE "RequirementOutcome" (
    "id" SERIAL NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "eventRequirementId" INTEGER NOT NULL,
    "status" "RequirementOutcomeStatus" NOT NULL DEFAULT 'TO_PROVIDE',
    "value" JSONB NOT NULL DEFAULT '{}',
    "acceptedAt" TIMESTAMP(3),
    "acceptedIp" TEXT,
    "acceptedVersion" TEXT,
    "reviewedByUserId" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" SERIAL NOT NULL,
    "buyerUserId" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "totalPresaleRights" INTEGER NOT NULL DEFAULT 0,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "purchaseId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "presaleRights" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "priceLockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "ticketTypeId" INTEGER,
    "eventServiceId" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL DEFAULT 0,
    "presaleRightsPerUnit" INTEGER NOT NULL DEFAULT 0,
    "lineTotal" INTEGER NOT NULL DEFAULT 0,
    "priceTierId" INTEGER,
    "attendees" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "rearmedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "releaseReason" "ReleaseReason",
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
    "providerPaymentId" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL DEFAULT 0,
    "applicationFeeAmount" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "processedEventIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassIssuance" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "ticketTypeId" INTEGER NOT NULL,
    "issuedByUserId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "reason" "PassIssuanceReason" NOT NULL,
    "role" "DanceRole",
    "nominal" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassIssuance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" SERIAL NOT NULL,
    "orderLineId" INTEGER,
    "passIssuanceId" INTEGER,
    "eventId" INTEGER NOT NULL,
    "ticketTypeId" INTEGER NOT NULL,
    "registrationId" INTEGER,
    "code" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'VALID',
    "holderName" TEXT NOT NULL,
    "holderSurname" TEXT NOT NULL,
    "holderEmail" TEXT,
    "bearer" BOOLEAN NOT NULL DEFAULT false,
    "qrIssuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qrRevokedAt" TIMESTAMP(3),
    "pdfFileId" INTEGER,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTransfer" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "fromUserId" INTEGER,
    "toUserId" INTEGER,
    "fromHolder" JSONB NOT NULL,
    "toHolder" JSONB NOT NULL,
    "previousCode" TEXT NOT NULL,
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "operatorUserId" INTEGER NOT NULL,
    "kind" "CheckInKind" NOT NULL DEFAULT 'OPERATOR',
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),
    "deviceId" TEXT NOT NULL,
    "offline" BOOLEAN NOT NULL DEFAULT false,
    "conflictWithId" INTEGER,
    "revokedAt" TIMESTAMP(3),
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequirementOutcome_eventRequirementId_idx" ON "RequirementOutcome"("eventRequirementId");

-- CreateIndex
CREATE INDEX "RequirementOutcome_registrationId_status_idx" ON "RequirementOutcome"("registrationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementOutcome_registrationId_eventRequirementId_key" ON "RequirementOutcome"("registrationId", "eventRequirementId");

-- CreateIndex
CREATE INDEX "Purchase_buyerUserId_idx" ON "Purchase"("buyerUserId");

-- CreateIndex
CREATE INDEX "Order_purchaseId_idx" ON "Order"("purchaseId");

-- CreateIndex
CREATE INDEX "Order_organizationId_status_idx" ON "Order"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Order_eventId_status_idx" ON "Order"("eventId", "status");

-- CreateIndex
CREATE INDEX "OrderLine_orderId_idx" ON "OrderLine"("orderId");

-- CreateIndex
CREATE INDEX "OrderLine_ticketTypeId_idx" ON "OrderLine"("ticketTypeId");

-- CreateIndex
CREATE INDEX "Reservation_orderId_idx" ON "Reservation"("orderId");

-- CreateIndex
CREATE INDEX "Reservation_userId_eventId_idx" ON "Reservation"("userId", "eventId");

-- CreateIndex
CREATE INDEX "Reservation_expiresAt_idx" ON "Reservation"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_orderId_status_idx" ON "Payment"("orderId", "status");

-- CreateIndex
CREATE INDEX "Payment_providerPaymentId_idx" ON "Payment"("providerPaymentId");

-- CreateIndex
CREATE INDEX "PassIssuance_eventId_issuedAt_idx" ON "PassIssuance"("eventId", "issuedAt");

-- CreateIndex
CREATE INDEX "PassIssuance_ticketTypeId_idx" ON "PassIssuance"("ticketTypeId");

-- CreateIndex
CREATE INDEX "PassIssuance_issuedByUserId_idx" ON "PassIssuance"("issuedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_code_key" ON "Ticket"("code");

-- CreateIndex
CREATE INDEX "Ticket_eventId_status_idx" ON "Ticket"("eventId", "status");

-- CreateIndex
CREATE INDEX "Ticket_code_idx" ON "Ticket"("code");

-- CreateIndex
CREATE INDEX "Ticket_registrationId_idx" ON "Ticket"("registrationId");

-- CreateIndex
CREATE INDEX "Ticket_ticketTypeId_idx" ON "Ticket"("ticketTypeId");

-- CreateIndex
CREATE INDEX "Ticket_passIssuanceId_idx" ON "Ticket"("passIssuanceId");

-- CreateIndex
CREATE INDEX "Ticket_orderLineId_idx" ON "Ticket"("orderLineId");

-- CreateIndex
CREATE INDEX "TicketTransfer_ticketId_transferredAt_idx" ON "TicketTransfer"("ticketId", "transferredAt");

-- CreateIndex
CREATE INDEX "TicketTransfer_fromUserId_idx" ON "TicketTransfer"("fromUserId");

-- CreateIndex
CREATE INDEX "TicketTransfer_toUserId_idx" ON "TicketTransfer"("toUserId");

-- CreateIndex
CREATE INDEX "CheckIn_sessionId_scannedAt_idx" ON "CheckIn"("sessionId", "scannedAt");

-- CreateIndex
CREATE INDEX "CheckIn_deviceId_idx" ON "CheckIn"("deviceId");

-- CreateIndex
CREATE INDEX "CheckIn_registrationId_idx" ON "CheckIn"("registrationId");

-- CreateIndex
CREATE INDEX "CheckIn_conflictWithId_idx" ON "CheckIn"("conflictWithId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckIn_ticketId_sessionId_key" ON "CheckIn"("ticketId", "sessionId");

-- AddForeignKey
ALTER TABLE "RequirementOutcome" ADD CONSTRAINT "RequirementOutcome_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementOutcome" ADD CONSTRAINT "RequirementOutcome_eventRequirementId_fkey" FOREIGN KEY ("eventRequirementId") REFERENCES "EventRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementOutcome" ADD CONSTRAINT "RequirementOutcome_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_eventServiceId_fkey" FOREIGN KEY ("eventServiceId") REFERENCES "EventService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_priceTierId_fkey" FOREIGN KEY ("priceTierId") REFERENCES "PriceTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassIssuance" ADD CONSTRAINT "PassIssuance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassIssuance" ADD CONSTRAINT "PassIssuance_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassIssuance" ADD CONSTRAINT "PassIssuance_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_passIssuanceId_fkey" FOREIGN KEY ("passIssuanceId") REFERENCES "PassIssuance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_pdfFileId_fkey" FOREIGN KEY ("pdfFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTransfer" ADD CONSTRAINT "TicketTransfer_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTransfer" ADD CONSTRAINT "TicketTransfer_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTransfer" ADD CONSTRAINT "TicketTransfer_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_operatorUserId_fkey" FOREIGN KEY ("operatorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_conflictWithId_fkey" FOREIGN KEY ("conflictWithId") REFERENCES "CheckIn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- FASE D1 — vincoli aggiunti a mano, NON generabili da schema.prisma.
-- backend-brief §4.12 · §4.13 · `09-titoli-e-pass.md` §7.
-- ============================================================================

-- 1) `RB7` — UN QR VALE UNA SOLA VOLTA PER SESSIONE.
--    `@@unique([ticketId, sessionId])` di Prisma produce un indice unico PIENO:
--    impedirebbe anche di riammettere un biglietto dopo l'annullamento di un
--    check-in errato (`RF-CHK-9`), e soprattutto impedirebbe di REGISTRARE il
--    doppio ingresso rilevato in sincronizzazione — che `RF-CHK-6` impone di
--    creare come conflitto da risolvere, mai di risolvere in silenzio.
--    L'indice è quindi ricreato con lo STESSO NOME e le STESSE colonne, ma
--    parziale.
--
--    SCOSTAMENTO DICHIARATO DAL §4.13 — il brief scrive «indice unico parziale
--    su (ticketId, sessionId) quando `revokedAt` è nullo». Preso alla lettera,
--    quel predicato rende IRREALIZZABILE la riga di conflitto di `RF-CHK-6`: la
--    seconda scansione della stessa coppia biglietto–sessione ha `revokedAt`
--    nullo per definizione — non è revocata, è in attesa che lo staff decida —
--    e verrebbe respinta dal database invece che consegnata a
--    `/check-in/conflicts`, dove il frontend brief (§4.6) la elenca insieme al
--    primo ingresso «con ora e postazione». Le due prescrizioni non possono
--    essere entrambe vere con il predicato letterale.
--    Il predicato è perciò esteso a `conflictWithId IS NULL`. Il vincolo resta
--    un SOVRAINSIEME di `RB7`: continua a garantire **un solo ingresso valido
--    per biglietto e sessione**, perché una riga di conflitto è per definizione
--    un doppione segnalato, non un secondo ingresso ammesso.
DROP INDEX "CheckIn_ticketId_sessionId_key";
CREATE UNIQUE INDEX "CheckIn_ticketId_sessionId_key"
    ON "CheckIn" ("ticketId", "sessionId")
    WHERE "revokedAt" IS NULL AND "conflictWithId" IS NULL;

-- 2) `RF-PAY-23` — una sola prenotazione ATTIVA per utente e per evento (§4.11).
--    Il modello è un guscio della fase D2, ma il vincolo si mette adesso: una
--    tabella che nasce senza la sua regola la riceve poi su dati già scritti.
CREATE UNIQUE INDEX "Reservation_userId_eventId_active_key"
    ON "Reservation" ("userId", "eventId")
    WHERE "releasedAt" IS NULL;

-- 3) Un'emissione di pass emette almeno un pass, e un biglietto al portatore non
--    ha titolare: sono le due condizioni che rendono coerenti i contatori del
--    cruscotto e la regola «i pass senza nominativo non sono trasferibili»
--    (§4.12). Il servizio le verifica per primo con un messaggio in italiano;
--    questi vincoli sono il backstop che chiude ogni altra strada.
ALTER TABLE "PassIssuance"
    ADD CONSTRAINT "PassIssuance_quantity_positive" CHECK ("quantity" >= 1);

ALTER TABLE "OrderLine"
    ADD CONSTRAINT "OrderLine_quantity_positive" CHECK ("quantity" >= 1);

-- 4) `RB12` — minimizzazione. Un pass al portatore non porta un'email: non è
--    una convenzione dell'interfaccia, è la ragione per cui esiste il flag.
ALTER TABLE "Ticket"
    ADD CONSTRAINT "Ticket_bearer_has_no_email" CHECK (
        "bearer" = false OR "holderEmail" IS NULL
    );

-- 5) Un check-in non può essere in conflitto con se stesso: sarebbe un ciclo di
--    un solo nodo che manderebbe in pasticcio la vista di risoluzione.
ALTER TABLE "CheckIn"
    ADD CONSTRAINT "CheckIn_conflict_not_self" CHECK (
        "conflictWithId" IS NULL OR "conflictWithId" <> "id"
    );
