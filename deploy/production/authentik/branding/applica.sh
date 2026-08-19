#!/usr/bin/env bash
# Applica la marchiatura di Mirada ad Authentik — logo, sfondo, carattere,
# tavolozza e titoli dei flussi.
#
# Si esegue SUL SERVER, dalla cartella dello stack:
#
#     cd ~/orch/authentik && bash /percorso/applica.sh
#
# È idempotente: rilanciarlo riscrive gli stessi valori. Serve dopo un ripristino
# del database di Authentik, o quando si cambia il CSS in questo repository.
#
# ⚠️ Gli asset (logo, sfondo, font) NON stanno in Authentik: sono serviti da
# https://mirada.dance/images/branding/, cioè dallo stesso posto da cui viene
# tutto il resto di Mirada. Vanno caricati nel volume `public` PRIMA di questo
# script — vedi il README, sezione «La marchiatura».
set -euo pipefail

cd "$(dirname "$0")"
CSS="${CSS_FILE:-./authentik.css}"
[ -f "$CSS" ] || { echo "CSS non trovato: $CSS"; exit 1; }

set -a; . "$HOME/orch/authentik/.env"; set +a
B="Authorization: Bearer ${AUTHENTIK_BOOTSTRAP_TOKEN}"
U=http://127.0.0.1:9000/api/v3

BRAND=$(curl -s "$U/core/brands/" -H "$B" | python3 -c 'import sys,json; print(json.load(sys.stdin)["results"][0]["brand_uuid"])')

python3 - "$CSS" > /tmp/mirada-brand.json <<'PY'
import json, sys
print(json.dumps({
    "branding_title": "Mirada Tango",
    "branding_logo": "https://mirada.dance/images/branding/logo.svg",
    "branding_favicon": "https://mirada.dance/favicon.ico",
    "branding_default_flow_background": "https://mirada.dance/images/branding/sfondo.svg",
    "branding_custom_css": open(sys.argv[1], encoding="utf-8").read(),
}))
PY

curl -s -X PATCH "$U/core/brands/$BRAND/" -H "$B" -H 'Content-Type: application/json' \
  --data-binary @/tmp/mirada-brand.json \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print("brand:", d.get("branding_title"), "— CSS", len(d.get("branding_custom_css") or ""), "caratteri")'
rm -f /tmp/mirada-brand.json

# ⚠️ I flussi si indirizzano per SLUG, non per pk: con il pk l'API risponde 404
# «No Flow matches the given query», che sembra un flusso inesistente e invece è
# la chiave sbagliata.
titolo() {
  python3 -c 'import json,sys; print(json.dumps({"title": sys.argv[1]}))' "$2" > /tmp/mirada-t.json
  curl -s -X PATCH "$U/flows/instances/$1/" -H "$B" -H 'Content-Type: application/json' \
    --data-binary @/tmp/mirada-t.json \
    | python3 -c 'import sys,json; d=json.load(sys.stdin); print("  %-42s %s" % (d.get("slug","?"), d.get("title", d)))'
}

titolo default-authentication-flow      "Accedi a Mirada Tango"
titolo default-enrollment-flow          "Crea il tuo accesso"
titolo default-source-authentication    "Accedi a Mirada Tango"
titolo default-source-enrollment        "Ancora un passo: scegli un nome utente"
titolo default-recovery-flow            "Recupera la tua password"
titolo default-password-change          "Cambia la password"
titolo default-user-settings-flow       "Il tuo profilo"
titolo default-invalidation-flow        "Hai chiuso la sessione"
titolo default-authenticator-totp-setup "Attiva il secondo fattore"
rm -f /tmp/mirada-t.json
