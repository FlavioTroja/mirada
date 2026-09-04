-- ═══════════════════════════════════════════════════════════════════════════
-- L'anagrafica unica del ballerino — `16-anagrafica-unica.md` §2
--
-- `Registration` smette di puntare all'UTENZA e punta alla PERSONA. Non è un
-- rinominare: `User.personId` è obbligatorio e unico, quindi da una persona si
-- raggiunge l'account quando esiste, mentre il contrario non era vero — ed è
-- ciò che impediva a un'iscrizione di agganciare chi è censito senza account.
--
-- ⚠️ Scritta a mano. Quella generata avrebbe cancellato `personUserId` PRIMA di
-- travasarne il contenuto, e le iscrizioni collegate a un'utenza avrebbero
-- perso il legame in silenzio.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. La colonna nuova, nullabile: le iscrizioni non censite restano tali.
ALTER TABLE "Registration" ADD COLUMN "personId" INTEGER;

-- 2. Il travaso. Ogni `personUserId` valorizzato ha un `User`, e ogni `User` ha
--    un `personId` obbligatorio: nessuna riga può restare indietro per dati
--    mancanti, e la giunzione è una sola.
UPDATE "Registration" r
SET "personId" = u."personId"
FROM "User" u
WHERE r."personUserId" = u."id";

-- 3. Il vecchio vincolo e la vecchia colonna se ne vanno solo ADESSO.
ALTER TABLE "Registration" DROP CONSTRAINT IF EXISTS "Registration_personUserId_fkey";
DROP INDEX IF EXISTS "Registration_eventId_personUserId_key";
ALTER TABLE "Registration" DROP COLUMN "personUserId";

-- 4. Il vincolo nuovo. Vale **per persona** e non per utenza, quindi copre un
--    caso che prima sfuggiva: la stessa persona iscritta due volte allo stesso
--    evento, una con account e una a mano, che consumava capienza due volte.
--    I NULL restano distinti — le iscrizioni non censite non si ostacolano.
CREATE UNIQUE INDEX "Registration_eventId_personId_key" ON "Registration"("eventId", "personId");
CREATE INDEX "Registration_personId_idx" ON "Registration"("personId");

ALTER TABLE "Registration"
  ADD CONSTRAINT "Registration_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- A10 — l'interruttore di visibilità del profilo di ballo (`16` §5.2)
--
-- Acceso per difetto: il comportamento predefinito resta quello deciso, e chi
-- non tocca nulla resta visibile agli organizzatori che lo iscrivono.
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE "DancerProfile"
  ADD COLUMN "profileVisibleToOrganizers" BOOLEAN NOT NULL DEFAULT true;
