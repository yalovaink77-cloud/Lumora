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

Web support is optional.

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

Advanced authentication features — social login, passkeys, MFA, password reset delivery, email verification, roles, and public-launch rate limiting — remain deferred until separately documented.

Implementation (Sprint 2.3B):

- Package: `better-auth@1.6.23`
- Runtime owner: `@lumora/auth`
- NestJS integration: local adapter in `apps/api/src/auth` (Better Auth is ESM-only; the API remains CommonJS and loads auth through dynamic imports)
- Route prefix: `/api/auth`
- Protected application endpoint: `GET /auth/me`
- Session strategy: server-managed database sessions through Better Auth; no custom JWT foundation
- Persistence: Better Auth models in `packages/database/prisma/schema.prisma` accessed only through `@lumora/database`
- PostgreSQL runtime verification: `pnpm test:auth:postgres` builds the repository,
  starts an isolated disposable PostgreSQL 16 container, applies the existing
  migrations, verifies the complete cookie-session lifecycle, and removes the
  container
- Response safety: Better Auth session cookies remain the HTTP-only transport while
  raw token fields are removed from JSON response bodies
- Custom JWT authentication systems are not approved

Responsibilities:

- Authentication
- Sessions
- Identity

Authorization belongs to the domain.

Authentication integration belongs inside the auth package.

---

# Family Foundation

Implementation (Sprint 2.4B):

- Domain and application contracts: `@lumora/family`
- Module format: CommonJS, matching the NestJS API and database adapter that
  compose the package without introducing another runtime module bridge
- Persistence adapter: `PrismaFamilyRepository` in `@lumora/database`
- API composition: `apps/api/src/family`
- Endpoints: `POST /families`, `GET /families`, and
  `GET /families/:familyId`
- Authorization: neutral authenticated User identifier plus database-backed
  FamilyMembership scope; Family identifiers alone do not grant access
- Creation: Family and initial `OWNER` membership are committed in one Prisma
  transaction
- PostgreSQL verification: `pnpm test:family:postgres` builds the repository,
  deploys all migrations to disposable PostgreSQL 16, runs the existing
  authentication lifecycle, verifies Family persistence and HTTP isolation,
  and removes the container

The package and persistence boundaries are defined in
`docs/13-family-domain-architecture-decision.md`.

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
defined in `docs/15-child-domain-architecture-decision.md`.

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
