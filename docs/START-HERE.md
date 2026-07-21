# START HERE

Welcome to the Lumora project.

This document is the primary entry point for every developer and AI assistant joining the project.

Before making any architectural, product, or implementation decision, read this document completely and then continue with the documentation in the recommended order.

---

# What is Lumora?

Lumora is a family-centered digital platform designed to support families throughout life.

The project begins with pregnancy and early childhood, but its long-term vision is to become a lifelong family platform.

Lumora is built around the following principles:

- Family-first
- Privacy-first
- Mobile-first
- Documentation-first
- AI-assisted, never AI-driven

AI assists families.
AI never replaces medical professionals.

---

# Project Philosophy

Every important decision should exist inside the repository.

Important knowledge must never exist only inside conversations.

Documentation is considered the source of truth.

Code must follow documentation—not the other way around.

---

# Documentation Reading Order

Every new contributor should read the documentation in the following order.

1. 01-product-vision.md
2. 02-product-principles.md
3. 03-domain-model.md
4. 04-mvp-scope.md
5. 05-roadmap.md
6. 06-security-and-medical-safety.md
7. 08-architecture-decisions.md
8. 99-deferred-decisions.md
9. 07-ai-developer-guide.md
10. 09-repository-layout.md
11. 10-technology-stack.md
12. 11-founder-independence-and-long-term-continuity.md
13. 12-authentication-architecture-decision.md
14. 13-family-domain-architecture-decision.md
15. 14-pregnancy-domain-architecture-decision.md

Do not skip this order.

---

# Decision Hierarchy

When documentation appears to overlap, use the following priority.

1. Architecture Decision Records (ADR)
2. Product Decisions
3. Product Vision
4. Product Principles
5. Domain Model
6. AI Developer Guide
7. Deferred Decisions

Deferred Decisions are **not** active architecture.

They are ideas intentionally postponed until specific review conditions are met.

---

# Repository Principles

Lumora follows a Documentation First workflow.

The expected workflow is:

Idea

↓

Discussion

↓

Documentation

↓

Architecture Review

↓

ADR or Product Decision

↓

Implementation

↓

Tests

↓

Commit

↓

Push

Implementation should never introduce undocumented architectural changes.

---

# Current Project Status

Current Phase:

Documentation Complete

Current Goal:

Build the MVP on top of the documented architecture.

Primary Focus:

- Simplicity
- Correct domain boundaries
- Maintainability
- Long-term scalability

Avoid premature optimization.

---

# What Must Never Change Without Review

The following principles require explicit review before modification.

- Family is the root aggregate.
- Pregnancy and Child are separate domains.
- Documentation is the source of truth.
- AI is an assistant, never a doctor.
- Privacy takes precedence over convenience.
- Major architecture changes require an ADR.

---

# Deferred Decisions

Ideas that are intentionally postponed are stored in:

docs/99-deferred-decisions.md

Do not implement deferred decisions directly.

Evaluate whether their review conditions have been satisfied first.

---

# AI Responsibilities

Every AI assistant working on Lumora should:

- understand existing documentation before making suggestions.
- preserve architectural consistency.
- avoid introducing unnecessary complexity.
- prefer extending existing modules over creating new ones.
- recommend ADRs when architectural changes are proposed.
- recommend Product Decisions when product behavior changes.
- check Deferred Decisions before proposing major architectural work.

---

# Success Criteria

A successful contribution to Lumora:

- respects existing documentation,
- improves maintainability,
- keeps the architecture simple,
- avoids unnecessary abstractions,
- preserves long-term consistency.

---

Welcome to Lumora.

Read first.

Think second.

Implement last.
