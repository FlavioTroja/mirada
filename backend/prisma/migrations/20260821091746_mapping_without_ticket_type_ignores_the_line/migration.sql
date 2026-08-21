-- Una mappatura senza titolo significa «questo articolo non è un biglietto».
--
-- Emerso scrivendo l'ingestione: il negozio che vende i pass vende anche
-- magliette, libri e cene, e un ordine misto è il caso normale, non l'eccezione.
-- Senza questa distinzione ogni ordine misto sarebbe finito in quarantena, e la
-- quarantena — che esiste per dire «qualcosa non va» — avrebbe smesso di voler
-- dire qualcosa.
--
-- Restano due casi diversi e devono restare distinguibili:
--   nessuna mappatura        → non so cosa sia          → quarantena
--   mappatura senza titolo   → so cos'è, non è un pass  → riga ignorata
--
-- Nessun popolamento: la tabella è nata nella migrazione precedente e non ha
-- ancora una riga.

-- AlterTable
ALTER TABLE "SalesChannelMapping" ALTER COLUMN "ticketTypeId" DROP NOT NULL;
