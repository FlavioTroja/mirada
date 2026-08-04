# Repositories — `src/stack/repositories/*Repository.ts`

1. **Always** `extends BaseRepository<"modelKey">` (e.g. `extends BaseRepository<"user">`).
2. Inherit and prefer the base methods: `save`, `saveWithRelations`, `update`, `findOne`, `findMany`, `deleteById`, `deleteOne`, `count`, `paginate`. Add custom finders only when the base methods do not cover the case.
3. Only repositories may call Prisma model delegates directly.
4. Wrap any custom query in `this.exec(() => …)` so Prisma errors are mapped to HTTP errors via `mapPrismaErrorToHttpError`.
5. Every method that performs a **write** must accept an optional `tx?: Prisma.TransactionClient` and forward it via `this.getDelegate(tx)`, so callers can compose it inside `$transaction`.
6. Repositories return Prisma model types — they do not need to hide Prisma from services.
