-- Autoregistrazione degli organizzatori, e inviti dentro un'organizzazione.

-- ── Ragione sociale e forma giuridica diventano facoltative ──────────────────
--
-- Erano obbligatorie perché le organizzazioni le apriva il Super Admin, con i
-- dati del contratto già sul tavolo. Da quando un organizzatore può aprirsela da
-- solo non si possono più pretendere al primo passo: chi prova la piattaforma la
-- sera non ha sottomano la visura, e un modulo che chiede la forma giuridica
-- prima ancora di far vedere com'è fatto il prodotto è un modulo che nessuno
-- finisce.
--
-- Il dato non sparisce: `EventService.publish` lo pretende prima di mettere in
-- vendita, che è il momento in cui serve davvero. Nessuna riga esistente perde
-- nulla — si allenta un vincolo, non si cancella un valore.
ALTER TABLE "Organization" ALTER COLUMN "legalName" DROP NOT NULL;
ALTER TABLE "Organization" ALTER COLUMN "legalForm" DROP NOT NULL;

-- ── L'invito ────────────────────────────────────────────────────────────────
--
-- In tabella e non come gettone firmato: un invito deve poter essere revocato e
-- speso una volta sola, e una firma non sa fare né l'una né l'altra cosa.
--
-- Di `tokenHash` il nome dice tutto: qui vive l'IMPRONTA, non il gettone. Chi
-- legge la banca dati non deve poter entrare in un'organizzazione.
CREATE TABLE "OrganizationInvitation" (
    "id"             SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "email"          TEXT NOT NULL,
    "role"           "OrgMemberRole" NOT NULL DEFAULT 'OWNER',
    "tokenHash"      TEXT NOT NULL,
    "invitedById"    INTEGER NOT NULL,
    "expiresAt"      TIMESTAMP(3) NOT NULL,
    "acceptedAt"     TIMESTAMP(3),
    "acceptedById"   INTEGER,
    "revokedAt"      TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationInvitation_tokenHash_key" ON "OrganizationInvitation"("tokenHash");
CREATE INDEX "OrganizationInvitation_organizationId_idx" ON "OrganizationInvitation"("organizationId");
CREATE INDEX "OrganizationInvitation_email_idx" ON "OrganizationInvitation"("email");

ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_acceptedById_fkey"
    FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
