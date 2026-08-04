# Project layout

```
src/
├── stack/                ← domain layers (repository → controller)
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── DTOs/<feature>/
│   ├── transformers/
│   ├── enums/
│   └── interfaces/
├── websocket/            ← frontend push infrastructure (see websocket.md)
├── middleware/           ← cross-cutting (auth, permissions)
├── utils/
│   ├── helpers/          ← pure helpers, no I/O (exz, crypto, mergeEntities, schemaTransformers, query, zod, …)
│   └── adapters/         ← infra / I/O / state (prisma, log, winston, env, fetch, requestContext, upload, permission, cron/, decorators/)
└── main.ts / server.ts
```

1. The **domain stack** (`controllers`, `services`, `repositories`, `DTOs`, `transformers`, `enums`, `interfaces`) lives under `src/stack/`. Cross-cutting infrastructure (`websocket/`, `middleware/`, `utils/`) stays at the `src/` root.
2. **`utils/` is split in two:** `utils/helpers/` for pure, framework-agnostic helpers (no I/O), and `utils/adapters/` for infrastructure with I/O or state. Import with the full subpath — `@utils/helpers/exz`, `@utils/adapters/prisma`, `@utils/adapters/log`. A new util goes in `helpers/` only if it has no I/O and no singleton state; otherwise `adapters/`.
3. Path aliases (`package.json` `_moduleAliases` + `tsconfig.json`): `@controllers`, `@services`, `@repositories`, `@DTOs`, `@transformers`, `@enums` resolve under `stack/`; `@middleware`, `@utils`, `@websocket`, `@prisma-gen` (→ `prisma/generated`) at the root. The `@utils` alias still points at `utils/`, so the `helpers/`·`adapters/` split lives in the import subpath, not in config. Always use the alias, never a relative path that crosses layers.
4. Layering is **Controller → Service → Repository**. Never bypass a layer.
