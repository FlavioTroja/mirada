-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'NONE';

-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "region" TEXT;

-- CreateIndex
CREATE INDEX "Address_region_idx" ON "Address"("region");

-- CreateIndex
CREATE INDEX "Address_city_idx" ON "Address"("city");

-- =============================================================================
-- Popolamento delle righe già esistenti — backend-brief §3.4
--
-- `Address.region` è **derivata, non digitata**: il servizio la calcola dalla
-- sigla di provincia su `create` e su `update`. Le righe già scritte non
-- passeranno mai da quel percorso, quindi la derivazione va applicata **qui**,
-- una volta sola: senza, ogni indirizzo anteriore a questa migrazione resterebbe
-- fuori dal filtro per regione della ricerca pubblica — un filtro che perde
-- silenziosamente delle righe è peggio di un filtro che non esiste.
--
-- La tabella è la stessa di `@utils/helpers/italianProvinces` (111 sigle: i 107
-- enti di area vasta di oggi più le quattro soppresse nel 2016, che compaiono
-- ancora negli indirizzi già scritti).
--
-- Il confronto è su `upper(trim(province))` perché la sigla arriva da un campo
-- libero della foundation: «bt», « BT » e «Bt» sono la stessa provincia.
-- Una sigla sconosciuta o estera lascia `region` a NULL, che è la risposta
-- onesta — mai una regione italiana inventata su un indirizzo straniero.
-- =============================================================================
UPDATE "Address" a
   SET "region" = p."region"
  FROM (VALUES
    ('AQ', 'Abruzzo'),
    ('CH', 'Abruzzo'),
    ('PE', 'Abruzzo'),
    ('TE', 'Abruzzo'),
    ('MT', 'Basilicata'),
    ('PZ', 'Basilicata'),
    ('CS', 'Calabria'),
    ('CZ', 'Calabria'),
    ('KR', 'Calabria'),
    ('RC', 'Calabria'),
    ('VV', 'Calabria'),
    ('AV', 'Campania'),
    ('BN', 'Campania'),
    ('CE', 'Campania'),
    ('NA', 'Campania'),
    ('SA', 'Campania'),
    ('BO', 'Emilia-Romagna'),
    ('FC', 'Emilia-Romagna'),
    ('FE', 'Emilia-Romagna'),
    ('MO', 'Emilia-Romagna'),
    ('PC', 'Emilia-Romagna'),
    ('PR', 'Emilia-Romagna'),
    ('RA', 'Emilia-Romagna'),
    ('RE', 'Emilia-Romagna'),
    ('RN', 'Emilia-Romagna'),
    ('GO', 'Friuli-Venezia Giulia'),
    ('PN', 'Friuli-Venezia Giulia'),
    ('TS', 'Friuli-Venezia Giulia'),
    ('UD', 'Friuli-Venezia Giulia'),
    ('FR', 'Lazio'),
    ('LT', 'Lazio'),
    ('RI', 'Lazio'),
    ('RM', 'Lazio'),
    ('VT', 'Lazio'),
    ('GE', 'Liguria'),
    ('IM', 'Liguria'),
    ('SP', 'Liguria'),
    ('SV', 'Liguria'),
    ('BG', 'Lombardia'),
    ('BS', 'Lombardia'),
    ('CO', 'Lombardia'),
    ('CR', 'Lombardia'),
    ('LC', 'Lombardia'),
    ('LO', 'Lombardia'),
    ('MB', 'Lombardia'),
    ('MI', 'Lombardia'),
    ('MN', 'Lombardia'),
    ('PV', 'Lombardia'),
    ('SO', 'Lombardia'),
    ('VA', 'Lombardia'),
    ('AN', 'Marche'),
    ('AP', 'Marche'),
    ('FM', 'Marche'),
    ('MC', 'Marche'),
    ('PU', 'Marche'),
    ('CB', 'Molise'),
    ('IS', 'Molise'),
    ('AL', 'Piemonte'),
    ('AT', 'Piemonte'),
    ('BI', 'Piemonte'),
    ('CN', 'Piemonte'),
    ('NO', 'Piemonte'),
    ('TO', 'Piemonte'),
    ('VB', 'Piemonte'),
    ('VC', 'Piemonte'),
    ('BA', 'Puglia'),
    ('BR', 'Puglia'),
    ('BT', 'Puglia'),
    ('FG', 'Puglia'),
    ('LE', 'Puglia'),
    ('TA', 'Puglia'),
    ('CA', 'Sardegna'),
    ('NU', 'Sardegna'),
    ('OR', 'Sardegna'),
    ('SS', 'Sardegna'),
    ('SU', 'Sardegna'),
    ('CI', 'Sardegna'),
    ('VS', 'Sardegna'),
    ('OT', 'Sardegna'),
    ('OG', 'Sardegna'),
    ('AG', 'Sicilia'),
    ('CL', 'Sicilia'),
    ('CT', 'Sicilia'),
    ('EN', 'Sicilia'),
    ('ME', 'Sicilia'),
    ('PA', 'Sicilia'),
    ('RG', 'Sicilia'),
    ('SR', 'Sicilia'),
    ('TP', 'Sicilia'),
    ('AR', 'Toscana'),
    ('FI', 'Toscana'),
    ('GR', 'Toscana'),
    ('LI', 'Toscana'),
    ('LU', 'Toscana'),
    ('MS', 'Toscana'),
    ('PI', 'Toscana'),
    ('PO', 'Toscana'),
    ('PT', 'Toscana'),
    ('SI', 'Toscana'),
    ('BZ', 'Trentino-Alto Adige'),
    ('TN', 'Trentino-Alto Adige'),
    ('PG', 'Umbria'),
    ('TR', 'Umbria'),
    ('AO', 'Valle d''Aosta'),
    ('BL', 'Veneto'),
    ('PD', 'Veneto'),
    ('RO', 'Veneto'),
    ('TV', 'Veneto'),
    ('VE', 'Veneto'),
    ('VI', 'Veneto'),
    ('VR', 'Veneto')
) AS p("code", "region")
 WHERE upper(btrim(a."province")) = p."code"
   AND a."region" IS NULL;
