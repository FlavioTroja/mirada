-- ═══════════════════════════════════════════════════════════════════════════
-- I corsi sono una famiglia di tipi evento, non uno slug
--
-- `/courses` e `/events` sono due porte sulla stessa tabella. Il discriminante
-- è un DATO del tipo e non il suo nome: uno slug lascerebbe fuori il secondo
-- tipo di corso che qualcuno creerà («Corso serale», «Intensivo») senza che
-- nulla fallisca.
--
-- E la parola con cui si chiamano le sessioni segue il tipo: «Lezioni» in un
-- corso, «Sessioni» in un festival, sulla STESSA tabella `Session`.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TYPE "EventTypeFamily" AS ENUM ('EVENT', 'COURSE');

-- Tutto ciò che esiste oggi è un evento: il default regge la riga esistente e
-- non serve alcun travaso.
ALTER TABLE "EventType"
  ADD COLUMN "family" "EventTypeFamily" NOT NULL DEFAULT 'EVENT',
  ADD COLUMN "sessionsLabel" JSONB;
