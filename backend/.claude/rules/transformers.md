# Transformers — `src/stack/transformers/*Transformer.ts`

1. Pure classes with a `transform(dto)` method. No I/O, no async, no Prisma calls.
2. Used by services *before* calling repositories, to keep service bodies readable.
3. Map a DTO to the Prisma input shape that a repository expects.
