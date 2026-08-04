---
name: edit-websocket-feature
description: Guided modification of an existing WebSocket push event — payload DTO changes, event renames, targeting changes, or removal — keeping every touchpoint (Events, DTOs, publisher call sites, tests, frontend contract) consistent. Use when the user asks to change, extend, rename, or remove an existing WebSocket event. Not for brand-new events (use new-websocket-feature) and not for MQTT (use edit-mqtt-feature).
---

# edit-websocket-feature — modify an existing WebSocket push event

Applies a change to one existing push event **consistently across all of its touchpoints**. The most common failure mode this skill prevents: editing the payload DTO but forgetting a publisher call site, the test fixture, or the frontend that parses the frame.

**Scope**: one event at a time. The infrastructure (`server/WebSocketServer.ts`, `WsClient`, the envelope, `ports/EventPublisher`, `publisher/WsPublisherService`) is NOT a "feature" — changing it is an architecture task, not this skill.

## 0. Read the rules

Before anything else, Read these files in full — they are not auto-loaded into context:

- `.claude/rules/naming.md` — file / class naming
- `.claude/rules/testing.md` — only if tests are touched in §4

`.claude/rules/websocket.md` is already in context via CLAUDE.md — every numbered rule applies.

Do not proceed until the Reads are done.

## 1. Map the touchpoints (before asking anything else)

1. Identify the event's key in `src/websocket/events/Events.ts`.
2. Grep for every usage: `grep -rn "Events.<KEY>" src/ test/` and `grep -rn "<Feature><Action>Payload" src/ test/`.
3. Build the **touchpoint map** and echo it back to the user:

```
Event: <domain>/<action>
  - Events key:      Events.<KEY>
  - Payload DTO:     src/websocket/dtos/<...>PayloadDTO.ts
  - Publish sites:   <service files calling eventPublisher.*(..., Events.<KEY>, ...)>
  - Tests:           test/websocket/<...>.test.ts
  - Frontend:        parses this frame (wire contract — out of this repo)
```

**Do not proceed until the user confirms the map is the event they mean.**

## 2. Clarify (ask in one round)

1. **What changes?** — payload fields / event name / targeting method / full removal.
2. **For payload or event-name changes**: is the frontend updated in lockstep, or must the change be backward compatible during a transition?

## 3. Contract-compatibility gate (MUST run before any edit)

The event name and payload shape are a **wire contract with the frontend**. A frontend deploy usually ships together with the backend, so breakage is more tolerable than the MQTT device fleet — but never silent.

- **Safe**: adding an *optional* field; handler-side (service) logic changes that keep the frame identical.
- **BREAKING**: adding a required field the FE validates; removing or renaming a field; changing a field's type; renaming the event.

For every breaking change, warn the user explicitly *before editing* and confirm the frontend will be adapted (or propose a transition: push both events / keep the old field alongside the new one and retire it later).

## 4. Apply the change — canonical order

Apply edits in this order so nothing is orphaned, re-checking each touchpoint from the §1 map:

1. `Events` — key / event string.
2. Payload DTO in `src/websocket/dtos/`.
3. Publisher call sites — every service building the payload (and the targeting method, if it changes).
4. Tests under `test/websocket/` — a DTO change almost always implies the fixture changes too.
5. Echo the new frame contract to the user for the frontend team.

Constraints, same as `new-websocket-feature`: event strings only in `Events`; no `src/websocket/index.ts`; envelope handled by infra; business code never touches `getWebSocketServer()` or the `ws` library.

## 5. Removal path

When the change is "delete this event":

1. Remove the publisher call site(s) from the owning service(s).
2. Delete the payload DTO file, the `Events` key, and the event's test assertions.
3. Grep for orphan imports of the deleted symbols (`grep -rn "<Feature><Action>" src/ test/`).
4. Remind the user the frontend listener for the old event can be removed too.

## 6. Hard checks

- [ ] The touchpoint map from §1 was echoed and confirmed before editing.
- [ ] For any wire-contract change, the compatibility warning (§3) was shown first.
- [ ] Every touchpoint in the map was either updated or explicitly confirmed unaffected.
- [ ] No orphans: no unused `Events` keys, DTOs, or imports left behind.
- [ ] Event strings only in `Events`; no `src/websocket/index.ts`; envelope and infrastructure untouched.
- [ ] `yarn build` passes; if socket tests exist for the event, `yarn test` passes (`yarn docker-test:up` first).
