---
name: new-resource
description: Scaffold a new entity end-to-end by orchestrating new-prisma-model → new-repository → new-dto → new-service → new-controller. Use when the user asks to add a whole new resource / feature / entity to the backend (model + repo + DTOs + service + controller in one go).
---

# new-resource — orchestrate a full entity scaffold

Use this skill when the user asks to add a brand-new resource to the backend and wants the whole stack scaffolded in one pass. This skill is **purely a conductor** — it does not write any code itself. It chains the five focused skills in the canonical project order:

```
new-prisma-model  →  new-repository  →  new-dto  →  new-service  →  new-controller
```

Each sub-skill is the source of truth for its layer. **Do not duplicate or override any of their rules here.** If a sub-skill asks a clarifying question, let it ask — do not pre-answer on its behalf unless the user already gave you the information up front.

Each sub-skill opens with its own §0 "Read the rules" block. This skill does not need to Read any `.claude/rules/*.md` file directly — the sub-skills pull in what they need as they run.

## 0. Confirm scope and gather shared context (one round)

Ask the user once, before invoking any sub-skill:

1. **Entity name** in singular PascalCase (`Booking`).
2. **Plural feature slug** for the route base and DTO folder (`bookings`, `people`, `audit_logs`). Default to the simple plural; let the user override.
3. **Which layers to scaffold.** Default is "all five". Let the user opt out of any layer up front (e.g. "skip the controller, I'll write it by hand"). Record the picked subset.
4. **Starting point.** Ask whether the Prisma model already exists:
   - **No, fresh entity** → start from `new-prisma-model`.
   - **Yes, model exists** → start from `new-repository` (or whichever later layer is the first missing one — quickly check `src/stack/repositories/`, `src/stack/DTOs/<slug>/`, `src/stack/services/`, `src/stack/controllers/` to find the first gap and propose starting there).

Echo the plan back to the user as a numbered checklist before running anything:

```
Plan for <Feature>:
  1. new-prisma-model    (model + migration)
  2. new-repository      (<Feature>Repository)
  3. new-dto             (Create / Update / Query / Response under src/stack/DTOs/<slug>/)
  4. new-service         (<Feature>Service)
  5. new-controller      (<Feature>Controller + server.ts registration)
```

Get a "go" before invoking the first sub-skill.

## 1. Run the chain

Invoke the sub-skills **one at a time, in the order above**, only for the layers picked in §0.3 and starting from the layer chosen in §0.4. For each step:

1. **Hand off cleanly.** When you invoke a sub-skill, pass it the entity name, plural slug, and any state from earlier steps that it needs (most importantly: the **relation tracker** produced by `new-prisma-model` §0b — `new-dto` and `new-service` both rely on knowing which fields are FKs and whether `Create` is cascading).
2. **Let the sub-skill ask its own questions.** Don't shortcut its clarification rounds — they exist because each layer has its own decisions (unique finders, cascading creates, transaction wrapping, permission wiring, etc.).
3. **Wait for the sub-skill to finish before moving on.** Each sub-skill ends with its own "chain into the next" prompt — when invoked from `new-resource`, the answer is already "yes" (per the user's plan in §0), so accept and continue.
4. **If a sub-skill stops** (e.g. `new-prisma-model` hands off the migration command and waits for the user to run it) → wait. Do not skip ahead. The next layer often depends on freshly generated artifacts (`@prisma-gen/zod`, the Prisma client types) and will fail or hand-write things it shouldn't if you race past.
5. **If a step fails or the user aborts it** → stop the chain. Tell the user which layers were completed, which is pending, and how to resume (`/skill new-<layer>` later, or re-run `new-resource` and pick the resume point in §0.4).

