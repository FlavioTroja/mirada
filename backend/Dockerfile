# Mirada Tango — backend (Fastify 5 + Prisma 7)
#
# Riscritto rispetto al Dockerfile del template `@keijo/create-be@0.2.5`, che
# faceva `COPY . .` senza `.dockerignore` (portandosi dentro node_modules, .git e
# il .env con il segreto JWT) e non eseguiva mai `yarn install` né `yarn build`:
# l'immagine dipendeva dal `dist/` e dai moduli già presenti sull'host, quindi non
# era ricostruibile da sorgente.

# ---------------------------------------------------------------------------
# Stage 1 — build: installa, genera il client Prisma, compila TypeScript.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app
RUN apk add --no-cache openssl

# Il layer delle dipendenze si invalida solo quando cambiano manifest o lockfile.
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000

COPY . .

# Prisma 7: `migrate` non rigenera più il client, va invocato esplicitamente.
# `zod-prisma-types` produce `prisma/generated/zod`, da cui dipendono tutti i DTO,
# quindi questo passo deve precedere `tsc`.
#
# `prisma.config.ts` risolve `env("DATABASE_URL")` al caricamento e fallisce se la
# variabile non esiste, anche per `generate`, che non apre alcuna connessione.
# Avendo escluso `.env` dall'immagine (giustamente: è un segreto), serve un valore
# fittizio — inline sulla RUN, così non diventa una ENV del layer. La stringa vera
# arriva a runtime da docker compose.
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" \
    yarn prisma generate \
 && yarn build

# ---------------------------------------------------------------------------
# Stage 2 — runtime.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime

WORKDIR /app
RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Le dipendenze restano complete e non vengono potate: `start:migrate:prod`
# invoca `prisma migrate deploy`, e la CLI Prisma è una devDependency.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json /app/yarn.lock /app/prisma.config.ts ./
COPY --from=build /app/public ./public

# `module-alias` risolve @controllers, @services, @prisma-gen… dal package.json
# verso `dist/`: package.json e dist devono restare fratelli in /app.

# I binari caricati (locandine, PDF dei biglietti) vivono su volume: decisione
# D-K del brief, «file su disco locale del backend», rivedibile verso S3.
RUN mkdir -p public/images public/pdf && chown -R node:node /app/public

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD node -e "require('node:net').connect(5000,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"

CMD ["yarn", "start:migrate:prod"]
