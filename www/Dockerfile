# syntax=docker/dockerfile:1.7
#
# Mirada — `www`, il sito pubblico: Angular 20 con **SSR** (@angular/ssr +
# express). A differenza di `app`, questa immagine NON è nginx con dei file
# dentro: è un **processo Node che genera l'HTML a ogni richiesta**, e questa
# differenza si porta dietro tutto il resto (l'healthcheck, la porta, il fatto
# che non ci sia un `try_files` da configurare).
#
# ⚠️ IL CONTESTO DI BUILD È LA RADICE DEL REPOSITORY, non `www/`:
#
#     DOCKER_BUILDKIT=1 docker build -f www/Dockerfile \
#       --secret id=npm_token,src=/percorso/al/token -t mirada-www .
#
# `www/angular.json` dichiara `../shared` fra gli `includePaths` di Sass e lo
# script `prebuild` esegue `../tools/check-template-backticks.mjs`: con il
# contesto su `www/` cadono entrambi fuori.

# ---------------------------------------------------------------------------
# Stadio 1 — compilazione
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /repo

COPY www/package.json www/package-lock.json www/.npmrc ./www/

# Token del registry privato come secret BuildKit: vedi `app/Dockerfile` per il
# perché per esteso. In sintesi: un ARG resterebbe in `docker history`.
RUN --mount=type=secret,id=npm_token \
    set -eu; \
    cd www; \
    if [ -s /run/secrets/npm_token ]; then \
        printf '//npm.overzoom.it/:_authToken=%s\n' "$(tr -d '\r\n' < /run/secrets/npm_token)" > /tmp/npmrc.auth; \
        npm ci --userconfig /tmp/npmrc.auth; \
        rm -f /tmp/npmrc.auth; \
    else \
        echo "ATTENZIONE: nessun npm_token. Procedo in anonimo: fallirà se @keijo/ui non è pubblico."; \
        npm ci; \
    fi

COPY shared/ ./shared/
COPY tools/  ./tools/
COPY www/    ./www/

WORKDIR /repo/www
RUN npm run build

# ---------------------------------------------------------------------------
# Stadio 2 — runtime
# ---------------------------------------------------------------------------
# node:22-alpine e non bookworm: qui non si compila più nulla, quindi il
# problema dei binari nativi su musl non si pone e l'immagine è molto più
# piccola. Il vincolo di libc valeva per rollup/esbuild, che restano nello
# stadio precedente e non arrivano qui.
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
# `www/src/server.ts` legge `process.env.PORT` e ripiega su 4000. Dichiararla
# rende la porta una proprietà dell'immagine invece di un default nascosto in
# un sorgente TypeScript.
ENV PORT=4000

# Il build SSR produce dist/www/{browser,server}: `server/server.mjs` è
# l'eseguibile ed `express` serve `browser/` da sé, quindi servono ENTRAMBI.
# Copiare il solo `server/` darebbe un sito che risponde e non ha né JS né CSS.
COPY --from=builder /repo/www/dist/ ./dist/

# `@angular/ssr` ed `express` sono dipendenze di RUNTIME: il server compilato
# le richiede a ogni avvio. Si copiano dallo stadio di build invece di
# reinstallarle, così non serve né npm né il registry privato qui dentro.
COPY --from=builder /repo/www/node_modules/ ./node_modules/
COPY --from=builder /repo/www/package.json ./package.json

# Non gira da root: l'immagine node porta già l'utente `node`.
USER node

EXPOSE 4000

# Sonda la radice, che è la pagina che il server RENDERIZZA: è la sola verifica
# che dica «l'SSR funziona» e non solo «la porta è aperta». Con `start-period`
# generoso perché il primo render compila le rotte.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "require('node:http').get('http://127.0.0.1:4000/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

# Lo stesso comando dello script `serve:ssr:www` di package.json, scritto per
# esteso: `npm run` interporrebbe una shell e un processo npm fra init e node,
# e i segnali di arresto arriverebbero al processo sbagliato — il container ci
# metterebbe i 10 secondi del timeout a fermarsi, a ogni deploy.
CMD ["node", "dist/www/server/server.mjs"]
