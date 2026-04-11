# Technical Diagrams

| # | File | Description |
|---|------|-------------|
| 1 | [system-overview.mmd](./system-overview.mmd) | Full system architecture: Client to Gateway to Modules to Database |
| 2 | [auth-flow.mmd](./auth-flow.mmd) | Auth sequence: Register, Login Local and Google, Refresh Token |
| 3 | [booking-flow.mmd](./booking-flow.mmd) | Booking technical: Slot check, hold, create, confirm, payment webhook |
| 4 | [tenant-context-flow.mmd](./tenant-context-flow.mmd) | Multi-tenant request: JWT Guard, TenantContext Interceptor, Controller |
| 5 | [notification-queue-flow.mmd](./notification-queue-flow.mmd) | BullMQ notification pipeline with retry logic |
| 6 | [cron-jobs-flow.mmd](./cron-jobs-flow.mmd) | Scheduled cleanup and reminder jobs |
| 7 | [database-er-diagram.mmd](./database-er-diagram.mmd) | Entity relationships for all 15 Prisma models |
| 8 | [security-layers.mmd](./security-layers.mmd) | 5-layer security architecture |
