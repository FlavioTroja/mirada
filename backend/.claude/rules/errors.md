# Errors

1. Services and controllers throw from `http-errors` (`BadRequest`, `NotFound`, `Forbidden`, `InternalServerError`, …).
2. Repositories rely on `BaseRepository.exec` to translate Prisma errors via `mapPrismaErrorToHttpError`.
3. Fastify's default error handling reports the thrown HTTP error to the client. Controllers do not catch and re-shape unless there is a specific reason.
