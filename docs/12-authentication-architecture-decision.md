# Authentication Architecture Decision

Version: 1.0

Status: Approved

Phase: Backend Foundation

Decision date: 2026-07-21

---

# 1. Purpose

Lumora handles sensitive family, child, and health-related information. Authentication is therefore a foundational trust boundary, not an implementation detail that can be improvised during feature work.

This document exists because Lumora follows **Documentation Before Implementation** (see `docs/02-product-principles.md` and `docs/07-ai-developer-guide.md`). Identity, sessions, and credential handling must be formally approved before Sprint 2.3B introduces authentication code, Prisma auth models, or NestJS auth integration.

Without an approved architecture:

- competing authentication approaches could appear across packages,
- domain boundaries could leak into credential handling,
- security and privacy principles could be applied inconsistently,
- and long-term continuity obligations could be undermined by ad hoc identity design.

This decision records the approved authentication foundation for Lumora's backend.

---

# 2. Decision

**Better Auth is Lumora's approved authentication system.**

The following rules apply:

- Lumora must **not** maintain a competing custom JWT authentication system as its primary foundation.
- Authentication persistence must use the shared `@lumora/database` layer defined in `packages/database`.
- **Better Auth** owns credential hashing and session protocol where applicable.
- **NestJS** owns application integration, guards, principal resolution, and authorization boundaries.

This decision is effective immediately and governs all authentication implementation work in Phase 2 Sprint 2.3B and subsequent backend identity work until formally reviewed.

---

# 3. Decision Drivers

Lumora selected Better Auth because it best matches the platform's documented requirements:

- **Self-hosting** — Lumora runs its own backend and database; authentication must remain under Lumora's operational control.
- **Privacy** — Family and child data require privacy by design; authentication must not force unnecessary third-party identity exposure.
- **User data control** — Users and families retain ownership of their data; identity persistence must remain in Lumora's PostgreSQL database, not a proprietary external identity store.
- **Low vendor lock-in** — Authentication must remain replaceable through documented boundaries rather than embedded custom cryptography or opaque SaaS coupling.
- **Long-term maintainability** — A maintained library with clear adapter patterns reduces the cost of decades-long operation.
- **Acquisition readiness** — A self-contained, documented authentication layer supports due diligence and controlled ownership transfer.
- **Founder independence** — Authentication must not depend on one individual's bespoke implementation or undocumented secrets handling (see `docs/11-founder-independence-and-long-term-continuity.md`).
- **Prisma/PostgreSQL compatibility** — Lumora's approved database stack uses PostgreSQL and Prisma through `@lumora/database`.
- **Web and mobile compatibility** — Lumora requires authentication that can support a NestJS API, future mobile clients, and optional admin tooling without separate identity silos.
- **Avoidance of homemade cryptography** — Password hashing, session handling, and credential verification must not be reinvented in application code.

---

# 4. Alternatives Considered

## Custom JWT authentication

A custom JWT-based system would give Lumora full control over token format and validation, but it would also require Lumora to own token lifecycle design, refresh semantics, revocation strategy, and cryptographic choices. That increases security risk and long-term maintenance burden for a platform that explicitly avoids homemade cryptography.

**Not selected** as Lumora's primary authentication foundation.

## Passport-only custom implementation

Passport.js is a flexible authentication middleware ecosystem, but it is not a complete authentication product. Lumora would still need to design persistence, session storage, password handling, and protocol behavior itself. That creates many of the same risks as a fully custom system while providing less structure than an opinionated auth library.

**Not selected** as Lumora's primary authentication foundation.

## Managed external identity providers

Managed identity services can reduce implementation effort and provide mature operational features. However, they introduce stronger external dependency, complicate self-hosting and data-control goals, and may conflict with Lumora's founder independence, export, and continuity requirements when identity records live primarily outside Lumora's database boundary.

**Not selected** as Lumora's primary authentication foundation.

## Better Auth

Better Auth provides a self-hostable authentication framework with session-oriented design and adapter support compatible with Lumora's PostgreSQL and Prisma direction. It allows Lumora to keep identity persistence inside `@lumora/database` while delegating credential and session protocol concerns to a maintained library.

**Selected** as Lumora's approved authentication system.

---

# 5. Ownership Boundaries

## Better Auth

Better Auth is responsible for:

- credential processing
- password hashing
- session creation and validation
- authentication protocol behavior
- minimum required identity persistence contracts consumed by its adapter

Better Auth must not become the home of Lumora domain rules such as family membership, guardian relationships, or child ownership.

## @lumora/database

The `@lumora/database` package is responsible for:

- Prisma Client ownership
- database connection lifecycle
- schema and migration ownership
- sole database access boundary for all persistence, including auth tables introduced in Sprint 2.3B

No application or package may introduce duplicate Prisma configuration.

## NestJS API

The NestJS API in `apps/api` is responsible for:

- mounting or adapting Better Auth handlers
- request and session resolution
- authenticated principal abstraction exposed to the application
- reusable authentication guard
- safe application-facing endpoints
- future authorization enforcement at the application boundary

The API composes packages; it does not own domain business rules.

## Domain layer

The domain layer must:

- **not** depend directly on Better Auth internals
- receive neutral application identity concepts such as authenticated user identifiers and session context abstractions
- **not** contain password handling, credential verification, or raw session-token logic

Authorization decisions belong to the domain and permission model described in `docs/03-domain-model.md`. Authentication proves identity; authorization decides access.

---

# 6. Identity Model Boundary

Lumora distinguishes several identity-related concepts that must not be collapsed into one table or one session payload.

## Authentication identity

The record Better Auth requires to authenticate a person: credentials, account linkage, and session state. This is the minimum identity needed to prove "who is calling the API."

## Application user / profile

The Lumora user concept described in `docs/03-domain-model.md`: a person who can interact with the platform. Sprint 2.3B may introduce only the minimum persistence needed to connect authentication identity to future application user behavior.

## Family membership

The relationship between a user and a family unit. This belongs to the family domain and permission model, not to authentication persistence.

## Guardian relationships

Role and care relationships within a family. These are authorization and domain concerns, not authentication concerns.

## Child records

Child entities are independent lifelong records within a family boundary. They must never be treated as login accounts in Sprint 2.3B.

## Sprint 2.3B schema boundary

Sprint 2.3B may add **only Better Auth's minimum required identity and session models** to the shared Prisma schema.

The following remain **deferred**:

- Family
- Guardian
- Child
- Pregnancy
- Timeline
- Media

---

# 7. Session Strategy

Lumora adopts the following session principles:

- **Server-managed sessions are the default.**
- Lumora will **not** build a homemade access/refresh token system.
- Session tokens must **not** be stored in plaintext when the selected library provides secure storage behavior.
- Cookies must be **HTTP-only** where cookies are used.
- Production cookies must use the **Secure** attribute.
- **SameSite** must be set appropriately for Lumora's current same-origin API architecture.
- Mobile session transport details will be finalized during mobile integration; this document does not prescribe an unverified mobile implementation.
- **Session revocation and logout must be supported.**
- **Raw session tokens must never be logged.**

Session payloads must remain minimal. They must not carry family, child, health, or media data.

---

# 8. Configuration and Secrets

Authentication configuration must follow these rules:

- Required authentication secrets must come from **environment variables**.
- **No secrets may be committed to Git.**
- Production secrets must meet **strong entropy requirements** appropriate to their purpose.
- Application startup must **fail safely** when mandatory auth configuration is missing.
- Development defaults must **not silently weaken production security**.
- Logs must **never** contain secrets, passwords, cookies, or raw tokens.

This document does not define actual secret values or production key rotation runbooks. Those belong in future operational documentation when implementation begins.

Environment loading for the API follows the rules already documented in `docs/10-technology-stack.md` for Nest and Prisma CLI contexts.

---

# 9. Security Principles

Lumora's authentication implementation must obey the following security principles:

- **No custom password hashing.**
- **No homemade cryptography.**
- **Generic login failure responses** that do not reveal whether an account exists.
- **Rate limiting is deferred** but required before public launch.
- **Enumeration resistance** in authentication responses and error handling.
- **Sensitive-field exclusion** from API responses and session payloads.
- **Session invalidation** on logout and when credentials change.
- **Least privilege** for authenticated access to downstream resources.
- **Secure defaults** in all environments; explicit opt-in for insecure development behavior.
- **Explicit trust boundaries** between Better Auth, NestJS, domain code, and clients.
- **Auditability** without recording secret material.

These principles align with `docs/06-security-and-medical-safety.md` and the AI developer guide's treatment of sensitive data.

---

# 10. Privacy and Continuity Alignment

This decision supports Lumora's documented privacy and continuity obligations:

- **Privacy by Design** — Authentication stays minimal, self-hosted, and bounded; it does not expand data collection beyond identity needs.
- **User ownership** — Identity records remain in Lumora's PostgreSQL database under user-controlled export and deletion policies defined elsewhere.
- **Founder independence** — Authentication relies on documented libraries, environment-managed secrets, and repository-owned schema rather than founder-specific custom code.
- **Acquisition readiness** — A single approved auth system with clear ownership boundaries simplifies technical due diligence.
- **Controlled shutdown** — Session invalidation and database-resident identity support orderly decommissioning without orphaned external identity dependencies.
- **Export and deletion rights** — Persistence through `@lumora/database` keeps identity subject to Lumora's broader data stewardship model.
- **Avoiding dependency on one external identity vendor** — Lumora retains operational and architectural control.

---

# 11. Initial Implementation Scope — Sprint 2.3B

Sprint 2.3B may implement **only** the following:

- Better Auth installation and configuration
- minimum Prisma auth models required by Better Auth
- truthful **2026** migration for those models
- NestJS `AuthModule`
- session and principal resolution
- reusable authentication guard
- minimum auth endpoints owned by Better Auth
- optional safe `GET /auth/me` endpoint
- focused tests for the above
- documentation updates required by the implementation

Sprint 2.3B must not introduce domain aggregates, family logic, or authorization policies beyond authentication boundary enforcement.

---

# 12. Explicitly Deferred

The following remain out of scope until separately documented and approved:

- social login
- passkeys
- MFA
- password reset delivery
- email verification delivery
- roles and permissions
- family invitations
- guardian authorization
- child ownership transition implementation
- account recovery workflows
- account deletion workflow
- mobile UI
- admin UI
- production email provider
- advanced abuse protection
- public-launch rate limiting

---

# 13. Risks and Mitigations

## Library evolution

**Risk:** Better Auth may introduce breaking changes across major releases.

**Mitigation:** Pin versions deliberately, document upgrade paths, and treat major upgrades as architecture review triggers.

## Adapter compatibility

**Risk:** Prisma adapter behavior may diverge from Lumora's `@lumora/database` conventions.

**Mitigation:** Keep all auth persistence inside the shared schema and migration process; validate adapter integration in focused tests before expanding scope.

## Mobile integration uncertainty

**Risk:** Mobile session transport may differ from browser cookie behavior.

**Mitigation:** Keep NestJS integration abstracted behind guards and principal resolution; finalize mobile transport only during mobile integration with a documented follow-up decision if needed.

## Session transport complexity

**Risk:** Cookie, header, or hybrid transport choices may create inconsistent client behavior.

**Mitigation:** Start with the simplest architecture consistent with Better Auth and current same-origin API assumptions; review before mobile launch.

## Framework coupling

**Risk:** Better Auth integration could leak into domain packages.

**Mitigation:** Enforce ownership boundaries in `packages/auth` and NestJS adapters; domain receives neutral identity concepts only.

## Migration risk

**Risk:** Introducing auth tables could destabilize the database foundation.

**Mitigation:** Add only Better Auth minimum models in a dedicated truthful 2026 migration; verify through existing build, lint, typecheck, and test gates.

## Future acquisition or ownership change

**Risk:** Authentication design could complicate transfer or shutdown.

**Mitigation:** Keep identity self-hosted in PostgreSQL, secrets in environment configuration, and behavior documented in repository-owned ADRs.

---

# 14. Non-Negotiable Rules

- Lumora operates **one authentication system**.
- Lumora operates **one Prisma Client owner**: `@lumora/database`.
- **No secrets in source control.**
- **No plaintext passwords.**
- **No raw session tokens in logs.**
- Domain code must **not depend on Better Auth internals**.
- **Authentication and authorization remain separate concepts.**
- Sensitive family and child data must **never become part of auth session payloads**.

---

# 15. Implementation Gate

Sprint 2.3B may start **only when** all of the following are true:

- this document exists
- status is **Approved**
- Better Auth is recorded in `docs/10-technology-stack.md`
- the repository remains clean and verified through the standard toolchain gates
- the architecture introduces **no competing auth system**

---

# 16. Future Review Triggers

Review and, if necessary, revise this decision when:

- Better Auth has a major incompatible release
- mobile authentication requirements become concrete
- MFA or passkeys are introduced
- regulatory obligations change
- acquisition or infrastructure migration occurs
- session architecture materially changes

---

# 17. References

- `docs/02-product-principles.md`
- `docs/03-domain-model.md`
- `docs/06-security-and-medical-safety.md`
- `docs/07-ai-developer-guide.md`
- `docs/09-repository-layout.md`
- `docs/10-technology-stack.md`
- `docs/11-founder-independence-and-long-term-continuity.md`
