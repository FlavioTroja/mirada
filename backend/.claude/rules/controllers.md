# Controllers — `src/stack/controllers/*Controller.ts`

1. `@Controller({ route, tags })` from `fastify-decorators`. Route base is the feature in **plural** (`/users`, `/people`).
2. CRUD: `POST /create`, `GET /:id`, `POST /` (paginate), `PATCH /:id`, `DELETE /:id`. Non-CRUD uses kebab-case (`POST /:id/new-feature`).
3. One method per route, `@GET`/`@POST`/`@PATCH`/`@DELETE`.
4. Every `schema` declares `operationId`, `summary`, **and** `description` — none optional.
5. Validation: Zod schemas from `@DTOs/<feature>` on `body`/`params`/`querystring`. Reuse `exz.pathId`, `exz.findOptions`, `exz.paginateOptions` from `@utils/helpers/exz`.
6. Protected routes: `onRequest: [Authenticate(), HasPermission(action, resource, scope)]`. Use the `PermissionAction`/`PermissionResource`/`PermissionScope` enums.
7. Type the request: `FastifyRequest<{ Body, Params, Querystring }>`.
8. Handler body: call the service, then `reply.status(200).send(result)`. No business logic, no Prisma, no transformer calls.
9. Pre-service short-circuits: throw `httpErrors.NotFound()` / `httpErrors.BadRequest()` from `http-errors`.
10. Controller talks only to services.
11. **Updates touch ONE entity at a time. NO EXCEPTIONS.**
    - **Creation MAY cascade** — a `Create` DTO can embed nested related entities (e.g. `UserCreate` includes `person`, `contact`, `addresses`).
    - **Updates MAY NOT cascade — ever.** An `Update` DTO must contain ONLY the entity's own scalar fields. Do not include:
      - Nested related-entity payloads (`person: {...}`, `contact: {...}`).
      - FK arrays that mutate join/M2M tables (`amenityIds`, `roleIds`, `userIds`, `tagIds`, …). These mutate a different entity (the join rows) and are forbidden in the parent's update.
      - Any field whose handling requires writing to a table other than the entity's own row.
    - **Splitting rule:** every multi-entity mutation gets its own endpoint with its own DTO. Examples:
      - Replace a room's amenities → `PUT /rooms/:id/amenities` with `{ amenityIds }`.
      - Update a user's person → `PATCH /users/:id/person` with the person fields.
      - Add discount audience → `POST /discounts/:id/users` with `{ userIds }`.
    - **Self-check before writing any `<Feature>UpdateDTO`:** if a field would cause the service to touch a table other than `<feature>`, it does not belong in this DTO.
12. **Collection sub-resource edits use ONE PUT, not separate POST/PATCH/DELETE.**
    - For sub-collections of a parent (room images, user roles, …) expose a single `PUT /<parents>/:id/<children>` that accepts the **entire array** representing the desired state.
    - Each item carries: `id: number` (use `-1` for new rows) and optional `toBeDisconnected: boolean` for rows the client wants removed. Other fields are the row's own scalars (e.g. `position`, `isMain`, `roleName`).
    - DTO shape: wrap the per-item Zod schema with `withToBeDisconnected(...)` from `@utils/helpers/schemaTransformers`, then `.array()`.
    - Service splits the payload with `splitLinkableEntities(items)` from `@utils/helpers/mergeEntities` → `{ toCreate, toUpdate, toDisconnect }` and applies all three inside a single `getPrismaClient().$transaction(...)`. Reference: `UserService.updateUserRoles` + `RoleToUserUpdateDTO`.
    - Do **not** add separate `POST /add`, `PATCH /:childId`, `DELETE /:childId`, or `PUT /order` routes for the same collection. The single PUT subsumes add, update, reorder, and remove.
