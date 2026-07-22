# Repository Layout

Version: 1.1

Status: Approved

---

# Purpose

This document defines the physical structure of the Lumora repository.

The repository structure must support:

- modular development
- long-term maintainability
- documentation-first workflow
- clear domain boundaries
- future scalability

This document describes repository organization only.

It does not define business rules or implementation details.

---

# Repository Structure

```
lumora/

apps/
  api/
  mobile/
  admin/

packages/
  ai/
  auth/
  child/
  config/
  database/
  domain/
  family/
  media/
  notifications/
  pregnancy/
  shared/
  timeline/
  types/

infrastructure/
  docker/
  scripts/

docs/

README.md
```

---

# apps

The apps directory contains executable applications.

Applications are composition layers.

They wire together packages, expose user-facing or API entry points, and run as deployable units.

Applications must not own business rules.

Business logic belongs inside packages.

## api

Backend application.

Contains HTTP APIs and application composition.

Business rules should remain inside packages.

---

## mobile

Primary client application.

The first production client.

The minimum authenticated Expo/React Native shell architecture is defined in
`docs/20-minimum-authenticated-mobile-shell-architecture-decision.md`.
`apps/mobile` remains a scaffold until that decision’s implementation sprints
land.

---

## admin

Administrative application.

Not required for MVP.

Development may begin after the mobile MVP.

---

# packages

Packages contain reusable modules.

Packages should own business logic.

Applications consume packages.

Packages should not depend on application implementations.

---

## domain

Shared domain abstractions.

No infrastructure code.

---

## database

Database access.

Schema.

Migrations.

Repositories.

---

## auth

Authentication.

Authorization.

Identity services.

---

## family

Family aggregate.

Family members.

Permissions inside a family.

---

## pregnancy

Pregnancy domain.

---

## child

Child domain.

---

## timeline

Timeline domain.

Cross-domain chronological events.

---

## media

Media management.

Images.

Documents.

Files.

---

## notifications

Notification services.

Reminders.

Push notifications.

Email.

---

## ai

AI integration.

Prompt orchestration.

Model adapters.

Safety rules.

---

## config

Shared technical configuration.

Environment and runtime configuration helpers.

Workspace-level configuration conventions.

No business rules.

No domain logic.

---

## types

Shared type definitions.

Cross-package contracts and reusable type shapes.

No business rules.

No domain behavior.

---

## shared

Reusable, infrastructure-neutral utilities.

Shared helpers that multiple packages may use without coupling to a specific domain.

Shared must not become a dumping ground for unrelated code.

Shared must not contain domain-specific business rules.

Configuration and type definitions belong in config and types, not in shared.

---

# infrastructure

Contains operational infrastructure.

Examples:

- Docker
- deployment
- scripts
- local tooling

Infrastructure must never contain business logic.

Infrastructure must remain replaceable.

---

# Documentation

The docs directory remains the source of truth.

Repository structure must evolve together with documentation.

When the repository structure changes, this document must be updated in the same change set.

---

# Dependency Direction

The following dependency directions preserve the modular monolith and keep infrastructure replaceable.

## Allowed

- Applications may depend on packages.
- Infrastructure adapters may depend on domain contracts.
- Domain packages may depend on shared domain abstractions.

## Disallowed

- Packages must not depend on applications.
- Domain code must not depend on concrete infrastructure implementations.
- Shared must not depend on domain-specific packages.

---

# Repository Rules

- Keep domain boundaries clear.
- No circular dependencies.
- Prefer extending existing packages.
- Do not create new packages without documentation.
- No undocumented packages.
- Do not place unrelated code in shared.
- Major structural changes require an ADR.
- Repository structure and documentation must be updated together.

---

# Implementation Order

Repository implementation should follow this sequence:

1. Repository foundation
2. Development toolchain
3. Shared technical packages
4. Database foundation
5. Domain packages
6. Backend application composition
7. Mobile application
8. Administrative application
9. Deployment infrastructure

Do not skip steps.

---

# Success Criteria

A good repository layout:

- is easy to navigate,
- supports modular development,
- minimizes coupling,
- scales without major restructuring,
- remains understandable for both developers and AI assistants.
