# AGENTS.md

## Project Identity

| Category | Value |
|----------|-------|
| **Name** | IOMTea |
| **Purpose** | Home health IoT monitoring platform |
| **Languages** | TypeScript (strict), Chinese documentation, bilingual code comments |
| **Monorepo** | pnpm + Turborepo |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **API Server** | Hono + Zod + OpenAPI + Drizzle ORM + PostgreSQL |
| **Web Frontend** | React 19 + Mantine v8 + TanStack Router + Zustand |
| **Mini Program** | Taro 4 (WeChat) |
| **Mobile/Edge** | Flutter (MQTT console, YOLO vision, IMU sensors) |
| **Auth** | JWT (jose) + Argon2 password hashing + refresh token rotation |
| **Real-time** | WebSocket (ws) at `/ws` with JWT auth |
| **DB Migrations** | drizzle-kit (`db:generate`, `db:migrate`, `db:push`) |
| **Lint/Format** | Biome (2-space indent, single quotes, no semicolons) |
| **CI/CD** | GitHub Actions with tag-based deploy triggers |
| **Containerization** | Docker Compose |

## Directory Map

```
apps/server/          Backend API (Hono REST + OpenAPI + Drizzle + WebSocket)
  src/core/           Core modules: DB, pipeline, auth, realtime
  src/routes/         REST API routes (12 domain modules)
  src/modules/twin/   Digital twin engine (merged sim/ + twin/)
  src/mqtt-ingest/    MQTT device data ingestion
  src/middleware/      Hono middleware (JWT auth, RBAC)
apps/web/             React 19 web dashboard (Mantine v8 + TanStack Router)
apps/miniapp/         WeChat mini program (Taro 4)
apps/flutter/         Flutter experimental tools
packages/shared-types/  Shared Zod schemas, constants, avatar spec
packages/avatar-core/   Mii avatar core library
docs/                 Architecture, code map, review reports, design specs
```

## Architecture

**Pattern**: DDD-Lite with 3 bounded contexts

| Context | Path | Responsibility |
|---------|------|---------------|
| **Core** | `apps/server/src/core/` | Auth, users, patients, alerts, data, RBAC |
| **Twin** | `apps/server/src/modules/twin/` | Digital twin engine, simulation, profiles, physiology |
| **MQTT-Ingest** | `apps/server/src/mqtt-ingest/` | MQTT device data ingestion |

**Communication rules**: Contexts communicate only via events table or REST API calls. Never cross-import internal modules. Shared types in `@iomtea/shared-types` only.

**REST API**: 12 route files in `routes/` using Hono + @hono/zod-openapi. Each route uses:
- `createRoute()` from `@hono/zod-openapi` with request/response schemas
- `jwtAuth` middleware from `middleware/auth.ts` for authenticated routes
- `requirePermission('resource:action')` from `middleware/rbac.ts` for RBAC
- OpenAPI spec auto-generated from route schemas → `openapi.json` → TypeScript client types

**RBAC**: Permission-based via `middleware/rbac.ts`. Roles: super_admin, admin, user. Permissions: `patient:read|write|delete`, `alert:read|manage`, `dashboard:view`, etc.

## Key Conventions

- **File size**: ≤200 lines per file, function-first design (no classes for stateless logic)
- **Router naming**: kebab-case files (`alert-rule.ts`), camelCase procedures (`alertRule.byPatient`)
- **Enums**: Defined in `apps/server/src/core/db/schema/enums.ts` with matching TS type exports
- **Schemas**: Zod validation schemas in `packages/shared-types/src/schemas/`
- **Imports**: No `as any` — use proper type helpers. No `any` in new code.
- **Error handling**: Return proper HTTP status codes, log errors via `createChildLogger`
- **Formatting**: Biome (2-space indent, single quotes, no semicolons, trailing commas)
- **DB access**: Direct Drizzle queries via `ctx.db`, no Repository interfaces
- **Git**: Chinese commit messages, feat/fix/refactor convention

## Build Commands

```bash
pnpm dev            # Start all apps in dev mode
pnpm build          # Build all apps
pnpm typecheck      # Type-check all packages
pnpm lint           # Lint all packages
pnpm test           # Run all tests

# Per-app
pnpm dev --filter @iomtea/server
pnpm dev --filter @iomtea/web

# Database
cd apps/server && pnpm db:generate   # Generate migration from schema changes
cd apps/server && pnpm db:migrate    # Apply migrations
cd apps/server && pnpm db:push       # Push schema directly (dev only)
```

## Database

**Engine**: PostgreSQL via Drizzle ORM. Schema is the single source of truth.

**Current tables (4 core + auxiliary)**:
- `users` (id, username, passwordHash, role, credit, ...)
- `refresh_tokens` (userId FK, tokenHash, expiresAt)
- `patients` (name, birthDate, gender, tags — **no** userId field)
- `events` (patientId FK, pinCode FK, kind, metric, value, tags — **no** deviceId field)
- `users_pin` (PIN-based device identity, replaces deleted devices table)
- `user_patient_links` (many-to-many user↔patient with relation type)
- `medications`, `adherence_records`, `plans`, `checklists`, `credit_transactions`, etc.

**Important**: The `devices` table was deleted (2026-05-24). PINs (`users_pin`) now serve as de facto device identifiers with `pin_type` enum: device, virtual, user, simulator.

## Auth

- **JWT**: Signed with `jose` library. Access token in `Authorization: Bearer <token>` header.
- **Password**: Argon2 hashing via `@node-rs/argon2`.
- **Refresh tokens**: Rotated on use (insert new, then delete old — atomic rotation). Refreshed proactively before expiry on web client.
- **RBAC**: `requirePermission` middleware checks user's role permissions. Cached per request context.
- **WebSocket**: Token required as `?token=` query parameter. Invalid tokens receive 4001 close code.

## Real-time

WebSocket server at `/ws`. Subscription model: ward, map, patient. Broadcast manager in `core/realtime/broadcast.ts`. Client hook: `web/src/hooks/useRealtime.ts`.

## CI/CD

Triggers on tag pushes only. Three workflows:
- `deploy-server.yml` — Builds Docker image, pushes to registry, deploys server
- `deploy-web.yml` — Builds web app, deploys static assets
- `flutter.yml` — Builds Flutter APK

## Important Notes

- **No more devices table**: PINs with `pin_type` enum are the device/subject identifier for events.
- **Digital twin is in-memory only**: `twin/engine.ts` uses module-level Maps. Server restart = all simulations lost.
- **Credit gamification**: Users earn credits via streaks, transactions tracked in `credit_transactions` table.
- **Two simulation engines**: `twin/` (original) and `sim/` (next-gen). Both active in `_app.ts`.
- **No Error Boundary yet**: Frontend uses `StateComponents.tsx` + `QueryGate.tsx` for loading/error/empty states, but no React Error Boundary.
- **File-based routing**: Web app migrated from pages/ to TanStack Router `routes/` directory.
- **No appointments module**: Removed 2026-05. Replacement planned as plan/checklist sub-module.
