-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- =============================================================================
-- Popolamento delle righe già esistenti
--
-- Da questa migrazione in poi un account con `emailVerifiedAt` nullo NON può
-- accedere: l'indirizzo non è stato dimostrato da nessuno. Applicata alla
-- lettera sugli account già presenti, la regola li chiuderebbe fuori **tutti** —
-- compresi gli organizzatori e gli amministratori, che non hanno mai ricevuto
-- un'email di conferma perché al momento della loro iscrizione non esisteva.
--
-- Quegli account sono già operativi e sono stati creati quando la conferma non
-- era richiesta: la risposta onesta è considerarli confermati alla loro data di
-- creazione, non fingere che abbiano premuto un tasto che non è mai esistito.
-- La colonna resta quindi nulla solo per chi si iscrive **dopo** questa riga.
UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;
