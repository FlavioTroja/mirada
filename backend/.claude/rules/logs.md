# Logging output

1. **Always add logs when writing code** — every controller / service / repository / handler method that does meaningful work must log what it does.
2. The standard output must be **reconstructable**: reading the logs alone, a human *or* an AI can replay what the code did and in what order.
3. Use the logger (`Log` from `@utils/adapters/log`) and the **exact string format** defined in `logging.md` — `[<Entity> <Layer>]: <concise English text with name/id references>`. That file is the single source of truth for how to log.
