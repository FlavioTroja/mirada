# mirada-backend

RESTful API server (Fastify 5 + Prisma 7 + PostgreSQL), generated from @keijo/create-be@0.2.5.

Modules: stack + websocket (with tests).

## Requirements

- Node.js 22 (`nvm use 22`)
- Yarn
- Docker (for the bundled PostgreSQL and test DB)

## Setup

```bash
nvm use 22
yarn install
# .env is generated with your answers — review it if needed
(cd docker && docker compose up -d postgresql)
yarn prisma migrate dev --name init        # baseline migration from the schema
yarn prisma generate                       # Prisma 7: migrate no longer auto-generates the client
yarn dev
```

## Tests

```bash
# .env.test is generated with your answers
yarn docker-test:up
yarn test
```

## Conventions

Project rules live under `.claude/rules/` (entry point: `CLAUDE.md`).
