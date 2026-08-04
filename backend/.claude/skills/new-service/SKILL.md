---
name: new-service
description: Scaffold a brand-new service file for an entity, wiring constructor injection of the matching repository and any other repositories the user needs. Use when the user asks to create a new service from scratch. Not for adding a single method to an existing service.
---

# new-service — scaffold a whole service file from scratch

Creates a new `<Feature>Service` file decorated with `@Service()`, constructor-injects the matching repository (and any extras), and scaffolds the picked methods.

**Scope**: this skill only creates a new service file. If `src/stack/services/<Feature>Service.ts` already exists, **stop and tell the user** — adding a single method to an existing service is out of scope.

## 0. Read the rules

Before anything else, Read these files in full — they are not auto-loaded into context:

- `.claude/rules/transactions.md` — required reading before writing any cascading `save`
- `.claude/rules/logging.md` — exact log format for `@utils/adapters/log` calls
- `.claude/rules/naming.md` — file / class naming

`.claude/rules/services.md` and `dependency-injection.md` are already in context via CLAUDE.md.

Do not proceed until the Reads are done.

## 1. Pre-check

1. `src/stack/services/<Feature>Service.ts` must **not** already exist. If it does → stop and tell the user this skill only creates new services.
2. `src/stack/repositories/<Feature>Repository.ts` must exist. If not → offer `new-repository` first; if declined, stop. DTOs are nice-to-have; offer `new-dto` if clearly missing.

## 2. Clarify

1. Entity name (singular PascalCase).
2. Methods to scaffold — any subset of: `save`, `update`, `findById`, `findMany`, `paginate`, `deleteById`, plus custom names. "Empty class" is valid.
3. Cascading creation? (Does `save` need a `$transaction` because the DTO embeds related entities?)
4. Other repositories to inject (besides the matching one).

**`principalId` is opt-in:** add it only on methods that actually use it for ownership/scope-aware logic the middleware can't express. Do **not** add `principalId` just to call `hasPermissionOrThrow` — permission enforcement lives in the controller (`Authenticate()` + `HasPermission(...)`). Pure pass-throughs omit it.

## 3. Scaffold

### 3a. Imports
Always: `Service` (`fastify-decorators`), `<Feature>Repository`.
Conditional: `Log` (`@utils/adapters/log`, only on writes — reads do **not** log), `Prisma, <Feature>` (`@prisma/client`), `getPrismaClient` (`@utils/adapters/prisma`, only for `$transaction` — never `new PrismaClient()`), `FindOptions, PaginateOptions` (`@utils/helpers/exz`), `PaginateDatasourceDTO` (`@DTOs/paginate/PaginateDTO`), `httpErrors, { BadRequest, NotFound, Forbidden }` (`http-errors`, Italian messages), DTO types from `@DTOs/<feature>/...`, extra repos from `@repositories/...`.

### 3b. Skeleton

```ts
@Service()
export class <Feature>Service {
    constructor(
        private readonly <feature>Repository: <Feature>Repository,
        // additional repositories follow, also `private readonly`
    ) {}
}
```

## 4. Methods

### 4a. `save` (no cascading)

```ts
public async save(dto: <Feature>CreateDTO) {
    Log.info(`[<Feature> Service]: creating <feature>`);
    const <feature> = await this.<feature>Repository.save(dto);
    Log.info(`[<Feature> Service]: <feature> created (id ${<feature>.id})`);
    return <feature>;
}
```

### 4b. `save` (cascading — transaction-wrapped)

Canonical shape: a transformer splits the flat DTO into per-entity sub-DTOs, then `$transaction` creates them in dependency order, forwarding `prisma` to every repo call.

```ts
public async save(dto: <Feature>CreateDTO) {
    const split = new <Feature>CreationDTOTransformer().transform(dto);

    return getPrismaClient().$transaction(async prisma => {
        const parent = await this.parentRepository.save(split.parent(), prisma);
        const <feature> = await this.<feature>Repository.save(split.<feature>(parent.id), prisma);
        // ...further children with FKs back to <feature>.id
        return this.<feature>Repository.findById(<feature>.id, { populate: "..." }, prisma);
    });
}
```

Skip the transformer if there's no DTO splitting. If cascading details are unclear, leave a TODO — never invent relationships.

### 4c. `update` (single entity only — see controllers.md rule 11)

```ts
public async update(id: number, dto: <Feature>UpdateDTO) {
    Log.info(`[<Feature> Service]: updating <feature> (id ${id})`);
    return this.<feature>Repository.update({ id }, dto);
}
```

### 4d. Pass-throughs (`findById` / `findMany` / `paginate` / `deleteById`)

Reads do **not** log. `deleteById` does (it's a write).

```ts
public async findById(id: number, options?: FindOptions) {
    return this.<feature>Repository.findOne({ id }, options);
}
public async paginate(body: <Feature>PaginateDTO) {
    return this.<feature>Repository.paginate(body.query, body.options);
}
public async deleteById(id: number) {
    Log.info(`[<Feature> Service]: deleting <feature> (id ${id})`);
    return this.<feature>Repository.deleteById(id);
}
```

### 4e. Custom methods

Scaffold the signature + log line + a TODO. Never invent business logic.

## 5. Hard checks

- `@Service()` decorated; deps `private readonly`; first dep is the matching repo.
- Cascading `save` opens `getPrismaClient().$transaction` and forwards `prisma` to every inner call.
- No direct Prisma access outside `$transaction`. No `new PrismaClient()`.
- Logs follow the `logging.md` format: `[<Feature> Service]: <concise English text with name/id references>`.
- **Permission checks belong in the controller, not the service.** Do **not** call `hasPermissionOrThrow` or `hasPermission` from service methods, and do not accept a `principalId` argument purely to drive a permission check. Permission enforcement is the controller's responsibility via `Authenticate()` + `HasPermission(...)` middleware. Only add a permission call in a service when the user explicitly asks for it (e.g. ownership/scope-aware logic that the middleware cannot express).

## 6. Chain into `new-controller`

After the file exists, **stop and ask**:

> Service is in place. Want me to scaffold `<Feature>Controller` now?

**Never auto-invoke.** Wait for an explicit "yes". If no → remind that the controller must wire `Authenticate()` + `HasPermission(...)` before exposing the service.

**Exception:** when invoked by `new-resource`, proceed without re-asking.
