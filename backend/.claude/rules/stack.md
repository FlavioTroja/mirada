# Stack

1. Runtime: Node.js + TypeScript.
2. HTTP framework: Fastify 5 with `fastify-decorators` (class-based controllers/services).
3. ORM: Prisma 7 against PostgreSQL.
4. Validation: Zod via `fastify-type-provider-zod`, schemas declared on each route.
5. Auth: JWT via `@fastify/jwt`, enforced by `@middleware/Authenticate` and `@middleware/HasPermission`.
6. Logging: Winston, exposed through `@utils/adapters/log` (see logging rules).
7. Tests: Jest against a real Postgres test DB (see testing rules).
8. Always try to use what is already here.
