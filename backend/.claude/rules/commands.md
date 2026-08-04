# Useful commands

| Task | Command |
| --- | --- |
| Dev (watch + restart) | `yarn dev` |
| Build | `yarn build` |
| Start test DB (docker) | `yarn docker-test:up` |
| Stop test DB | `yarn docker-test:down` |
| Run tests | `yarn test` (requires test DB up + `.env.test`) |
| Apply migrations (dev) | `yarn prisma migrate dev` |
| Apply migrations (prod) | `yarn prisma migrate deploy` |
| Regenerate Prisma client | `yarn prisma generate` |
