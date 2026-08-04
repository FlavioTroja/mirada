# Seeding

1. The seed script (`prisma/seed.ts`) populates the database with base entities (roles, permissions, default users, etc.) to make it easy for a new developer to spin up a working project.
2. **Dev database** — seeding runs only when `SEED=true` is set in `.env`. Without it the script exits as a no-op.
3. **Test database** — seeding runs only when `SEED_TEST=true` is set in `.env.test`. This gates the same logic for the Jest test DB.
4. When adding new seed data, make it **idempotent** (use `upsert` or check for existence) so re-running with the flag set does not duplicate rows or fail on unique constraints.
