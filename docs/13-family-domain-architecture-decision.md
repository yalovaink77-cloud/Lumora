# Family Domain Architecture Decision

Version: 1.3

Status: Approved

Phase: Backend Foundation

Decision date: 2026-07-21

---

# 1. Purpose

Lumora's approved MVP includes creating and managing a family, basic family
membership, and privacy-aware access control. The existing domain model and
ADR-003 establish Family as the root aggregate, but they do not yet define the
smallest implementation boundary for Family and FamilyMembership.

This decision defines that boundary before schema, migration, package, or API
implementation begins. It intentionally approves only what the current MVP
requires and records unresolved product behavior instead of guessing.

---

# 2. Decision

**Family is Lumora's root aggregate and primary privacy boundary.**

The following rules apply:

- Family is the top-level scope for family-owned data.
- A User gains access to a Family only through an explicit FamilyMembership.
- Authentication proves which User is calling; FamilyMembership determines
  whether that User may access a Family.
- Cross-family access is denied by default.
- A User may belong to multiple Families.
- Creating a Family and its initial FamilyMembership is one atomic operation.
- The creator receives the initial `OWNER` membership.
- No domain data may be added to authentication sessions or Better Auth
  persistence.

This decision extends ADR-003 without changing the approved authentication
architecture.

---

# 3. Decision Drivers

This foundation is driven by:

- the MVP requirement to create and manage a family,
- Family as the approved root aggregate,
- privacy by design and private-by-default family data,
- explicit support for Users belonging to multiple Families,
- separation of authentication from authorization,
- minimal data collection,
- long-term export, deletion, portability, and continuity obligations,
- and the need to avoid speculative roles, profile fields, and domain expansion.

---

# 4. Family Aggregate Boundary

Family represents the household or care-group boundary within which data is
owned, organized, and shared.

Every future family-owned aggregate must be explicitly scoped to exactly one
Family unless a later approved decision documents a narrow exception. A record
must never become visible across Families merely because the same User belongs
to both.

Family membership grants access only within the identified Family. It does not
create global access to another member's identity, other Families, or future
domain records.

---

# 5. Minimum Family Entity

The first implementation requires only:

- a stable, opaque Family identifier,
- a human-readable `displayName`,
- creation time,
- and update time.

`displayName` is required when creating a Family. It is user-provided Unicode
text that must be trimmed before validation and persistence. The trimmed value
must be non-empty and no longer than 100 characters.

`displayName` is not globally unique. Two or more Families may use the same
value. It is a presentation label only: it is not a slug, legal name, address,
household type, or identity claim.

Changing `displayName` remains deferred because no Family update endpoint is
approved by this decision.

No additional product fields are approved. In particular, description, avatar,
address, locale, slug, legal name, household type, and similar metadata must not
be invented during the first implementation sprint.

Creation ownership is represented by the initial `OWNER` FamilyMembership, not
by merging ownership into the authentication User or duplicating authentication
data on Family.

---

# 6. Minimum FamilyMembership Relationship

FamilyMembership is the explicit relationship between one authenticated User
and one Family.

The first implementation requires only:

- a stable, opaque FamilyMembership identifier,
- the Family identifier,
- the User identifier,
- the membership role,
- creation time,
- and update time.

The pair of Family identifier and User identifier must be unique. A User cannot
hold duplicate memberships in the same Family.

FamilyMembership belongs to the family domain. It is not an authentication
account, session, profile, invitation, guardian record, or permission engine.

---

# 7. Multiple-Family Membership

A User may belong to zero, one, or multiple Families.

This is required by the approved domain model, including situations such as
separated parents or caregivers participating in more than one family context.

Each membership is evaluated independently. Access to Family A provides no
access to Family B, even when the same User belongs to both.

The first implementation must not create a global "current family" assumption
in the authentication session. Family context must be explicit in family-scoped
requests.

---

# 8. Family Creation and Initial Membership

An authenticated User may create a Family.

Creation must:

1. create the Family,
2. create exactly one initial FamilyMembership for the authenticated User,
3. assign that membership the `OWNER` role,
4. and return success only when both records are durable.

These writes must run in one database transaction. If either write fails, both
writes must roll back. A successful creation must never produce a Family without
an initial membership or an initial membership without its Family.

Client-supplied User identifiers must not determine the creator. The initial
membership must use the neutral authenticated principal resolved by the NestJS
authentication boundary.

---

# 9. Minimum Membership Roles

The first implementation supports one role:

- `OWNER` — the authenticated creator's initial membership and the minimum
  authority required to establish the Family.

`OWNER` is an authorization role within one Family. It does not imply corporate
ownership of data, ownership of another person, or access outside that Family.
Families and Users retain the data rights established in the product and
continuity documents.

The existing documentation mentions mother, father, guardian, and relative as
examples of family relationships, but it does not define a complete role
vocabulary, permission matrix, or lifecycle. Those labels must not be converted
into persisted roles by this decision.

Additional basic MVP roles require a separate, narrowly scoped product decision
before implementation. The initial schema and code must not speculate about
them.

---

# 10. Authorization Boundary

Authentication and authorization remain separate:

- Better Auth authenticates the request and resolves the User.
- NestJS exposes a neutral authenticated principal.
- The family application boundary uses only the principal's stable User
  identifier for membership checks.
- The family domain defines Family and FamilyMembership rules.
- `@lumora/database` performs persistence through the shared Prisma Client.

For the first implementation:

- all Family API operations require authentication,
- membership is required to read a Family,
- the creator's `OWNER` membership authorizes access to the created Family,
- and no complete permission engine is introduced.

The first implementation has no membership-management operation, so it does not
need to define owner transfer, member removal, invitation acceptance, or
role-change permissions.

---

# 11. Cross-Family Isolation

Cross-family isolation is a non-negotiable invariant.

- Every Family lookup must be scoped by the authenticated User's membership.
- A Family identifier alone is never proof of access.
- List operations return only Families for which the User has a membership.
- Access checks must occur on the server, never only in a client.
- Repository and query APIs must make Family scope explicit.
- Caches, logs, errors, and tests must not leak another Family's private data.
- Future family-owned records must carry or derive an unambiguous Family scope.

For direct Family lookup, a missing Family and a Family inaccessible to the
caller must produce the same not-found behavior. This avoids exposing Family
existence across privacy boundaries.

---

# 12. Neutral Application Identity Boundary

The existing Better Auth User remains the authentication identity.

Family code may receive a neutral principal containing the stable User
identifier and other already-approved neutral identity fields. It must not
depend on:

- Better Auth runtime types,
- password or account records,
- session tokens,
- cookies,
- provider identifiers,
- or authentication protocol details.

FamilyMembership references the existing User identifier. It must not duplicate
User email, name, password data, session data, or profile fields.

Authentication User and FamilyMembership are distinct concepts:

- User answers "who is authenticated?"
- FamilyMembership answers "in which Family context may this User act?"

---

# 13. Database and Package Ownership

The approved ownership boundaries are:

## `packages/family`

The documented family package owns:

- Family and FamilyMembership domain concepts,
- creation invariants,
- family-scoped authorization contracts,
- and application behavior independent of NestJS and Better Auth.

Sprint 2.4B implements this boundary as `@lumora/family`.

## `@lumora/database`

`@lumora/database` remains the sole owner of:

- Prisma Client,
- schema and migrations,
- database connection lifecycle,
- and persistence implementations.

No family package or application may create another Prisma Client or duplicate
Prisma configuration.

## `@lumora/auth`

`@lumora/auth` continues to own authentication runtime integration only. It must
not own Family, FamilyMembership, family roles, or family authorization rules.

## `apps/api`

The NestJS API composes authentication, family behavior, and persistence. It
owns HTTP transport, authenticated principal resolution, and translation of
domain outcomes into safe HTTP responses. It must not become the home of family
business rules.

## Shared packages

Empty shared packages must not become a shortcut for family-specific behavior.
Family rules belong in the documented family boundary.

---

# 14. Initial API Behavior

The first Family implementation sprint may expose only:

- `POST /families` — create a Family and the caller's initial `OWNER`
  membership atomically,
- `GET /families` — list only Families accessible through the caller's
  memberships,
- `GET /families/:familyId` — return the minimum Family representation only
  when the caller is a member.

Required behavior:

- unauthenticated requests return HTTP 401,
- cross-family and unknown Family lookups return the same HTTP 404 behavior,
- successful creation returns the minimum Family representation and the
  caller's membership representation,
- list and direct-get responses use the same minimum Family representation,
- no endpoint accepts a User identifier for creation ownership,
- and responses contain no Better Auth internals, credentials, cookies, session
  tokens, or unrelated User fields.

`POST /families` accepts only:

```json
{
  "displayName": "..."
}
```

The server must reject a missing `displayName`, an empty or whitespace-only
value after trimming, and a trimmed value longer than 100 characters. Valid
Unicode text must be accepted. Unknown request fields must be rejected.

Every minimum Family response includes only:

- `id`,
- `displayName`,
- `createdAt`,
- and `updatedAt`.

The returned `displayName` is the trimmed persisted value. No update or rename
endpoint is approved.

---

# 15. Deletion, Export, and Continuity

Families and Users retain the ownership, export, deletion, and portability
rights established in the approved continuity documentation.

This foundation must preserve those rights by:

- keeping Family as the root scope for future complete exports,
- using stable identifiers and explicit relationships,
- avoiding proprietary or provider-specific ownership identifiers,
- preventing an authentication-account deletion from silently deleting a
  Family aggregate,
- and ensuring a future operator or acquirer can understand and enforce the
  same Family boundaries from repository-owned documentation and schema.

Family deletion, User deletion effects, membership removal, ownership transfer,
last-owner behavior, export format, export authority, legal retention, and
controlled-shutdown procedures are not sufficiently defined for implementation.
No destructive Family or membership endpoint is approved in the first sprint.

Database referential actions must not silently cascade from authentication User
deletion into Family deletion. Final deletion and ownership-transfer semantics
require a separate approved decision.

Acquisition or operator change must not broaden Family visibility, merge
Families, or reinterpret platform ownership as ownership of family data.

---

# 16. Security Invariants

The implementation must preserve all of the following:

- deny cross-family access by default,
- require an authenticated principal for every Family operation,
- derive creation ownership only from the authenticated principal,
- create Family and initial membership atomically,
- enforce one membership per User per Family,
- never place Family identifiers, roles, or membership lists in the Better Auth
  session payload,
- never expose credentials, account data, cookies, or raw session tokens,
- never trust a client-supplied membership or ownership claim,
- never return another Family's data in responses, errors, logs, or caches,
- and never allow User deletion to silently destroy a Family.

Authorization checks must be applied consistently at the application boundary
and backed by family-scoped persistence queries. Client-side filtering is not an
authorization control.

---

# 17. Test Requirements

The first implementation must include:

- unit tests for Family creation invariants,
- tests proving the authenticated creator receives one `OWNER` membership,
- tests proving duplicate membership is rejected,
- tests proving Family and initial membership roll back together on failure,
- authenticated HTTP tests for create, list, and get,
- unauthenticated HTTP 401 tests,
- two-User and two-Family isolation tests,
- tests proving inaccessible and unknown Family identifiers share HTTP 404
  behavior,
- tests proving one User may access multiple Families through separate
  memberships,
- validation tests rejecting a missing `displayName`,
- validation tests rejecting an empty or whitespace-only `displayName`,
- validation tests rejecting a trimmed `displayName` longer than 100 characters,
- validation tests accepting and preserving a valid Unicode `displayName`,
- tests proving two Families may use the same `displayName`,
- tests proving responses contain the trimmed persisted `displayName`,
- response-shape tests excluding Better Auth and sensitive fields,
- migration application tests against disposable PostgreSQL,
- and tests proving existing authentication flows remain intact.

Tests must create and clean up their own data and must not depend on persistent
fixtures.

---

# 18. Migration and Rollback Expectations

The first implementation migration must:

- be additive,
- use a truthful 2026 migration identifier,
- leave existing authentication migrations unchanged,
- introduce only the minimum Family and FamilyMembership persistence required by
  this decision,
- enforce membership uniqueness,
- add the foreign keys and indexes needed for Family-scoped membership lookups,
- and apply successfully to a clean database and a database containing the
  existing authentication foundation.

Migration verification must use disposable PostgreSQL and include Prisma schema
validation, migration deployment, and runtime persistence tests.

Rollback expectations:

- before production data exists, a failed unreleased migration may be corrected
  through the repository's normal reviewed development workflow,
- after a migration has been applied to a shared or production environment,
  rollback must use an explicit reviewed recovery or forward-fix plan,
- and rollback must never orphan memberships, silently delete Families, or
  damage Better Auth records.

This decision does not authorize modifying or replacing an existing migration.

---

# 19. Explicit Exclusions

The following are outside this decision and the first implementation sprint:

- Family product metadata other than `displayName`,
- Family update endpoints, including changing `displayName`,
- UserProfile fields,
- Child,
- Pregnancy,
- Timeline,
- Media,
- Health,
- invitations,
- guardian workflows,
- family relationship labels,
- additional membership roles,
- granular permissions or a permission engine,
- role customization,
- social features,
- membership management,
- ownership transfer,
- leaving or removing members,
- Family deletion,
- export implementation,
- audit-log implementation,
- mobile UI,
- admin UI,
- and changes to Better Auth session design.

These exclusions must not be anticipated through speculative fields, enums, or
APIs.

---

# 20. Unresolved Decisions

The following require narrow follow-up decisions before their respective
implementation:

1. `displayName` update behavior and who may perform it.
2. Ownership transfer and last-owner invariants.
3. Member removal and leave workflows.
4. Family and membership deletion behavior, including User deletion effects.
5. Export format, completeness, authority, and legal retention behavior.
6. Whether a client needs a preferred or last-selected Family, and where that
   preference belongs.

`docs/17-family-roles-and-membership-entry-architecture-decision.md` resolves
the former role-count, additional-role, invitation, and acceptance decisions:

- the MVP roles are exactly `OWNER` and `MEMBER`,
- every Family has exactly one OWNER,
- and MEMBER entry requires explicit acceptance of an OWNER-created invitation.

That decision does not alter the implemented Sprint 2.4B create, list, or
membership-scoped direct-get contracts. Sprint 2.8B implements the approved
OWNER/MEMBER invitation vertical against the verified-email prerequisite from
`docs/18-verified-email-ownership-architecture-decision.md`.

---

# 21. Initial Implementation Scope — Sprint 2.4B

Sprint 2.4B may implement only:

- the minimum Family and FamilyMembership persistence from this decision,
- required, trimmed, non-empty `displayName` persistence with a maximum of 100
  characters,
- one additive Prisma migration,
- the documented family package boundary,
- atomic Family plus initial `OWNER` membership creation,
- membership-scoped Family list and lookup,
- the three approved HTTP endpoints,
- focused authorization and cross-family isolation tests,
- disposable PostgreSQL migration and runtime verification,
- and truthful implementation documentation.

Sprint 2.4B must not implement any item listed in the explicit exclusions.

---

# 22. Implementation Gate

Sprint 2.4B may begin only when:

- this decision remains approved,
- the repository is clean and verified,
- Family and FamilyMembership boundaries remain unambiguous,
- no Family product field beyond `displayName` and no additional role is
  assumed,
- authentication and authorization remain separate,
- and the implementation plan fits the scope in section 21.

---

# 23. Future Review Triggers

Review this decision when:

- additional membership roles are approved,
- invitations or membership management begin,
- ownership transfer or deletion is implemented,
- export requirements become concrete,
- guardian authorization is introduced,
- a future domain first stores Family-owned data,
- or legal and continuity obligations change.

---

# 24. References

- `docs/01-product-vision.md`
- `docs/02-product-principles.md`
- `docs/03-domain-model.md`
- `docs/04-mvp-scope.md`
- `docs/06-security-and-medical-safety.md`
- `docs/07-ai-developer-guide.md`
- `docs/08-architecture-decisions.md`
- `docs/09-repository-layout.md`
- `docs/10-technology-stack.md`
- `docs/11-founder-independence-and-long-term-continuity.md`
- `docs/12-authentication-architecture-decision.md`
- `docs/17-family-roles-and-membership-entry-architecture-decision.md`
- `docs/99-deferred-decisions.md`

---

# 25. Sprint 2.4B Implementation Record

Status: Implemented

The minimum vertical is implemented with these boundaries:

- `@lumora/family` owns input validation, Family and FamilyMembership contracts,
  the `OWNER` creation invariant, and infrastructure-independent application
  behavior.
- `@lumora/database` owns the Prisma schema, migration, shared-client repository,
  transaction, and membership-scoped queries.
- `apps/api` composes the domain service and repository with the neutral
  authenticated principal and maps outcomes to HTTP.

The additive migration creates `family`, `family_membership`, and the
`FamilyMembershipRole` enum. The membership relation has a unique
`familyId`/`userId` pair and a `userId` lookup index. Family deletion cascades
only to its memberships; User deletion is restricted while memberships exist
and cannot cascade to Family.

The implemented HTTP response shapes are:

- `POST /families` returns HTTP 201 with `{ "family": Family,
"membership": FamilyMembership }`.
- `GET /families` returns `{ "families": Family[] }`.
- `GET /families/:familyId` returns `Family`.
- `Family` contains only `id`, `displayName`, `createdAt`, and `updatedAt`.
- `FamilyMembership` contains only `id`, `familyId`, `userId`, `role`,
  `createdAt`, and `updatedAt`.

Unknown and inaccessible direct lookups both return the same
`FAMILY_NOT_FOUND` HTTP 404 response. PostgreSQL migration, authentication, and
Family runtime verification share the disposable Docker suite exposed through
`pnpm test:family:postgres` and `pnpm test:auth:postgres`.
