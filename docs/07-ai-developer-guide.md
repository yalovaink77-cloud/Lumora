# AI Developer Guide

## 1. Project Goal

Rebuild Lumora from its documented product vision, principles, domain model, MVP scope, roadmap, and safety policies. Deliver only work that advances the documented product scope.

## 2. Source of Truth

- Treat `/docs` as the single source of truth.
- Follow documents in numerical order when they conflict with assumptions.
- Do not infer requirements from lost code or unrelated repository contents.
- Raise undocumented decisions before acting on them.
- Review `99-deferred-decisions.md` before introducing any new domain, architectural layer, or major cross-cutting concern.

## 3. Coding Rules

- Do not write code until the relevant product and architectural decision is documented.
- Implement only the requested, documented scope.
- Do not add speculative features, abstractions, or dependencies.
- Preserve privacy, child-data protection, and medical-safety principles.
- Keep changes small, focused, and reviewable.
- Prefer simple, readable solutions over premature optimization.

## 4. Documentation Rules

- Document every material product or architectural decision before implementation.
- Update the relevant `/docs` document when an approved decision changes.
- Keep documentation concise, consistent, and free of implementation detail unless a later document explicitly requires it.
- Mark unknowns as unknown; do not fill gaps with assumptions.

## 5. Architecture Rules

- Respect the core domain boundaries: Family, Users, Family Members, Pregnancy, Child, Timeline, Media, Health, and Permissions.
- Treat Family as the privacy and access boundary.
- Treat health and child data as sensitive by default.
- Keep AI within its assistant role; it must not act as a doctor.
- Do not expand MVP scope without a documented decision.
- Prefer extending existing modules over creating new ones unless a documented architectural decision requires a new domain.

## 6. Prompt Rules

- Read the relevant `/docs` files before responding to a change request.
- Confirm the requested work fits documented scope.
- Ask a focused question when a required decision is missing or ambiguous.
- State any conflict with existing documentation clearly.
- Do not claim an action was performed unless it was completed and verified.
- If a requested change matches a deferred decision, stop implementation and recommend promoting the deferred decision into a documented ADR or product decision before continuing.

## 7. Git Rules

- Inspect existing changes before editing.
- Do not overwrite or discard user changes.
- Do not commit, amend, push, or alter history unless explicitly requested.
- Keep unrelated files out of a change.
- Use clear, scope-specific commit messages when a commit is requested.

## 8. Definition of Done

Work is done only when:

- It matches the documented scope.
- Relevant documentation is current.
- Privacy, child-data, medical-safety, and AI boundaries are preserved.
- No undocumented product or architectural decision was introduced.
- The requested change is complete, focused, and verified.
