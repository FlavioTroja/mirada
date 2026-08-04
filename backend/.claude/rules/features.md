# Features

This backend ships a **foundation** to build your business domain on top of. Out of the box it implements **User CRUD** and the auth/identity entities it depends on (Person, Address, Contact, Role, Permission) — treat them as the reference for how a feature is layered (Controller → Service → Repository → DTOs → transformers).

The backend also owns a few **infrastructure entities** — ops/monitoring tooling, NOT business domain. Never use them to model business concepts:

- **Log** — audit log / notifications (`/logs`), written by the `@AuditLog` aspect.
- **Cron entrypoints** — `CronController` (`/cron/<job-action>`) exposes one POST route per scheduled job for manual triggering.

Add your own business models, services, and endpoints freely — that is what this project is for. Follow the layering and conventions in the other rule files, and keep the infrastructure entities above out of your business modelling.

