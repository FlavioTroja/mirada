#!/usr/bin/env bash
# Rigenera www/public/social-card-v2.jpg da social-card.svg, in Sora.
#
# Il font non si installa nel sistema: una configurazione temporanea di
# fontconfig punta al file del pacchetto @fontsource-variable/sora di www/.
# ⚠️ Il JPG deve restare sotto circa 300 kB: oltre, WhatsApp scarta l'anteprima.
# ⚠️ Cambiando l'immagine si CAMBIA IL NOME (-v2, -v3…) e i riferimenti in
# www/src/index.html e seo.service.ts: i social tengono in cache l'anteprima
# per indirizzo, e con lo stesso nome continuerebbero a mostrare la vecchia.
set -euo pipefail
cd "$(dirname "$0")"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p "$T/fonts"
cp ../../www/node_modules/@fontsource-variable/sora/files/sora-latin-wght-normal.woff2 "$T/fonts/"
# ⚠️ rsvg-convert NON disegna i woff2: fontconfig li elenca, fc-match risponde
# «Sora», e poi il testo esce in un altro carattere senza un avviso. Si passa
# per un TTF (woff2_decompress, pacchetto woff2).
woff2_decompress "$T/fonts/sora-latin-wght-normal.woff2"
rm "$T/fonts/sora-latin-wght-normal.woff2"
cat > "$T/fonts.conf" <<CONF
<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig><include ignore_missing="yes">/etc/fonts/fonts.conf</include><dir>$T/fonts</dir><cachedir>$T/cache</cachedir></fontconfig>
CONF
FONTCONFIG_FILE="$T/fonts.conf" rsvg-convert -w 1200 -h 630 social-card.svg -o "$T/card.png"
magick "$T/card.png" -quality 88 ../../www/public/social-card-v2.jpg
ls -l ../../www/public/social-card-v2.jpg
