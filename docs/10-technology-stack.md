# Technology Stack

Version: 1.0

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

---

# Package Manager

pnpm

Reason:

- Fast
- Disk efficient
- Excellent workspace support

---

# Monorepo

pnpm Workspaces

Repository structure is defined in:

docs/09-repository-layout.md

---

# Language

TypeScript

Use strict mode.

Avoid `any`.

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

---

# ORM

Prisma

Responsibilities:

- Schema
- Migrations
- Type-safe queries

---

# Authentication

Better Auth

Responsibilities:

- Authentication
- Sessions
- Identity

Authorization belongs to the domain.

---

# API

REST

GraphQL is intentionally out of scope.

---

# Validation

Zod

Use shared schemas whenever practical.

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

Packages should not depend on applications.

Business rules belong inside domain packages.

Infrastructure should remain replaceable.

---

# Future Technologies

Future technologies require documentation before adoption.

Examples:

- Event Bus
- Kafka
- GraphQL
- Microservices
- Vector Database

These are intentionally deferred.

---

# Success Criteria

The technology stack should:

- remain simple,
- support long-term evolution,
- minimize vendor lock-in,
- maximize maintainability,
- follow the documented architecture.