---
name: new-prisma-model
description: Add a new Prisma model to schema.prisma and walk the user through running the migration. Use when the user asks to add a new model, table, or entity to the database.
---

# new-prisma-model — add a new Prisma model

Use this skill when the user asks to add a new model, table, or entity to the database. The skill edits `prisma/schema.prisma`, then hands off the migration command to the user (it never runs `prisma migrate dev` itself), and finally offers to chain into `new-repository`.

## 0. Read the rules

Before anything else, Read these files in full — they are not auto-loaded into context:

- `.claude/rules/naming.md` — model / file naming
- `.claude/rules/seeding.md` — only if the user also wants seed data for this model

Do not proceed until the Reads are done.

## 1. Clarify (ask in one round)

1. **Model name** in singular PascalCase (`Booking`, `AuditLog`).
2. **Scalar fields** — for each: name, type, nullable?, unique?. Any explicit `@@index` / `@@unique` constraints?
3. **Relations** — for every FK relation, the skill must:
   - **Suggest names** following the convention used elsewhere in `prisma/schema.prisma`:
     - FK column: `<related>Id` (e.g. `userId`, `companyId`).
     - This-side relation field: camelCase singular of the related model (e.g. `user`, `company`).
     - Back-relation field on the other model: camelCase plural of this model (e.g. `bookings`, `addresses`); singular for 1-to-1.
   - Show the proposed names to the user and let them override before any schema is written.
   - Confirm the cardinality (1-1, 1-n, n-n) and `onDelete` / `onUpdate` behaviour. Project default for owned children is `onDelete: Cascade`; for optional/independent links use `SetNull`. Match what neighboring relations do if unsure.
4. **Standard fields** — repo convention (no need to read existing models to confirm):
   - `id        Int      @id @default(autoincrement())`
   - `deleted   Boolean  @default(false)` (soft delete — boolean flag, **not** a `deletedAt` timestamp)
   - `createdAt DateTime @default(now())`
   - `updatedAt DateTime @updatedAt`

   If the schema has drifted from this list, follow the schema, not this doc. If the user specifies a different shape (composite key, no soft delete, UUID id, etc.), **override the defaults** — never silently keep them.
5. **Migration verb** — propose `create` by default. Offer `edit`, `refactor`, or `delete` if the change is not a fresh add.

## 1b. Track relation fields

Build and maintain an internal list of every FK on the new model, in this shape:

```
Relations on Booking:
  - userId    → User.id    (relation field: user,    back-relation: bookings)
  - venueId?  → Venue.id   (relation field: venue,   back-relation: bookings)
```

This list must be:

- **Echoed back to the user** as part of the migration summary so they can verify it.
- **Passed forward** when chaining into `new-repository` / `new-dto` / `new-service`, so downstream skills know which fields are FKs and can shape `Create` DTOs and repository write helpers accordingly.

## 2. Edit `prisma/schema.prisma`

1. Use 5-space indentation, PascalCase model names, camelCase fields, and inline `@relation(...)` (the project does not use `@@map`). Append the new model at the bottom of the file with the standard fields from §1.4.
2. Wire every FK relation **on both sides** using the names confirmed in §1.3:
   - On the new model: the FK column (`userId Int`) **and** the relation field (`user User @relation(fields: [userId], references: [id], onDelete: …)`).
   - On the related model: the back-relation field (`bookings Booking[]`, or singular for 1-to-1).
3. Keep the relation tracker from §1b in sync with every schema edit you make in this step.

## 3. Propose migration name

1. Format: `<verb>_<entity_snake_case>` — examples: `create_booking`, `edit_user_email_unique`, `refactor_address_relations`, `delete_legacy_role`.
2. Verb is one of `create` / `edit` / `refactor` / `delete` from §1.5.
3. Entity portion is **snake_case**.
4. Show the proposed name to the user and let them confirm or override.

## 4. ⚠️ DATABASE_URL safety check

Before suggesting any migration command:

1. Read `.env` at the project root and grep for `DATABASE_URL`.
2. If the value does **not** match `localhost` or `127.0.0.1`, **alert the user loudly**:

   > ⚠️ **DATABASE_URL is not local** — it points to `<host>`. Running `yarn prisma migrate dev` against this database will modify it. Stop and confirm before proceeding.

3. **Never** run the migration automatically. Always have the user run it themselves, even when the URL is local.

## 5. Hand off the migration command

Tell the user to run:

```
yarn prisma migrate dev --name <chosen_name>
```

Wait for them to confirm it ran successfully before continuing. `prisma migrate dev` already regenerates `@prisma/client` and `@prisma-gen/zod`, so a separate `prisma generate` step is unnecessary unless the user explicitly asks for it.

## 5b. Ask for migration success

Ask the user if the migration is ok and if so add a new value in ModelNameItalia with its translation.

## 6. Chain into `new-repository`

After the migration is confirmed, **stop and explicitly ask** the user before invoking the next skill:

> The model `<Feature>` is in place. Want me to scaffold `<Feature>Repository` now? (runs `new-repository`)

**Never auto-invoke `new-repository`.** Wait for an explicit "yes" in a new user turn.

- If the user says yes → invoke `new-repository`, passing along the model name and the relation tracker from §1b.
- If the user says no → stop, and tell them they can invoke `new-repository` later.

**Exception:** if this skill was invoked by `new-resource` (the orchestrator), the user has already pre-approved the full chain — in that case proceed to `new-repository` without re-asking.

## Hard rules — verify before considering this skill done

- [ ] Standard fields are present unless the user overrode them.
- [ ] Every relation has names confirmed by the user for FK column, this-side field, and back-relation field.
- [ ] The relation tracker (§1b) was echoed back to the user and is ready to pass to chained skills.
- [ ] Migration name is snake_case and starts with `create` / `edit` / `refactor` / `delete`.
- [ ] DATABASE_URL safety check ran and the user was alerted if non-local.
- [ ] The skill did **not** run `prisma migrate dev` itself.
- [ ] The user was offered the chain into `new-repository`.
