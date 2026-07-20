# Repository Layout

Version: 1.0

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

├── apps/
│   ├── api/
│   ├── mobile/
│   └── admin/
│
├── packages/
│   ├── ai/
│   ├── auth/
│   ├── child/
│   ├── database/
│   ├── domain/
│   ├── family/
│   ├── media/
│   ├── notifications/
│   ├── pregnancy/
│   ├── shared/
│   └── timeline/
│
├── infrastructure/
│   ├── docker/
│   └── scripts/
│
├── docs/
│
└── README.md
```

---

# apps

The apps directory contains executable applications.

## api

Backend application.

Contains HTTP APIs and application composition.

Business rules should remain inside packages.

---

## mobile

Primary client application.

The first production client.

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

## shared

Reusable utilities.

Shared types.

Configuration.

No business rules.

---

# infrastructure

Contains operational infrastructure.

Examples:

- Docker
- deployment
- scripts
- local tooling

Infrastructure must never contain business logic.

---

# Documentation

The docs directory remains the source of truth.

Repository structure must evolve together with documentation.

---

# Repository Rules

- Keep domain boundaries clear.
- Avoid circular dependencies.
- Prefer extending existing packages.
- Do not create new packages without documentation.
- Major structural changes require an ADR.

---

# Implementation Order

Repository implementation should follow this sequence:

1. Repository foundation
2. Tooling
3. Database
4. Shared packages
5. Domain packages
6. Applications
7. Infrastructure

Do not skip steps.

---

# Success Criteria

A good repository layout:

- is easy to navigate,
- supports modular development,
- minimizes coupling,
- scales without major restructuring,
- remains understandable for both developers and AI assistants.