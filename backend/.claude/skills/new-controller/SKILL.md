---
name: new-controller
description: Scaffold a brand-new Fastify controller file for an entity, wiring authentication, route schemas, and bootstrap registration. Use when the user asks to create a new controller from scratch. Not for adding a single route to an existing controller.
---

# new-controller — scaffold a whole controller file from scratch

Creates a new `<Feature>Controller` file end-to-end, wires `Authenticate()` + `HasPermission(...)` per route, and registers the class in `src/server.ts`.

**Scope**: this skill only creates a new controller file. If `src/stack/controllers/<Feature>Controller.ts` already exists, **stop and tell the user** — adding a single route to an existing controller is out of scope.

## 0. Read the rules

Before anything else, Read these files in full — they are not auto-loaded into context:

- `.claude/rules/naming.md` — file / class naming

`.claude/rules/controllers.md`, `responses.md`, and `errors.md` are already in context via CLAUDE.md.

Do not proceed until the Read is done.

## 1. Pre-check

1. `src/stack/services/<Feature>Service.ts` must exist. If not → offer `new-service` first; if declined, stop.
2. `src/stack/controllers/<Feature>Controller.ts` must **not** already exist. If it does → stop and tell the user this skill only creates new controllers.

## 2. Clarify

1. Entity name (singular PascalCase).
2. Plural slug for the route base (`/bookings`, `/people`). Default = simple plural.
3. `PermissionResource` enum value (or TODO, resolved in §4b).
4. Endpoints to scaffold: any subset of `POST /create`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`, plus custom kebab-case actions.

## 3. Scaffold the file

### 3a. Imports
Always: `FastifyReply, FastifyRequest` (`fastify`); `Controller` + verb decorators (`fastify-decorators`); `Authenticate` (`@middleware/Authenticate`); `<Feature>Service`.
Conditional: `HasPermission` + `PermissionAction`/`Resource`/`Scope` enums; `exz, FindOptions` (`@utils/helpers/exz`); `httpErrors` (`http-errors`); DTO schema/type pairs from `@DTOs/<feature>/...`.
**Forbidden:** `@prisma/client`.

### 3b. Skeleton

```ts
@Controller({
    route: "/<features>",
    tags: [{ name: "<Features>", description: "<Feature> management" }],
})
export class <Feature>Controller {
    constructor(private readonly <feature>Service: <Feature>Service) {}
}
```

## 4. Write each endpoint

Canonical shape — every route looks like this:

```ts
@POST("/create", {
    schema: {
        operationId: "create<Feature>",
        summary: "Create <Feature>",
        description: "Creates a new <feature>.",
        body: <Feature>CreateSchema,
        security: [{ apiKey: [] }],
    },
    onRequest: [
        Authenticate(),
        HasPermission(PermissionAction.CREATE, PermissionResource.<FEATURE>, PermissionScope.ALL),
    ],
})
async create(
    req: FastifyRequest<{ Body: <Feature>CreateDTO }>,
    reply: FastifyReply,
) {
    reply.status(200).send(await this.<feature>Service.save(+req.user.id, req.body));
}
```

Always-present pieces: `operationId` + `summary` + `description`, `security: [{ apiKey: [] }]`, `Authenticate()` + `HasPermission(...)` in `onRequest`. Handler body is just service call → `reply.status(200).send(...)`. Throw `httpErrors.NotFound()` / `BadRequest()` for short-circuits before the service.

`GET /:id`: `params: exz.pathId`, `querystring: exz.findOptions`, `NotFound` on null. Same shape applies to paginate / update / delete / kebab-case actions.

### 4b. Confirm `HasPermission` scopes

Ask the user which `(action, scope)` to use per endpoint.

`PermissionScope` values: `ALL` (any record — typical for create/list), `SINGLE` (one by id — typical for get/update/delete), `OWN` (principal-owned), `GOD` (GOD-tier only), `TRASH` (soft-deleted). Also exists: `OTHERS`, `EVERYTHING` (rare).

If §2.3 left `PermissionResource` as a TODO, resolve it now (or have the user add a new enum entry).

## 5. Register in `src/server.ts`

1. Add `import { <Feature>Controller } from "@controllers/<Feature>Controller";`
2. Add the class to the `controllers: [...]` array inside `registerController()` (the array is `.sort()`-ed at runtime, but keep source roughly alphabetical).

Mirror whatever pattern already exists if it diverges.

## 6. Chain into ... nothing

Controller is the last layer. After scaffolding, summarize: endpoints added, which have `HasPermission`, suggest `yarn build`. Never commit/push.
