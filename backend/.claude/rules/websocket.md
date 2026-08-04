# WebSocket push — `src/websocket/`

Use this for any feature that pushes live updates from the backend to the frontend.
OUTBOUND ONLY (backend → frontend): no acks, no inbound handling. Business logic stays
decoupled from the `ws` library (ports & adapters, mirror of mqtt.md).

## Where the code lives
1. ALL WebSocket code lives under `src/websocket/`, split by responsibility — never put
   WebSocket code in `@utils`, `@services`, or `@DTOs`:
   - `server/WebSocketServer.ts` — WSS singleton attached to the HTTP server
     (`initializeWebSocketServer` / `getWebSocketServer` / `closeWebSocketServer`),
     connection auth via `wsCode` (last URL path segment → user lookup), 60s heartbeat.
   - `server/WsClient.ts` — the connected-socket type (`isAlive`, `code`, `roles`).
   - `events/Events.ts` — event-name constants (`<domain>/<action>`) + `EventName` type.
   - `envelope/Envelope.ts` — `buildEventEnvelope` / `serializeEventEnvelope`.
   - `dtos/` — `EventEnvelope` Zod schema + one payload DTO per event.
   - `ports/EventPublisher.ts` — outbound abstraction business code depends on.
   - `publisher/WsPublisherService.ts` — `@Service()` adapter (the only place besides
     `server/` that touches the `ws` library).
2. Import via the `@websocket/*` alias with the FULL subpath
   (e.g. `@websocket/events/Events`). NEVER create `src/websocket/index.ts` (no barrel —
   same rule as mqtt). NEVER name a folder `src/ws/`: under `baseUrl=src` it would shadow
   the npm `ws` package.

## Decoupling (ports & adapters)
3. Business services inject `WsPublisherService` (typed through `EventPublisher`) and call
   `sendToUser` / `sendToUsers` (by `wsCode`), `broadcastAll`, or `broadcastToRoles`.
   They never touch `getWebSocketServer()` or the `ws` library.
4. Every push is wrapped in an `EventEnvelope` (`messageId`, `timestamp`, `source`,
   `event`, `payload`) and the publisher returns it, so callers can read the generated
   `messageId`. The envelope is deliberately NOT shared with `@mqtt` — the two transports
   evolve independently.

## Events
5. Keep every event name in `Events` — never inline event strings in services. Names are
   namespaced `<domain>/<action>` (e.g. `log/notification`).
6. Each event has its own payload DTO (Zod) in `@websocket/dtos/`. Outbound payloads are
   not runtime-validated (mirror of MQTT, which validates inbound only): the schemas are
   the typed contract for the frontend and for tests.

## Lifecycle
7. The WSS is initialized in `APIServer.setupWebSocketServer()` (constructor) and torn
   down via `closeWebSocketServer()` in `APIServer.stop()`. The publisher `Log.warn`s and
   drops (never throws) when the server is not initialized (e.g. unit contexts).

## Adding / changing a push feature
8. To ADD an event use the `new-websocket-feature` skill: it scaffolds the `Events` key,
   the payload DTO, the publisher call site with the right targeting method, and
   optionally the integration test. To CHANGE an existing event use the
   `edit-websocket-feature` skill: it maps every touchpoint (Events, DTO, call sites,
   tests, frontend contract) and keeps them consistent.

## Testing
9. WebSocket tests run against a REAL socket — no mocks: attach the WSS to a dedicated
   `http.Server` on an ephemeral port inside the test file (the global test app lives in
   a different Jest module registry, so its WSS singleton is not visible to test code),
   give seeded users a known `wsCode`, connect real `ws` clients and assert frames on the
   wire. Mirror `test/websocket/WsPublisher.test.ts`.
