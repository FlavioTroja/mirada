# Testing

1. Tests live under `test/` and run against a **real Postgres database**, never mocks.
2. The test DB is provisioned by `test/docker-compose.yml`:
   - `yarn docker-test:up` — boots the container and waits until healthy.
   - `yarn docker-test:down` — tears it down.
3. Connection details live in **`.env.test`** at the project root. `DATABASE_URL` must point to `localhost` / `127.0.0.1` — `test/check-db-url.sh` aborts the run otherwise (safety guard against wiping a remote DB).
4. `yarn test` runs `test/check-db-url.sh`, applies migrations with `prisma migrate deploy`, then runs Jest with `-i` (serial). The docker container must be up first.
5. **Tests must run serially — never in parallel.** They share a single Postgres instance and a `globalThis.__TEST_APP__` bridge. Parallel workers race on truncate+seed (Prisma `P2002`) and lose the shared app (`undefined .inject`). Serialization is enforced two ways: `yarn test` passes `-i` (`--runInBand`), **and** `jest.config.ts` sets `maxWorkers: 1` so any other launcher (WebStorm/IDE "run test") is serial too. `.env.test` is loaded by `test/setup.ts` itself, so IDE runs don't need the `dotenv` wrapper. Do not lower `maxWorkers` or remove `-i`.
6. New tests go under `test/`, mirror the `src/` layout (e.g. service tests under `test/services/`), and may reuse helpers in `test/setup.ts` / `test/setup-after-env.ts` and seed data from `test/seed/`.
7. **Test isolation** — when `SEED_TEST=true`, the database is truncated and re-seeded before each test file (`beforeAll` in `setup-after-env.ts`). When `SEED_TEST` is not true, the database is left as-is between suites.
8. **Controller tests** use `app.inject()` from the Fastify instance stored in `globalThis.__TEST_APP__`. Auth tokens for god/admin/user are in `globalThis.__TEST_TOKENS__`.
9. **Service tests** use `configureServiceTest` from `fastify-decorators/testing` to instantiate the service with real DI.
10. Always assert the HTTP status code before inspecting the response body.
