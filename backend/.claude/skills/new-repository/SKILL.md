---
name: new-repository
description: Scaffold a brand-new repository file extending BaseRepository for an existing Prisma model. Use when the user asks to create a new repository from scratch. Not for adding a single method to an existing repository.
---

# new-repository — scaffold a whole repository file from scratch

Creates a new `<Feature>Repository` class file that extends `BaseRepository`, optionally generates `findBy<UniqueField>` finders at scaffold time, and offers to chain into `new-dto`.

**Scope**: this skill only creates a new repository file. If `src/stack/repositories/<Feature>Repository.ts` already exists, **stop and tell the user** — adding a single method to an existing repository is out of scope.

## 0. Read the rules

Before anything else, Read these files in full — they are not auto-loaded into context:

- `.claude/rules/naming.md` — file / class naming
- `.claude/rules/transactions.md` — every custom write method must accept `tx?`

`.claude/rules/repositories.md` is already in context via CLAUDE.md.

Do not proceed until the Reads are done.

## 1. Pre-check

1. `src/stack/repositories/<Feature>Repository.ts` must **not** already exist. If it does → stop and tell the user this skill only creates new repositories.
2. **Check the model exists.** Read `prisma/schema.prisma` and confirm the model is defined. If it is **not**:
   - Offer to chain into `new-prisma-model` first.
   - If the user declines, stop. Do not scaffold a repository for a model that doesn't exist.

## 2. Clarify

1. **Entity name** in singular PascalCase (`Booking`).
2. **Optional `findBy<UniqueField>` finders.** Identify the `@unique` scalar fields on the model (excluding `id`, which `BaseRepository.findOne` already covers). Ask the user:
   > Found these `@unique` fields on `<Feature>`: `email`, `slug`. Want me to scaffold `findByEmail` / `findBySlug` methods? (yes / no / pick a subset)

   Generate finders only for the ones the user confirms. Default to **none** if the user is unsure — they're easy to add later.
3. **Other custom methods.** Ask the user if they want any additional finders or write helpers up front (e.g. `findActive`, `softDelete`, `findManyByIds`). It's fine to skip and add them later.

## 3. Create `src/stack/repositories/<Feature>Repository.ts`

Bare minimum (always emitted):

```ts
import { Service } from "fastify-decorators";
import { BaseRepository } from "@repositories/BaseRepository";

@Service()
export class <Feature>Repository extends BaseRepository<"<feature>"> {
    constructor() {
        super("<feature>");
    }
}
```

- `@Service()` from `fastify-decorators` is **mandatory** — services constructor-inject the repository, and DI fails at runtime without it.
- `<feature>` is the **uncapitalized** Prisma model name (e.g. `"booking"`, `"auditLog"`).
- The class inherits `save`, `saveWithRelations`, `update`, `findOne`, `findMany`, `deleteById`, `deleteOne`, `count`, `paginate` from `BaseRepository`.

## 4. Add custom methods (when requested)

**Every custom method on a repository — finder or write — must follow the same pattern**, so it can be composed inside a `$transaction`:

1. Accept an optional `tx?: Prisma.TransactionClient` as the **last** parameter.
2. Resolve the delegate via `this.getDelegate(tx)` — never reach for `this.delegate` or `getPrismaClient()` directly.
3. Wrap the actual Prisma call in `this.exec(() => …)` so Prisma errors are mapped to HTTP errors via `mapPrismaErrorToHttpError`.

Example — `findBy<UniqueField>` (only if §0.3 confirmed):

```ts
import { BaseRepository } from "@repositories/BaseRepository";
import { Prisma } from "@prisma/client";

export class UserRepository extends BaseRepository<"user"> {
    constructor() {
        super("user");
    }

    async findByEmail(email: string, tx?: Prisma.TransactionClient) {
        return this.exec(() =>
            (this.getDelegate(tx) as any).findUnique({ where: { email } })
        );
    }
}
```

Example — custom write helper requested in §0.4:

```ts
async softDelete(id: number, tx?: Prisma.TransactionClient) {
    return this.exec(() =>
        (this.getDelegate(tx) as any).update({
            where: { id },
            data: { deletedAt: new Date() },
        })
    );
}
```

The `tx?` + `getDelegate(tx)` + `exec()` triple is **non-negotiable** for every custom method. Without it, the method cannot participate in a transaction and Prisma errors won't be mapped properly.

## 5. Hard rules — verify before considering this skill done

- [ ] Class extends `BaseRepository<"…">` with the correct uncapitalized model key.
- [ ] Constructor calls `super("<feature>")`.
- [ ] **Every** custom method (finder or write) accepts `tx?: Prisma.TransactionClient` as its last parameter.
- [ ] **Every** custom method resolves the delegate via `this.getDelegate(tx)`.
- [ ] **Every** custom method wraps its Prisma call in `this.exec(() => …)`.
- [ ] No direct `prisma.<model>.…()` or `this.delegate.…()` calls; everything goes through `getDelegate(tx)`.
- [ ] No imports from outside `fastify-decorators`, `@prisma/client`, and `@repositories/BaseRepository` unless the user explicitly asked for one.

## 6. Chain into `new-dto`

The standard workflow order in this project is **prisma → repository → dto → service → controller**, so once the repository exists, the next step is to scaffold the DTOs.

After the file is created, **stop and explicitly ask** the user before invoking the next skill:

> The repository `<Feature>Repository` is in place. Want me to scaffold the DTOs now? (runs `new-dto`)

**Never auto-invoke `new-dto`.** Wait for an explicit "yes" in a new user turn.

- If the user says yes → invoke `new-dto`.
- If no → stop and tell them they can invoke `new-dto` later.

**Exception:** if this skill was invoked by `new-resource` (the orchestrator), the user has already pre-approved the full chain — in that case proceed to `new-dto` without re-asking.
