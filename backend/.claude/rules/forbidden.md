# Things Claude must always do

1. Always ask for explicit confirmation before running destructive Prisma commands (`migrate reset`, `db push --force-reset`, etc.).
2. Always go through `BaseRepository` when a new repository needs to query Prisma.
3. Always keep business logic in services, and keep `@prisma/client` imports out of controllers.
4. Always strip `console.log` calls before committing.
