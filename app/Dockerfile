# syntax=docker/dockerfile:1.7
#
# Mirada — `app`, il gestionale: SPA Angular 20 + @keijo/ui, servita da nginx.
#
# ⚠️ IL CONTESTO DI BUILD È LA RADICE DEL REPOSITORY, non `app/`:
#
#     DOCKER_BUILDKIT=1 docker build -f app/Dockerfile \
#       --secret id=npm_token,src=/percorso/al/token -t mirada-app .
#
# Non è una preferenza. `app/angular.json` dichiara `../shared` fra gli
# `includePaths` di Sass (ci vive `mirada-theme.scss`, comune ad app e www) e
# lo script `prebuild` esegue `../tools/check-template-backticks.mjs`. Con il
# contesto su `app/` entrambi i percorsi cadono fuori, e il build fallisce a
# metà con un errore su un file che «non esiste» — mentre esiste, un livello
# più su.

# ---------------------------------------------------------------------------
# Stadio 1 — compilazione
# ---------------------------------------------------------------------------
# Debian slim e non alpine: rollup ed esbuild scelgono il binario nativo in base
# alla libc, e su musl servirebbe `@rollup/rollup-linux-x64-musl`, che il
# lockfile non prevede. Rottura gratuita in un'immagine che si compila una volta.
FROM node:22-bookworm-slim AS builder

WORKDIR /repo

# Manifesti e `.npmrc` prima del codice: finché non cambiano, il layer
# d'installazione resta in cache anche quando cambia una sola riga di template.
COPY app/package.json app/package-lock.json app/.npmrc ./app/

# Il token del registry privato entra come SECRET BuildKit, non come ARG: un
# ARG resterebbe leggibile per sempre in `docker history`, il secret è montato
# solo per la durata di questo RUN e non finisce in alcun layer.
#
# `--userconfig` punta npm a un file di configurazione UTENTE che esiste solo
# qui dentro: il `.npmrc` del progetto continua a valere (dichiara lo scope) e
# il token non tocca mai un file che possa finire in un layer.
#
# `npm ci` e non `npm install`: se il lockfile non basta, il build deve
# fallire qui, non risolvere versioni diverse da quelle provate in locale.
RUN --mount=type=secret,id=npm_token \
    set -eu; \
    cd app; \
    if [ -s /run/secrets/npm_token ]; then \
        printf '//npm.overzoom.it/:_authToken=%s\n' "$(tr -d '\r\n' < /run/secrets/npm_token)" > /tmp/npmrc.auth; \
        npm ci --userconfig /tmp/npmrc.auth; \
        rm -f /tmp/npmrc.auth; \
    else \
        echo "ATTENZIONE: nessun npm_token. Procedo in anonimo: fallirà se @keijo/ui non è pubblico."; \
        npm ci; \
    fi

# Le due cartelle fuori da `app/` che il build pretende. Stanno qui e non più
# in alto perché cambiano di rado: rimetterle sopra `npm ci` invaliderebbe il
# layer delle dipendenze a ogni ritocco del tema.
COPY shared/ ./shared/
COPY tools/  ./tools/
COPY app/    ./app/

WORKDIR /repo/app
RUN npm run build

# ---------------------------------------------------------------------------
# Stadio 2 — servizio
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# La configurazione di serie serve /usr/share/nginx/html senza fallback SPA:
# va SOSTITUITA, non affiancata.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY app/docker/nginx.conf /etc/nginx/conf.d/default.conf

# `angular.json` non dichiara `outputPath`, quindi vale il default `dist/app`;
# col builder `@angular/build:application` i file del browser stanno nel
# sottolivello `browser/`. Copiare `dist/app` intero metterebbe `index.html` un
# livello troppo in basso e nginx risponderebbe 403 su tutto.
COPY --from=builder /repo/app/dist/app/browser/ /usr/share/nginx/html/

EXPOSE 80

# Verifica che nginx serva la SPA. NON interroga l'API: un frontend sano non
# deve risultare malato perché il backend è giù.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/index.html || exit 1

CMD ["nginx", "-g", "daemon off;"]
