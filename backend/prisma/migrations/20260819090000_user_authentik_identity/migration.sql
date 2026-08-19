-- L'identità su Authentik, per l'accesso tramite il fornitore di identità.
--
-- Nullable e senza popolamento: nessuna riga esistente ha un'identità Authentik,
-- e inventarne una sarebbe peggio che lasciarla assente. Si valorizza al primo
-- accesso SSO, quando il token porta un `sub` verificato.
--
-- L'unicità è la garanzia che conta: due utenze di mirada non possono
-- rivendicare la stessa identità. In PostgreSQL un indice univoco ammette più
-- righe NULL, quindi non ostacola le utenze che non usano l'SSO.
ALTER TABLE "User" ADD COLUMN "authentikSub" TEXT;

CREATE UNIQUE INDEX "User_authentikSub_key" ON "User"("authentikSub");
