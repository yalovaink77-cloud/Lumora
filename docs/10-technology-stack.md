# Technology Stack

Version: 1.1

Status: Approved

---

# Purpose

This document defines the official technology stack for Lumora.

Technology choices should prioritize:

- long-term maintainability
- developer experience
- stability
- strong ecosystem support
- scalability

New technologies should not be introduced without documented justification.

---

# Architecture

Application Architecture:

- Modular Monolith

Deployment:

- Single backend
- Single database
- Mobile-first

Applications are executable composition layers.

Business rules belong inside packages, not inside applications.

Infrastructure must remain replaceable.

Repository structure and dependency direction are defined in:

docs/09-repository-layout.md

---

# Package Manager

pnpm

Reason:

- Fast
- Disk efficient
- Excellent workspace support

Responsibilities:

- Package management
- Workspace resolution
- Shared lockfile management

The root package manager version is pinned in the root `package.json`.

---

# Monorepo

## pnpm Workspaces

pnpm Workspaces manages workspace packages and dependency installation.

Repository structure is defined in:

docs/09-repository-layout.md

## Turborepo

Turborepo manages task orchestration and caching.

Root scripts should delegate to Turborepo for:

- build
- test
- lint
- typecheck
- dev

Turborepo task definitions live in the root `turbo.json`.

## Nx

Nx is not part of the architecture.

Adding another monorepo orchestration layer requires an ADR.

---

# Toolchain Responsibilities

Each tool has a single primary responsibility.

- **pnpm** — package management and workspace resolution
- **Turborepo** — build, test, lint, and typecheck orchestration
- **TypeScript** — static type checking and compilation
- **ESLint** — code quality rules
- **Prettier** — formatting
- **Vitest** — unit and integration tests

Shared technical packages such as config, types, and shared provide reusable building blocks.

They must not become dumping grounds for unrelated code.

---

# Language

TypeScript

Use strict mode.

Avoid `any`.

The root `tsconfig.base.json` defines shared compiler defaults for the repository.

Individual workspaces may extend the base configuration when a documented exception is required.

---

# TypeScript Strategy

The repository currently uses TypeScript 7 at the root for shared repository tooling.

NestJS 11 and its tooling may rely on the TypeScript 5.x compiler API.

The API application must not inherit an unverified compiler strategy blindly.

Before NestJS application code is introduced, `apps/api` must use a documented and verified TypeScript configuration.

If `apps/api` pins TypeScript 5.9 locally, this must be treated as an intentional package-level toolchain exception.

TypeScript 7 and NestJS are not documented here as fully compatible.

They are also not documented here as definitively incompatible.

Compatibility must be verified through:

- build
- typecheck
- application startup
- dependency injection
- smoke tests

Do not assume a green typecheck alone proves NestJS runtime behavior.

Decorator metadata and dependency injection must be validated by running the application.

---

# Backend

NestJS

Responsibilities:

- REST API
- Dependency Injection
- Validation
- Background jobs
- Authentication
- Domain composition

NestJS belongs in `apps/api`.

It composes packages.

It must not become the home of domain business rules.

---

# NestJS Installation Policy

Do not run `nest new` directly inside the existing `apps/api` directory.

NestJS must be added manually to the existing workspace package.

A temporary generated project may be used only as a reference, never copied blindly.

The following must be preserved:

- existing workspace name (`@lumora/api`)
- root lockfile
- package manager (`pnpm`)
- repository structure

Do not create a nested repository, duplicate lockfile, or standalone Nest project inside the monorepo.

---

# Module System Policy

The CommonJS versus ESM decision for `apps/api` must be explicit before NestJS setup.

**Decision:** `apps/api` uses CommonJS. The workspace package does not declare `"type": "module"`. NestJS builds with `nest build` and runs from compiled `dist/` output.

Do not silently inherit Nest defaults.

Do not retain ESM only because the placeholder package currently declares `"type": "module"`.

The final choice must be documented and verified with the build and runtime toolchain.

Module system decisions for other applications and packages may differ when justified and documented.

---

# Mobile

React Native

Framework:

Expo

Primary platform:

- iOS
- Android

Web support is optional and is excluded from the minimum authenticated MVP
shell.

Minimum authenticated shell architecture (Sprint 2.9B.0):
`docs/20-minimum-authenticated-mobile-shell-architecture-decision.md`.

Approved shell boundary:

- Primary client: `apps/mobile`
- Expo Router for minimum auth/app route groups (shell implemented in
  Sprint 2.9B.2; disclosure presentation deferred to Sprint 2.9B.3)
- Better Auth Expo integration (`@better-auth/expo@1.6.23` line) with
  `expo-secure-store` cookie/session storage
- No custom JWT/bearer client auth
- Canonical safety copy consumed from `@lumora/shared`
- Expo web not required for the minimum shell
- Native prebuild deferred unless forced by dependencies

Sprint 2.9B.1 foundation (implemented):

- Expo SDK `~57.0.8`, React `19.2.3`, React Native `0.86.0`
- `@better-auth/expo@1.6.23` on both `@lumora/auth` (server `expo()` plugin)
  and `@lumora/mobile` (client transport composition)
- `expo-secure-store@~57.0.1` with Lumora `storagePrefix`
- App scheme `lumora`
- Validated `EXPO_PUBLIC_LUMORA_API_BASE_URL`
- Trusted origins accept `lumora://` / `lumora://*` always, and `exp://` /
  `exp://**` only in development/test
- Temporary technical bootstrap screen only in 2.9B.1; replaced by Expo Router
  authenticated shell in Sprint 2.9B.2
- Device/emulator smoke not run in 2.9B.1/2.9B.2; static Expo config + Metro
  load verification completed

Sprint 2.9B.2 authenticated shell (implemented):

- Expo Router `~57.0.8` with `(auth)` / `(app)` route groups
- Registration, sign-in, session restore, Home, sign-out
- Neutral principal via cookie transport + `GET /auth/me`

Sprint 2.9B.3 disclosure presentation (implemented):

- Canonical `lumora.safety.mvp.medical-ai.v1` export from `@lumora/shared`
- `/disclosure` authenticated-entry gate (in-memory continuation only)
- `/(app)/safety` permanent Safety & Limitations route from Home

Sprint 2.10B minimum mobile Family list/create/detail (implemented):

- Routes: `/(app)/families`, `/(app)/families/create`,
  `/(app)/families/[familyId]`
- Cookie-session Family API client with DTO validation, timeout, and abort
- Process-memory Family state cleared on sign-out/principal change
- Home Families entry; Pregnancy/Child/Timeline UI still deferred

Sprint 2.11B minimum mobile Pregnancy list/create/detail (implemented):

- Nested routes under `/(app)/families/[familyId]/pregnancies…`
- Cookie-session Pregnancy API client with DTO validation, timeout, and abort
- Family-scoped process-memory Pregnancy state
- Family detail Pregnancies entry; Child/Timeline UI still deferred

Sprint 2.12B minimum mobile Child list/create/detail/displayName edit
(implemented):

- Nested routes under `/(app)/families/[familyId]/children…` including dedicated
  displayName edit route
- Cookie-session Child API client with DTO validation, timeout, and abort
- Family-scoped process-memory Child state
- Family detail Children entry; Timeline UI and Pregnancy linkage still deferred

Next gate: minimum Timeline mobile experience architecture (documentation-first)

---

# Database

PostgreSQL

Reasons:

- Reliability
- Mature ecosystem
- Excellent Prisma support

Database access belongs inside the database package.

Domain code must not depend on concrete infrastructure implementations.

---

# ORM

Prisma

Responsibilities:

- Schema
- Migrations
- Type-safe queries

Prisma schema and migrations live in `packages/database/prisma/`.

The `@lumora/database` package is the only database access layer.

Applications must not define duplicate Prisma configuration.

Environment loading:

- `apps/api/.env` is loaded by Nest `ConfigModule` for application startup.
- Prisma CLI commands run from `packages/database` and read `process.env` from that
  package context. Provide `DATABASE_URL` either by exporting it in the shell or by
  creating `packages/database/.env`.
- Nest `ConfigModule` does not load environment variables for standalone Prisma CLI
  commands.

---

# Authentication

Better Auth

Status: **Approved** — see `docs/12-authentication-architecture-decision.md`.

Strategy:

- **Session-based authentication** is the default; server-managed sessions, not a custom JWT system.
- **Better Auth** owns credential hashing and session protocol where applicable.
- **NestJS** (`apps/api`) owns integration, guards, principal resolution, and authorization boundaries.
- **Persistence** flows through `@lumora/database` (Prisma schema and migrations in `packages/database`).
- **Custom JWT authentication systems are not approved** as Lumora's primary auth foundation.

Verified email ownership is approved in
`docs/18-verified-email-ownership-architecture-decision.md` and implemented in
Sprint 2.8A.2. Social login, passkeys, MFA, password-reset delivery, and
public-launch rate-limit deployment remain deferred until separately documented.

Implementation (Sprint 2.3B):

- Package: `better-auth@1.6.23`
- Runtime owner: `@lumora/auth`
- NestJS integration: local adapter in `apps/api/src/auth` (Better Auth is ESM-only; the API remains CommonJS and loads auth through dynamic imports)
- Route prefix: `/api/auth`
- Protected application endpoint: `GET /auth/me`
- Session strategy: server-managed database sessions through Better Auth; no custom JWT foundation
- Mobile transport unlock (Sprint 2.9B.1): `@better-auth/expo@1.6.23` server
  plugin `expo()` plus trusted app-scheme origins (`lumora://`, development-only
  `exp://` patterns)
- Persistence: Better Auth models in `packages/database/prisma/schema.prisma` accessed only through `@lumora/database`
- PostgreSQL runtime verification: `pnpm test:auth:postgres` builds the repository,
  starts an isolated disposable PostgreSQL 16 container, applies the existing
  migrations, verifies the complete cookie-session lifecycle, and removes the
  container
- Response safety: Better Auth session cookies remain the HTTP-only transport while
  raw token fields are removed from JSON response bodies
- Custom JWT authentication systems are not approved

Implemented verified-email architecture (Sprint 2.8A.2):

- Better Auth 1.6.23 remains the verification-token issuer and verifier
- Authenticated Lumora resend and confirmation facades bind verification to the
  matching neutral principal; raw Better Auth verification and resend routes
  are not externally exposed
- Verification delivery composes through a provider-neutral port; no commercial
  provider is selected
- Production must fail closed without a production-capable delivery adapter
- Canonical email uses Better Auth's installed syntax validation followed only
  by complete-address lowercase conversion
- `POST /auth/email-verification/request` and
  `POST /auth/email-verification/confirm` are the only application verification
  facades
- The neutral principal is `{ id, email, emailVerified, name }`
- Unverified Users retain sign-in and existing private-feature access
- Security-sensitive consumers may require trusted `emailVerified`
- The neutral principal is `id`, canonical `email`, `emailVerified`, and
  `name`; it contains no Family role or permission
- Existing `User.emailVerified` is authoritative; the built-in stateless
  verification link requires no Prisma migration
- Sprint 2.8B Family invitation acceptance consumes this verified-email
  assurance without placing Family roles in authentication sessions

Responsibilities:

- Authentication
- Sessions
- Identity

Authorization belongs to the domain.

Authentication integration belongs inside the auth package.

---

# Family Foundation

Implementation (Sprint 2.4B, extended by Sprint 2.8B):

- Domain and application contracts: `@lumora/family`
- Module format: CommonJS, matching the NestJS API and database adapter that
  compose the package without introducing another runtime module bridge
- Persistence adapter: `PrismaFamilyRepository` in `@lumora/database`
- API composition: `apps/api/src/family`
- Endpoints: `POST /families`, `GET /families`,
  `GET /families/:familyId`, `POST /families/:familyId/invitations`, and
  `POST /family-invitations/accept`
- Authorization: neutral authenticated User identifier plus database-backed
  FamilyMembership scope; Family identifiers alone do not grant access
- Roles: exactly `OWNER` and `MEMBER`; exactly one OWNER per Family
- Creation: Family and initial `OWNER` membership are committed in one Prisma
  transaction
- MEMBER entry: OWNER-created invitation with digest-only secret storage and
  authenticated verified-email acceptance
- PostgreSQL verification: `pnpm test:family:postgres` builds the repository,
  deploys all migrations to disposable PostgreSQL 16, runs the existing
  authentication lifecycle, verifies Family persistence, invitation entry, and
  HTTP isolation, and removes the container

The package and persistence boundaries are defined in
`docs/13-family-domain-architecture-decision.md` and
`docs/17-family-roles-and-membership-entry-architecture-decision.md`.

---

# Pregnancy Foundation

Implementation (Sprint 2.5B):

- Domain and application contracts: `@lumora/pregnancy`
- Module format: CommonJS, matching the API and database composition boundary
- Validation: strict Zod parsing with trimming and a 100 Unicode-code-point
  maximum
- Persistence adapter: `PrismaPregnancyRepository` in `@lumora/database`
- API composition: `apps/api/src/pregnancy`
- Endpoints: `POST /families/:familyId/pregnancies`,
  `GET /families/:familyId/pregnancies`, and
  `GET /families/:familyId/pregnancies/:pregnancyId`
- Authorization: neutral authenticated User identifier plus persisted
  FamilyMembership scope on every persistence operation
- Creation race safety: membership authorization and Pregnancy persistence run
  in one serializable Prisma transaction
- PostgreSQL verification: `pnpm test:pregnancy:postgres` builds the repository,
  validates and deploys all migrations to disposable PostgreSQL 16, and runs
  authentication, Family, and Pregnancy runtime verification before removing
  the container

The package, persistence, privacy, and medical-safety boundaries are defined in
`docs/14-pregnancy-domain-architecture-decision.md`.

---

# Child Foundation

Implementation (Sprint 2.6B):

- Domain and application contracts: `@lumora/child`
- Module format: CommonJS, matching the API and database composition boundary
- Validation: strict Zod parsing with trimming and an 80 Unicode-code-point
  maximum
- Persistence adapter: `PrismaChildRepository` in `@lumora/database`
- API composition: `apps/api/src/child`
- Endpoints: `POST /families/:familyId/children`,
  `GET /families/:familyId/children`, and
  `GET /families/:familyId/children/:childId`
- Mutation (Sprint 2.6D):
  `PATCH /families/:familyId/children/:childId` changes only normalized
  `displayName` and system-managed `updatedAt`
- Authorization: neutral authenticated User identifier plus persisted
  FamilyMembership scope on every persistence operation
- Creation race safety: membership authorization and Child persistence run in
  one serializable Prisma transaction
- Mutation race safety: membership-scoped lookup and update run in one
  serializable Prisma transaction with bounded write-conflict retries
- Privacy: `displayName` remains heightened-privacy Child data and responses are
  limited to the minimum Child representation
- PostgreSQL verification: `pnpm test:child:postgres` builds the repository,
  validates and deploys all migrations to disposable PostgreSQL 16, and runs
  authentication, Family, Pregnancy, and Child runtime verification before
  removing the container

The package, persistence, privacy, and lifelong-continuity boundaries are
defined in `docs/15-child-domain-architecture-decision.md`. The minimum mobile
Child list/create/detail/displayName-edit experience is implemented in
Sprint 2.12B per
`docs/23-minimum-mobile-child-experience-architecture-decision.md`.

---

# Timeline Foundation

Implementation (Sprint 2.7B):

- Domain and application contracts: `@lumora/timeline`
- Module format: CommonJS, matching the API and database composition boundary
- Validation: strict Zod parsing with trimmed 1–80-code-point titles and the
  approved millisecond RFC 3339 timestamp profile
- Persistence adapter: `PrismaTimelineRepository` in `@lumora/database`
- Persistence integrity: one `timeline_event` model, a database exactly-one
  subject check, composite same-Family Pregnancy and Child foreign keys,
  restrictive deletion, and timezone-aware millisecond occurrence timestamps
- API composition: `apps/api/src/timeline`
- Endpoints: subject-specific nested POST create, GET chronological list, and
  GET direct-get routes for Pregnancy and Child
- Ordering: `occurredAt DESC`, `createdAt DESC`, then `id DESC`
- Authorization: neutral authenticated User identifier plus persisted
  FamilyMembership, Family, and subject scope on every operation
- Creation race safety: membership authorization, subject ownership, and event
  persistence run in one serializable Prisma transaction
- Privacy: responses contain only the minimum subject-specific representation;
  Timeline content remains outside routine logs and authentication state
- PostgreSQL verification: `pnpm test:timeline:postgres` builds the repository,
  validates and deploys all migrations to disposable PostgreSQL 16, and runs
  Authentication, Family, Pregnancy, Child, and Timeline runtime verification
  before removing the container

The package, persistence, chronology, privacy, and medical-safety boundaries are
defined in `docs/16-timeline-domain-architecture-decision.md`.

---

# MVP Medical Safety and AI Disclosure

Decision (Sprint 2.9A):
`docs/19-mvp-medical-safety-and-ai-disclaimer-architecture-decision.md`.

Approved boundary:

- One product-owned English canonical disclosure with content identifier
  `lumora.safety.mvp.medical-ai.v1`
- Audience: every authenticated user; identical for OWNER and MEMBER
- Surfaces: first authenticated application entry, plus a permanent
  Safety & Limitations location
- No acknowledgment, consent history, database field, table, or migration
- No REST endpoint is required for the static MVP disclosure
- Future presentation may export the canonical copy from `@lumora/shared`
- Presentation ownership belongs to the primary user-facing client
  (`apps/mobile`)

Current verified application state:

- `apps/api` is not a user-facing disclosure surface
- `apps/mobile` presents ADR-019 disclosure surfaces on the authenticated shell
- Shell architecture is approved in
  `docs/20-minimum-authenticated-mobile-shell-architecture-decision.md`
- Sprint 2.9B.1–2.9B.3 authenticated shell + disclosure presentation is
  implemented
- Sprint 2.10B minimum mobile Family list/create/detail is implemented
- Sprint 2.11B minimum mobile Pregnancy list/create/detail is implemented
- Sprint 2.12B minimum mobile Child list/create/detail/displayName edit is
  implemented per
  `docs/23-minimum-mobile-child-experience-architecture-decision.md`
- Canonical safety copy is owned by `@lumora/shared`

---

# API

REST

GraphQL is intentionally out of scope.

---

# Validation

Zod

Use shared schemas whenever practical.

Shared validation schemas may live in types or domain packages as appropriate.

They must not be placed in shared as unrelated utilities.

---

# Background Jobs

BullMQ

Redis-backed queues.

---

# Cache

Redis

Used for:

- queues
- caching
- rate limiting

---

# File Storage

S3-compatible object storage.

Provider should remain configurable.

---

# AI

AI providers are replaceable.

Supported architecture:

- OpenAI
- Anthropic
- Google
- OpenRouter

AI integrations belong inside the AI package.

Current MVP status:

- No user-facing AI feature is implemented.
- The reserved `packages/ai` layout location does not enable AI product
  behavior.
- The approved MVP disclosure must not imply current AI processing or act as
  consent for future AI training. See
  `docs/19-mvp-medical-safety-and-ai-disclaimer-architecture-decision.md`.

---

# Testing

Vitest

Use:

- Unit tests
- Integration tests

---

# Code Quality

ESLint

Prettier

EditorConfig

---

# Containerization

Docker

Docker Compose

Local development should be reproducible.

---

# CI/CD

GitHub Actions

Responsibilities:

- lint
- typecheck
- tests
- build

---

# Dependency Rules

Applications depend on packages.

Packages must not depend on applications.

Business rules belong inside domain packages.

Infrastructure should remain replaceable.

Dependency direction must follow docs/09-repository-layout.md.

## Dependency Placement

Runtime dependencies belong in the workspace that uses them.

Root `devDependencies` are reserved for shared repository tooling.

Internal packages use the `workspace:*` protocol.

The root package must not become an application dependency container.

Applications may depend on packages.

Domain packages may depend on shared domain abstractions.

Infrastructure adapters may depend on domain contracts.

Shared must not depend on domain-specific packages.

---

# API Foundation Verification Gates

The API foundation is not complete until all of the following pass:

1. Install succeeds without unresolved dependency conflicts.
2. Lint passes.
3. Typecheck passes.
4. Build passes.
5. Nest application starts successfully.
6. Dependency injection resolves correctly.
7. A minimal smoke test passes.

These gates must be satisfied before domain feature work begins in `apps/api`.

---

# Future Technologies

Future technologies require documentation before adoption.

Examples:

- Event Bus
- Kafka
- GraphQL
- Microservices
- Vector Database
- Nx

These are intentionally deferred.

---

# Success Criteria

The technology stack should:

- remain simple,
- support long-term evolution,
- minimize vendor lock-in,
- maximize maintainability,
- follow the documented architecture.
