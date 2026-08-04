# Services — `src/stack/services/*Service.ts`

1. Decorated with `@Service()` from `fastify-decorators`. Constructor injection only.
2. Hold business logic, permission checks, and orchestration across repositories.
3. Permission checks: `hasPermissionOrThrow` from `@utils/adapters/permission`.
4. May import Prisma types (`Prisma`, model types) and `@prisma-gen/zod`.
5. **Always go through a repository for data access.** The single exception is opening a `$transaction` via `getPrismaClient()` from `@utils/adapters/prisma`.
6. Obtain the Prisma client exclusively via `getPrismaClient()` from `@utils/adapters/prisma`.
7. Throw `http-errors` (`BadRequest`, `NotFound`, `Forbidden`, …) with Italian user-facing messages where existing services do.
8. Logging: use `@utils/adapters/log` (see logging rules).
