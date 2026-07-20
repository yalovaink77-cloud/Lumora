# Deferred Decisions

## Purpose

This document preserves valuable ideas that are intentionally postponed.

Nothing important should exist only in conversation.

If an idea is worth remembering but is not yet ready for implementation, it belongs here.

Items in this document are **not accepted product or architecture decisions**. They become official only after being promoted to one of the following:

- an Architecture Decision Record (ADR)
- a documented Product Decision

---

## Lifecycle

Every deferred decision must eventually become one of the following:

- **Accepted** — Promoted to an ADR or Product Decision.
- **Rejected** — Explicitly discarded.
- **Replaced** — Superseded by another decision.
- **Deferred Again** — Kept for future evaluation with updated review conditions.

---

## Rules

- A deferred decision must never be implemented directly.
- Every deferred decision must include:
  - Title
  - Description
  - Why Deferred
  - Revisit When
  - Possible Outcome
- Before implementation, a deferred decision must first become an accepted ADR or documented Product Decision.
- Whenever possible, review triggers should be based on objective project conditions rather than arbitrary dates.

---

## Backlog

### FD-001

#### Title

Timeline as the Central Event Layer

#### Description

Evaluate whether Timeline should become the central chronological layer of Lumora, with major domains contributing events instead of maintaining independent chronological histories.

#### Why Deferred

The MVP is intentionally small. Current functionality does not yet justify a stronger architectural commitment.

#### Revisit When

- Timeline receives events from three or more business domains.
- Multiple domains begin implementing independent chronological histories.
- Phase 2 planning begins.

#### Possible Outcome

Architecture Decision Record (ADR)

---

### FD-002

#### Title

AI as a Cross-Cutting Service

#### Description

Evaluate whether AI should remain a shared application service rather than becoming its own business domain.

#### Why Deferred

The MVP contains only limited AI functionality.

#### Revisit When

- AI is used by multiple business domains.
- Prompt management becomes shared across the application.
- AI orchestration begins to duplicate between modules.

#### Possible Outcome

Architecture Decision Record (ADR)

---

### FD-003

#### Title

Media Referenced, Not Embedded

#### Description

Evaluate whether Timeline should reference Media entities instead of storing media-related information directly.

#### Why Deferred

Current MVP media requirements are intentionally minimal.

#### Revisit When

- Media metadata grows significantly.
- Multiple domains reuse the same media.
- Storage and retrieval responsibilities begin to duplicate.
- Media evolves into its own rich domain.

#### Possible Outcome

Architecture Decision Record (ADR)

---

## Maintenance

This document should be reviewed periodically as the project evolves.

During each review:

- Promote mature decisions to ADRs or Product Decisions.
- Remove decisions that are no longer relevant.
- Update review triggers when project scope changes.
- Keep this document focused on active and meaningful deferred decisions.