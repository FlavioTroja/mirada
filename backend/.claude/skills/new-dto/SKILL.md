---
name: new-dto
description: Scaffold the Zod DTO files (Create, Update, Query, Response) for an existing Prisma model. Use when the user asks to add or create the DTOs for an entity.
---

# new-dto — scaffold DTO files for an entity

Use this skill when the user asks to add or create the DTOs for an entity. The skill creates the four standard DTO files under `src/stack/DTOs/<feature>/`, reusing `@prisma-gen/zod` and the helpers in `@utils/helpers/schemaTransformers`. After scaffolding it offers to chain into `new-service`.

## 0. Read the rules

Before anything else, Read these files in full — they are not auto-loaded into context:

- `.claude/rules/dtos.md` — DTO conventions (mandatory)
- `.claude/rules/naming.md` — file / export naming

`.claude/rules/controllers.md` is already in context via CLAUDE.md; rule 11 governs the "one entity per update" constraint this skill enforces.

Do not proceed until the Reads are done.

## 1. Is this DTO tied to a Prisma model?

DTOs are not always tied to a Prisma model — many endpoints take/return shapes that don't correspond to a database entity (login payloads, search filters, computed reports, third-party integration responses, etc.).

**First, ask the user**:

> Is this DTO derived from a Prisma model, or is it a freestanding shape for a custom endpoint?

- **Tied to a model** → run the pre-check below.
- **Freestanding** → skip the pre-check entirely. Skip §2's reuse-of-`@prisma-gen/zod` guidance for this DTO. Hand-write the Zod schema in §3, still using `@utils/helpers/schemaTransformers` helpers where they apply (e.g. `paginateSchema` for list filters).

### Pre-check (only when the DTO is tied to a model)

1. **Read `prisma/schema.prisma`** and confirm the model is defined.
2. **Read `prisma/generated/zod`** (or wherever `@prisma-gen/zod` resolves) and confirm the generated `<Feature>Schema` exists.
3. If either is missing → **offer to chain into `new-prisma-model` first**. If the user declines, stop. Do not hand-write a Zod schema that duplicates a missing model — the entire point of `@prisma-gen/zod` is to keep DTOs in sync with the schema (see `.claude/rules/dtos.md` rule 3).

## 2. Clarify

1. **Entity name** in singular PascalCase (`Booking`) and the feature folder slug (`booking`, `audit_log`, …) — match existing folders under `src/stack/DTOs/`.
2. **Which of the four DTO files to scaffold** (default: all four):
   - `<Feature>CreateDTO.ts`
   - `<Feature>UpdateDTO.ts`
   - `<Feature>QueryDTO.ts`
   - `<Feature>ResponseDTO.ts`
3. **Cascading creation?** For `Create`, ask if any related entities should be created in the same payload (e.g. creating a User also creates a Person + Contact + Addresses). If yes, list which related entities — their `Create` schemas will be embedded.
4. **Update flow.** Remind the user that updates follow the rule in `.claude/rules/controllers.md` rule 11: each update endpoint touches **one kind of entity at a time**. The skill will scaffold `<Feature>UpdateDTO` for the entity's own scalar fields only — *not* a "god update" that touches related entities. If the user needs to update related entities, they'll need separate endpoints / DTOs (and the skill should mention this explicitly).

## 3. Use the project's schema helpers

The project ships helpers in `src/utils/helpers/schemaTransformers.ts` (`@utils/helpers/schemaTransformers`). **Use these** instead of re-implementing the same transformations — they exist to keep DTOs short and readable:

- `withoutMetadata(schema)` — strips `id`, `createdAt`, `updatedAt`, `deleted`. Use for `Create` schemas.
- `nullableToNullish(schema)` — converts nullable fields to nullish (so `null` and `undefined` are both accepted). Useful for `Update` partial schemas.
- `schemaCompose(schema, op1, op2, …)` — chain multiple operators left-to-right.
- `withToBeDisconnected(schema)` — adds the optional `toBeDisconnected: boolean` flag (used for nested updates that may detach a relation).
- `paginateSchema(querySchema)` — wraps a query schema in `{ query, options: paginateOptions }` for paginate endpoints.

If the project has additional helpers in that file, prefer them over hand-written transforms.

## 4. Scaffold the files

All files live under `src/stack/DTOs/<feature_slug>/`. Each file exports a Zod schema **and** the inferred type, per `.claude/rules/dtos.md` rule 2.

### `<Feature>CreateDTO.ts`

**Always start from the generated `<Feature>Schema`.** Never re-declare the entity's scalars in a fresh `z.object({...})` — that defeats `@prisma-gen/zod` and silently drifts. FK columns injected by the service/route (e.g. `userId` from auth) should be stripped with `.omit()`.

```ts
// ✅ simple case
export const BoxCreateSchema = withoutMetadata(BoxSchema.omit({ userId: true }));

// ❌ never do this — re-declares fields that already exist on BoxSchema
export const BoxCreateSchema = z.object({ name: z.string(), weight: z.number().int() });
```

For cascading creations, `.extend()` the stripped schema with nested related schemas (see `src/stack/DTOs/user/UserCreateDTO.ts` for a real example).

### `<Feature>UpdateDTO.ts`

Update is the entity's **own** scalar fields, made partial. Do not embed related entities — see `.claude/rules/controllers.md` rule 13.

```ts
import { z } from "zod";
import { <Feature>Schema } from "@prisma-gen/zod";
import { schemaCompose, withoutMetadata, nullableToNullish } from "@utils/helpers/schemaTransformers";

export const <Feature>UpdateSchema = schemaCompose(
    <Feature>Schema,
    withoutMetadata,
    nullableToNullish,
).partial();

export type <Feature>UpdateDTO = z.infer<typeof <Feature>UpdateSchema>;
```

### `<Feature>QueryDTO.ts`

Filters for list / paginate endpoints. Wrap with `paginateSchema` for paginate variants.

```ts
import { z } from "zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const <Feature>QuerySchema = z.object({
    // filter fields, e.g.:
    // search: z.string().optional(),
    // status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
});
export type <Feature>QueryDTO = z.infer<typeof <Feature>QuerySchema>;

export const <Feature>PaginateBodyInputSchema = paginateSchema(<Feature>QuerySchema);
export type <Feature>PaginateDTO = z.infer<typeof <Feature>PaginateBodyInputSchema>;
```

### `<Feature>ResponseDTO.ts`

Shape returned by the controller. Often the generated schema with relations included (`<Feature>WithRelations` from `@prisma-gen/zod`) — only define a custom shape when the response shouldn't expose every field.

```ts
import { z } from "zod";
import { <Feature>Schema } from "@prisma-gen/zod";

export const <Feature>ResponseSchema = <Feature>Schema; // or .omit({ ...sensitive fields })
export type <Feature>ResponseDTO = z.infer<typeof <Feature>ResponseSchema>;
```

## 5. Hard rules — verify before considering this skill done

- [ ] All four files exist under `src/stack/DTOs/<feature_slug>/` (or only the subset the user picked in §1.2).
- [ ] Every file exports both `<Feature><Kind>Schema` (Zod) and `<Feature><Kind>DTO` (`z.infer<…>`).
- [ ] If the DTO is tied to a Prisma model, `Create` and `Update` schemas are derived from `@prisma-gen/zod`, **not** hand-written. (Freestanding DTOs may be hand-written.)
- [ ] `Update` schema only touches the entity's own scalar fields — no embedded related-entity updates (see `.claude/rules/controllers.md` rule 11).
- [ ] Helpers from `@utils/helpers/schemaTransformers` are used where applicable (`withoutMetadata`, `nullableToNullish`, `schemaCompose`, `paginateSchema`).
- [ ] No duplicate field declarations that could be expressed via the generated schema + a transformer.

## 6. Chain into `new-service`

Workflow order is **prisma → repository → dto → service → controller**, so once the DTOs exist, the next step is the service.

After the files are created, **stop and explicitly ask** the user before invoking the next skill:

> The DTOs for `<Feature>` are in place. Want me to scaffold `<Feature>Service` now? (runs `new-service`)

**Never auto-invoke `new-service`.** Wait for an explicit "yes" in a new user turn.

- If yes → invoke `new-service`.
- If no → stop, and tell the user they can invoke `new-service` later.

**Exception:** if this skill was invoked by `new-resource` (the orchestrator), the user has already pre-approved the full chain — in that case proceed to `new-service` without re-asking.
