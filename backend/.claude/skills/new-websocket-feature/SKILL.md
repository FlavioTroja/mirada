---
name: new-websocket-feature
description: Scaffold a new WebSocket push event (backend → frontend) — event name in Events, payload DTO, publisher call site with the right targeting method. Use when the user asks to push a new kind of live update to the frontend over WebSocket. Not for changing an existing event (use edit-websocket-feature) and not for MQTT (use new-mqtt-feature).
---

# new-websocket-feature — scaffold a new WebSocket push event

Creates the push plumbing for one new frontend update: an event name in `Events`, a payload DTO, and the publisher call site in the owning service. The module is **outbound only** — there are no inbound handlers, no registry, no acks.

**Scope**: push plumbing only. The business logic that decides *when* to push (and builds the payload values) is hand-written afterwards — leave a `// TODO` at the call site rather than inventing it.

## 0. Read the rules

Before anything else, Read these files in full — they are not auto-loaded into context:

- `.claude/rules/naming.md` — file / class naming
- `.claude/rules/testing.md` — only if the user opts into the integration test in §3

`.claude/rules/websocket.md` is already in context via CLAUDE.md — every numbered rule applies; rules 3–6 (port-only access, envelope, event registry, payload DTOs) drive this skill.

Do not proceed until the Reads are done.

## 1. Clarify (ask in one round)

1. **Event name** — namespaced `<domain>/<action>` (e.g. `user/updated`, `order/status-changed`) and the matching `Events` key (e.g. `USER_UPDATED`). Respect the business-scope rule (features.md): if the event implies a business model that doesn't exist, stop and tell the user.
2. **Payload fields** — name, Zod type, optional? If the payload mirrors a Prisma model, reuse `@prisma-gen/zod` with `.pick()`/`.omit()` (dtos.md rule 3) instead of hand-writing the schema.
3. **Targeting** — which port method fits?
   - `sendToUser` / `sendToUsers` — specific user(s) by `wsCode`.
   - `broadcastToRoles` — every client holding one of the given `RoleName`s.
   - `broadcastAll` — every connected client.
4. **Call site** — which existing service publishes, and from which method.

## 2. Scaffold

### 2a. Event name — `src/websocket/events/Events.ts`

Never inline an event string anywhere else:

```ts
/** <one-line: when this is pushed> */
<FEATURE>_<ACTION>: "<domain>/<action>",
```

### 2b. Payload DTO — `src/websocket/dtos/<Feature><Action>PayloadDTO.ts`

```ts
import { z } from "zod";

/** Payload of `Events.<FEATURE>_<ACTION>`, pushed when <...>. */
export const <Feature><Action>PayloadSchema = z.object({
    // payload fields from §1.2 — reuse @prisma-gen/zod schemas where they mirror a model
});

export type <Feature><Action>PayloadDTO = z.infer<typeof <Feature><Action>PayloadSchema>;
```

Outbound payloads are NOT runtime-validated by the publisher (websocket.md rule 6) — the schema is the typed contract for the frontend and for tests.

### 2c. Publisher wiring (call site)

Inject `WsPublisherService` into the service named in §1.4 — constructor injection only, usage stays `EventPublisher`-shaped (websocket.md rule 3):

```ts
import { WsPublisherService } from "@websocket/publisher/WsPublisherService";
import { Events } from "@websocket/events/Events";
import { <Feature><Action>PayloadDTO } from "@websocket/dtos/<Feature><Action>PayloadDTO";

constructor(
    // ...existing deps...
    private readonly eventPublisher: WsPublisherService,
) {}
```

```ts
// TODO: call from the business method that triggers the update
const payload: <Feature><Action>PayloadDTO = { /* ... */ };
await this.eventPublisher.<targetingMethod>(<targets>, Events.<FEATURE>_<ACTION>, payload);
```

The envelope (`messageId`, `timestamp`, `source`, `event`) is built by the infrastructure — **never** call `buildEventEnvelope`/`serializeEventEnvelope` from business code, and never touch `getWebSocketServer()` outside `publisher/`.

### 2d. Tell the user the frontend contract

Echo the exact frame the frontend will receive, so the FE team can wire it:

```json
{ "messageId": "<uuid>", "timestamp": "<iso>", "source": "backoffice", "event": "<domain>/<action>", "payload": { ... } }
```

## 3. Offer the integration test (ask — never automatic)

After the scaffold, **stop and ask**:

> Want an integration test over a real socket too? (mirrors `test/websocket/WsPublisher.test.ts`, requires `yarn docker-test:up` for the test DB)

If yes → Read `.claude/rules/testing.md` and `test/websocket/WsPublisher.test.ts`, then add a test under `test/websocket/` reusing its patterns: WSS on a dedicated `http.Server` with an ephemeral port **inside the test file** (the global test app's WSS singleton lives in a different Jest module registry), seeded users given a known `wsCode`, real `ws` clients, `frameQueue` helper. No mocks.

**Exception:** if this skill was invoked by an orchestrator that already collected this answer, proceed without re-asking.

## 4. Hard checks

- [ ] Every event string lives in `Events` — none inlined.
- [ ] No `src/websocket/index.ts` was created (websocket.md rule 2).
- [ ] Business code touches only the port surface: `getWebSocketServer()` and the `ws` library appear nowhere outside `server/` and `publisher/`.
- [ ] No envelope built by hand in business code.
- [ ] The payload DTO reuses `@prisma-gen/zod` where it mirrors a Prisma model.
- [ ] No business model invented (features.md) — if the feature needs one, stop and tell the user.
- [ ] Log lines follow logging.md (`[<Entity> <Layer>]: ...`).
- [ ] The frontend frame contract was echoed to the user (§2d).
- [ ] The integration test was offered (not auto-scaffolded).
