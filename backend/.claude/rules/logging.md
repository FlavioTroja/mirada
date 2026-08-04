# Logging

The project's stdout is a first-class artifact: it must be readable by a **human and an AI**, and detailed enough that an operation can be **reconstructed from the logs alone**. Log every meaningful step, in one consistent shape.

## Logger
1. Use **`Log`** from `@utils/adapters/log` — the single logger for committed application code. (`LOGGER` in `@utils/adapters/winston` is a legacy duplicate used by seed/infra only; do **not** use it in new code.)
2. `console.log` is for local debugging only and must be stripped before committing (see `forbidden.md`).
3. Levels: `Log.info` for normal business events, `Log.warn` for handled/recoverable anomalies, `Log.error` for failures (log before throwing), `Log.debug` for verbose detail.

## Format
4. **Every** log message MUST follow this exact shape:

   ```
   [<Entity> <Layer>]: <concise English text, with entity references (name, id) where relevant>
   ```

   - `<Entity>` — the domain entity the class represents, PascalCase singular (`User`, `Person`, `Address`).
   - `<Layer>` — what the class *is*: `Controller`, `Service`, `Repository`, `Transformer`, `Middleware`, `Handler`, `Aspect`, …
   - Entity + Layer mirror the class name: `UserService` → `[User Service]`, `RoleToUserRepository` → `[RoleToUser Repository]`, `AuthController` → `[Auth Controller]`.
   - Text is **always English**, clear but concise, and carries the identifiers needed to follow the scenario (entity name, id, counts). Put ids/names inline, e.g. `(id 42)` / `'jdoe'`.

5. Examples:

   ```ts
   import { Log } from "@utils/adapters/log";

   Log.info(`[User Service]: creating user '${dto.username}'`);
   Log.info(`[User Service]: user created '${user.username}' (id ${user.id})`);
   Log.warn(`[Auth Service]: login failed for '${username}' — invalid password`);
   Log.error(`[User Repository]: update failed for user (id ${id}): ${err.message}`);
   ```

## What to log (so scenarios are reconstructable)
6. Log at the boundaries of every meaningful (side-effecting) operation so the flow is traceable end-to-end:
   - **Entry** of a write/side-effecting operation, with the key inputs/ids.
   - **Outcome** — success (with the resulting id) and each handled branch (not-found, forbidden, conflict).
   - **Handled errors** before throwing, with the id and cause.
7. One clear line per state change beats a verbose dump. Never log secrets (passwords, tokens) or whole request bodies.
