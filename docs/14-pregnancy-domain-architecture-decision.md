# Pregnancy Domain Architecture Decision

Version: 1.2

Status: Approved — Sprint 2.5B Implemented

Phase: MVP Domain Foundation

Decision date: 2026-07-21

---

# 1. Purpose

Lumora's approved MVP includes creating a Pregnancy profile and organizing the
essential story of a Pregnancy within a Family context. The domain model and
ADR-004 establish Pregnancy as a domain separate from Child, but the approved
documentation did not originally define a concrete Pregnancy product field,
date, lifecycle vocabulary, or update behavior.

This decision defines every boundary that can be established from approved
requirements without inventing pregnancy-application conventions. Version 1.1
adds the approved minimum user-visible `displayName` field, making the first
create-and-read vertical useful without introducing dates, lifecycle states, or
medical fields.

---

# 2. Verified Product Requirements

The approved documentation establishes that:

- Lumora begins with pregnancy and early childhood and serves expecting mothers
  as primary users.
- The MVP must allow a mother to create a Pregnancy profile.
- A Pregnancy must be represented clearly within a Family context.
- Pregnancy represents the period and experience of expecting a child before
  birth.
- Pregnancy tracks a distinct journey with its own relevance and lifecycle.
- Pregnancy may provide context for future milestones and Health records.
- Pregnancy belongs to a Family.
- Family is the root aggregate and primary privacy boundary.
- FamilyMembership governs access within a Family.
- Pregnancy and Child are separate domains.
- Pregnancy may later transition into or be linked with a Child through an
  explicit relationship.
- Future Timeline continuity may span Pregnancy and Child.
- Health, Timeline, and Media remain separate domains.
- Private information must remain visible only within its intended Family.
- Lumora must not diagnose, prescribe, treat, or present uncertain medical
  information as fact.
- Families retain ownership, export, deletion, and portability rights over
  their data.
- Pregnancy has one minimum user-visible field, `displayName`, as approved for
  Sprint 2.5B.

No Pregnancy product field other than `displayName` is approved.

---

# 3. Decision

**Pregnancy is a separate Family-owned domain whose access is authorized through
FamilyMembership.**

The following rules are approved:

- Every Pregnancy belongs to exactly one Family.
- A Pregnancy cannot exist outside a Family scope.
- A Family may contain multiple Pregnancy records over its lifetime; the schema
  must not impose a one-Pregnancy-per-Family constraint.
- Authentication identifies the caller; FamilyMembership authorizes access to
  the Family that owns the Pregnancy.
- A Pregnancy identifier alone never proves access.
- Cross-family access is denied by default.
- Pregnancy and Child remain separate records and packages.
- Pregnancy data must not be stored in Better Auth persistence or session
  payloads.
- Every Pregnancy has a required user-provided `displayName`.
- No medical conclusion, lifecycle state, or transition may be inferred from a
  date, elapsed time, or the existence of another record.

The domain, minimum entity, authorization boundary, and initial API behavior are
approved. Sprint 2.5B is ready subject to the implementation gate in section 23.

---

# 4. Pregnancy Aggregate Boundary

Pregnancy represents one pregnancy journey within one Family. It is a
Family-owned aggregate, not an extension of an authentication User, a
FamilyMembership, or a Child.

The Family owns the privacy scope. Pregnancy owns only behavior and data that a
later approved Pregnancy product decision assigns directly to the Pregnancy
profile.

Pregnancy must not absorb:

- authentication identity,
- FamilyMembership roles,
- Child identity,
- Timeline entries,
- Health records,
- Media metadata or files,
- medical measurements,
- reminders or appointments,
- or AI-generated information.

Future domains may reference a Pregnancy by its stable identifier while
remaining separately owned and implemented.

---

# 5. Minimum Pregnancy Entity

The minimum Pregnancy entity contains only:

- a stable, opaque Pregnancy identifier,
- exactly one required Family identifier,
- a required human-readable `displayName`,
- creation time,
- and update time.

The Pregnancy identifier is required, system-generated, and immutable. The
Family identifier is required at creation and immutable; moving a Pregnancy
between Families is not approved. Creation time is system-generated and
immutable. Update time is system-managed and may change only when a future
approved operation changes an approved mutable field. No mutable product field
is currently approved.

`displayName` is required, user-provided, and normalized and validated according
to section 6. It is the only approved Pregnancy product field.

No additional optional product field is approved. In particular, dates,
lifecycle states, medical fields, descriptions, notes, images, and Child
relationships must not be added to the minimum entity.

---

# 6. Approved `displayName` Decision

`displayName` is the minimum user-visible field that makes a Pregnancy profile
recognizable within its Family.

The following rules apply:

- it is user-provided,
- it is required when creating a Pregnancy,
- it is Unicode text,
- it is trimmed before validation and persistence,
- the trimmed value must be non-empty,
- the trimmed value must contain no more than 100 Unicode code points,
- it is not unique globally or within a Family,
- multiple Pregnancies in one Family may have the same `displayName`,
- it has no system-generated default,
- and responses return the normalized persisted value.

`displayName` is a presentation label only. It is not:

- a legal name,
- a medical fact,
- a lifecycle or outcome statement,
- a Child identity,
- a Pregnancy-to-Child link,
- or an identity claim about any person.

No update or rename endpoint is approved for Sprint 2.5B. Whether and how
`displayName` may change remains deferred.

---

# 7. Date Semantics

No Pregnancy date field is currently approved.

The existing documentation does not define:

- an estimated due date,
- a pregnancy start date,
- a conception date,
- a last menstrual period date,
- a confirmed birth date,
- a date source,
- a confidence level,
- or which date a user is expected to know.

These fields must not be added merely because they are common in pregnancy
applications.

If a future decision approves an estimated date, it must:

- name the value explicitly as an estimate rather than a medical fact,
- define whether it is a date-only calendar value,
- define its source and user-facing meaning,
- define whether it is optional,
- define correction and update behavior,
- avoid deriving gestational age, trimester, conception, viability, or other
  medical conclusions,
- and avoid silently changing it through system calculations.

These constraints are safety requirements, not approval to implement an
estimated date.

---

# 8. Lifecycle and Status

The domain model states that Pregnancy has its own lifecycle, but it does not
define a lifecycle vocabulary or transition rules.

No Pregnancy status enum is approved. In particular, Sprint 2.5B must not invent
states such as:

- active,
- expected,
- completed,
- delivered,
- loss,
- archived,
- or converted.

Pregnancy outcome and loss can carry sensitive medical and emotional meaning.
The application must not infer, default, or require such a state without an
explicit product and medical-safety decision.

Creating a Child, reaching a date, or the passage of time must not automatically
change a Pregnancy state.

---

# 9. Family-Scoped Authorization

Every Pregnancy operation requires:

1. an authenticated neutral principal,
2. an explicit Family context,
3. and a persisted FamilyMembership connecting that principal's User identifier
   to that Family.

During the current one-role Family foundation, every persisted membership is
explicitly `OWNER`. Membership is sufficient for the minimum create and read
authorization described here. This does not define permissions for any future
membership role.

The implementation must:

- derive the User identifier only from the authenticated principal,
- never accept a client-supplied User identifier, membership, role, or ownership
  claim,
- scope every Pregnancy query through FamilyMembership,
- verify that a Pregnancy's `familyId` matches the Family in the request,
- and perform authorization on the server.

Family membership in Family A grants no Pregnancy access in Family B, even when
the same User belongs to both Families.

---

# 10. Creation and Read Behavior

The first Pregnancy implementation may expose only:

- `POST /families/:familyId/pregnancies` — create one Pregnancy in the specified
  Family,
- `GET /families/:familyId/pregnancies` — list Pregnancies in that Family
  accessible to the caller,
- `GET /families/:familyId/pregnancies/:pregnancyId` — return one
  membership-scoped Pregnancy.

Required behavior:

- every endpoint requires authentication,
- the caller must have a FamilyMembership in `familyId`,
- creation takes Family ownership from the path and verified membership rather
  than from a request-body ownership claim,
- list results include only Pregnancies in the requested Family,
- a missing Family and an inaccessible Family produce the same HTTP 404
  behavior,
- a missing Pregnancy, an inaccessible Pregnancy, and a Pregnancy that belongs
  to a different path Family produce the same HTTP 404 behavior,
- responses use deterministic shapes containing only approved Pregnancy fields,
- and responses contain no Better Auth internals, credentials, cookies, session
  tokens, membership records, or unrelated User data.

`POST /families/:familyId/pregnancies` accepts only:

```json
{
  "displayName": "..."
}
```

The request body must not accept `familyId`, `userId`, membership, role, dates,
status, Child linkage, or any other field.

Every minimum Pregnancy response contains only:

- `id`,
- `familyId`,
- `displayName`,
- `createdAt`,
- and `updatedAt`.

The returned `displayName` is the trimmed persisted value. List and direct-get
responses use the same minimum Pregnancy representation. Successful creation
returns that representation without authentication, membership, or User data.

No global cross-Family Pregnancy list is approved. No update, rename, or deletion
endpoint is approved.

---

# 11. Authentication and Authorization Boundary

Authentication and Pregnancy authorization remain separate:

- Better Auth authenticates the request and resolves the User.
- NestJS exposes the existing neutral authenticated principal.
- The Pregnancy application boundary receives only the principal's stable User
  identifier and explicit route identifiers.
- `@lumora/family` continues to own FamilyMembership concepts and Family access
  contracts.
- `@lumora/pregnancy` will own Pregnancy rules and application contracts in
  Sprint 2.5B.
- `@lumora/database` remains the sole Prisma Client, schema, migration, and
  persistence owner.
- `apps/api` composes authentication, Family authorization, Pregnancy behavior,
  persistence, and HTTP transport.

Pregnancy code must not depend on Better Auth runtime types, cookies, session
tokens, account records, password records, or provider identifiers.

No Pregnancy identifier, date, status, or other Pregnancy information may be
placed in an authentication session.

---

# 12. Package and Persistence Ownership

## `packages/pregnancy`

The documented Pregnancy package will own:

- Pregnancy domain concepts,
- Pregnancy input validation,
- Family-scoped Pregnancy application contracts,
- and behavior independent of NestJS, Better Auth, and Prisma.

Sprint 2.5B may create this package within the scope approved by sections 22 and 23.

## `@lumora/database`

`@lumora/database` remains the sole owner of:

- Prisma Client,
- schema and migrations,
- database connection lifecycle,
- FamilyMembership-scoped persistence queries,
- and Pregnancy persistence implementations.

No Pregnancy package or application may create another Prisma Client or
duplicate Prisma configuration.

## `@lumora/family`

The Family package continues to own Family and FamilyMembership concepts.
Pregnancy must not redefine membership, roles, invitations, or permissions.
API and persistence composition must enforce the existing FamilyMembership
boundary without copying Family rules into the Pregnancy package.

## `apps/api`

The API owns HTTP transport, authentication guards, neutral principal
resolution, dependency composition, and safe HTTP error mapping. Pregnancy
business rules must not be placed directly in controllers.

---

# 13. Sensitive and Medical-Data Boundary

The existence and details of a Pregnancy can reveal sensitive reproductive and
health context. Pregnancy data is therefore private Family data and must be
handled conservatively even when a field is not itself a medical record.

The minimum Pregnancy profile must not contain:

- diagnosis or treatment information,
- symptoms,
- measurements or test results,
- clinician or facility records,
- medications or supplements,
- ultrasound records,
- appointments,
- nutrition or exercise plans,
- risk classifications,
- medical advice,
- or AI-generated conclusions.

Future health-related information belongs to the separately documented Health
domain and may receive stricter permissions. Pregnancy must not become a
shortcut Health table.

API responses, logs, caches, analytics, and errors must minimize exposure and
must never reveal Pregnancy existence across Family boundaries.

---

# 14. Relationship to Future Domains

## Timeline

Pregnancy may later contribute to or be referenced by Timeline entries. Sprint
2.5B must not create Timeline fields, events, tables, or APIs. The deferred
decision about Timeline as a central event layer remains deferred.

## Health

Health information relevant to Pregnancy belongs to the future Health domain.
The Pregnancy entity may later be referenced by Health records but must not
embed them.

## Media

Media may later be associated with Pregnancy through separately approved
relationships. Sprint 2.5B must not add media identifiers, metadata, storage, or
attachments.

## Child

Child remains a separate domain and lifelong entity. Sprint 2.5B must not create
a Child record, Child fields, a Child package, or a Pregnancy-to-Child foreign
key.

These future relationships must preserve the same Family scope. A relationship
must never connect records owned by different Families.

---

# 15. Future Pregnancy-to-Child Transition

The approved architecture permits a Pregnancy to transition into or be linked
with a Child upon birth, but it does not define the transition behavior.

The transition must eventually be:

- explicit rather than inferred,
- represented as a relationship between separate domain records,
- Family-consistent,
- continuity-preserving,
- non-destructive to the Pregnancy history,
- and safe against duplicate or cross-Family linkage.

Sprint 2.5B must not:

- create a Child automatically,
- infer birth from a date,
- mark a Pregnancy complete,
- move Pregnancy data into Child,
- add `childId` or `pregnancyId` linkage fields,
- or implement conversion, transition, or birth endpoints.

The exact transition, cardinality, authority, and lifecycle effects require a
future approved decision.

---

# 16. Validation Requirements

The following validation rules are approved for the minimum API:

- request bodies must reject unknown fields,
- `displayName` must be present,
- `displayName` must be a string,
- `displayName` must be trimmed before validation and persistence,
- the trimmed `displayName` must not be empty,
- the trimmed `displayName` must contain no more than 100 Unicode code points,
- a `displayName` containing exactly 100 Unicode code points must be accepted,
- valid Unicode text must be accepted and preserved after trimming,
- duplicate `displayName` values must be accepted within one Family,
- `displayName` must not have a system-generated or database default,
- path Family and Pregnancy identifiers must be treated as opaque identifiers,
- client-supplied User identifiers, membership claims, roles, and ownership
  claims must be rejected,
- a Pregnancy must reference exactly one existing Family,
- and cross-Family relationships must be rejected.

If a date field is later approved, validation must distinguish calendar-date
syntax from medical interpretation. Syntactic validity must not be represented
as clinical accuracy.

---

# 17. Deletion, Export, and Continuity

Pregnancy records remain subject to the approved user and Family ownership,
export, deletion, portability, and controlled-shutdown principles.

The foundation must preserve those rights by:

- keeping every Pregnancy unambiguously scoped to one Family,
- using stable, provider-neutral identifiers,
- avoiding proprietary medical or identity ownership keys,
- allowing a future complete Family export to include Pregnancy records and
  their future relationships,
- and preserving Pregnancy history independently from any future Child record.

No Pregnancy deletion endpoint is approved. Family deletion behavior, Pregnancy
deletion semantics, retention obligations, export format, export authority, and
relationship cleanup remain unresolved.

An initial Pregnancy foreign key must not silently delete Pregnancy data merely
because an authentication User is deleted. Until Family deletion semantics are
approved, persistence should prefer restrictive referential behavior over an
implicit destructive cascade from Family to Pregnancy.

Acquisition or operator change must not broaden Pregnancy visibility, reinterpret
medical context, use Pregnancy information as an unrelated commercial asset, or
weaken export and deletion rights.

---

# 18. Migration Expectations

Sprint 2.5B's first migration must:

- be additive,
- use a truthful 2026 migration identifier,
- leave existing authentication and Family migrations unchanged,
- introduce only the approved minimum Pregnancy persistence,
- require exactly one valid Family relationship,
- persist a required `displayName` with capacity for at most 100 Unicode code
  points,
- require callers to provide `displayName` explicitly rather than assigning a
  database default,
- avoid unique constraints on `displayName`,
- add only indexes needed for Family-scoped list and direct lookup,
- avoid uniqueness constraints that limit a Family to one Pregnancy,
- avoid default lifecycle states or derived medical values,
- avoid Child, Timeline, Health, and Media relationships,
- and apply successfully to clean and existing Family-foundation databases.

Migration verification must use disposable PostgreSQL and include Prisma schema
validation, migration deployment, referential-integrity checks, Family-scoped
runtime queries, and regression verification of the existing authentication and
Family verticals.

---

# 19. Required Tests

Sprint 2.5B must include:

- unit tests for the approved Pregnancy creation invariants,
- validation tests rejecting a missing `displayName`,
- validation tests rejecting a non-string `displayName`,
- validation tests rejecting an empty or whitespace-only `displayName`,
- validation tests rejecting a trimmed `displayName` longer than 100 Unicode
  code points,
- validation tests accepting a `displayName` containing exactly 100 Unicode code
  points,
- validation tests accepting and preserving valid Unicode text,
- validation tests proving `displayName` is trimmed before persistence and
  response mapping,
- validation tests rejecting unknown request fields,
- tests proving duplicate `displayName` values are allowed within one Family,
- tests proving every Pregnancy has exactly one Family,
- tests proving multiple Pregnancy records may exist in one Family,
- unauthenticated HTTP 401 tests for every Pregnancy endpoint,
- authenticated creation, list, and direct-get tests,
- tests proving creation derives the User only from the authenticated principal,
- two-User and two-Family cross-family isolation tests,
- tests proving one User's memberships in multiple Families remain independently
  scoped,
- tests proving unknown, inaccessible, and path-Family-mismatched Pregnancies
  share the same HTTP 404 response,
- response-shape tests excluding authentication, membership, User, and sensitive
  unrelated data,
- architecture tests proving `@lumora/pregnancy` does not depend on NestJS,
  Better Auth, Prisma, or `@lumora/database`,
- persistence tests proving all reads are FamilyMembership-scoped,
- migration deployment tests against disposable PostgreSQL,
- cleanup tests that leave no persistent fixture data,
- and regression tests proving authentication and Family isolation remain
  intact.

No test may encode an unapproved date calculation, lifecycle state, medical
conclusion, or Pregnancy-to-Child transition.

---

# 20. Explicit Exclusions

The following are outside this decision and Sprint 2.5B:

- Child implementation,
- Pregnancy-to-Child transition or linkage,
- Timeline entries or events,
- Health records or medical measurements,
- Media or file attachments,
- AI features,
- reminders or notifications,
- appointments,
- ultrasound records,
- nutrition or exercise content,
- medications or supplements,
- symptoms or risk tracking,
- medical advice, diagnosis, or treatment,
- gestational-age or trimester calculation,
- conception or birth inference,
- lifecycle or outcome status,
- Pregnancy update endpoints,
- Pregnancy deletion endpoints,
- export implementation,
- invitations or guardian behavior,
- membership management or new roles,
- preferred or current Pregnancy,
- mobile UI,
- admin UI,
- analytics or social features,
- and changes to Better Auth sessions.

These exclusions must not be anticipated through speculative columns, enums,
relationships, APIs, or package abstractions.

---

# 21. Unresolved Product Decisions

The following require narrow approved decisions before their respective
implementation:

1. Whether any Pregnancy date is part of the MVP and its exact non-medical
   semantics.
2. `displayName` update behavior and who may perform it.
3. Update behavior for any future estimated value.
4. Pregnancy lifecycle and outcome vocabulary, if the product requires one.
5. Pregnancy-to-Child transition, cardinality, authority, and continuity
   behavior.
6. Pregnancy deletion, Family deletion effects, retention, and relationship
   cleanup.
7. Export format, completeness, authority, and legal-retention behavior.
8. Permissions for future FamilyMembership roles beyond the currently approved
   `OWNER`.

None of these decisions blocks the approved minimum create-and-read vertical.
Sprint 2.5B must exclude their associated behavior.

---

# 22. Proposed Sprint 2.5B Scope

Sprint 2.5B may implement only:

- `packages/pregnancy` with infrastructure-independent domain contracts and
  validation,
- the approved minimum Pregnancy fields: `id`, `familyId`, `displayName`,
  `createdAt`, and `updatedAt`,
- required, user-provided, trimmed, non-empty `displayName` persistence with a
  maximum of 100 Unicode code points, no uniqueness constraint, and no default,
- one additive Prisma migration owned by `@lumora/database`,
- a required Family relationship with conservative referential behavior,
- FamilyMembership-scoped creation, list, and direct lookup,
- the three nested Family/Pregnancy HTTP endpoints from section 10,
- deterministic minimum response shapes,
- focused validation and cross-family isolation tests,
- disposable PostgreSQL migration and runtime verification,
- regression verification of authentication and Family behavior,
- and truthful implementation documentation.

Sprint 2.5B must not implement any explicit exclusion or unresolved behavior.

---

# 23. Sprint 2.5B Implementation Gate

Sprint 2.5B is ready.

Implementation may begin only when:

- this decision remains approved,
- `displayName` remains the only Pregnancy product field,
- `displayName` remains required, user-provided, normalized, non-unique, and
  without a default,
- request and response shapes remain limited to section 10,
- no date or estimated value is included,
- no unapproved lifecycle status or update behavior is required,
- FamilyMembership-scoped authorization remains mandatory,
- Pregnancy and Child remain separate,
- the planned schema and API contain no excluded domain,
- and the repository is clean and verified.

The approved `displayName` field makes the minimum entity meaningfully usable
without requiring a date, lifecycle state, medical field, or Child relationship.

---

# 24. Security Invariants

The eventual implementation must preserve all of the following:

- deny cross-family Pregnancy access by default,
- require authentication and FamilyMembership for every operation,
- derive the User identifier only from the authenticated principal,
- never trust client-supplied membership, role, or ownership claims,
- never treat a Pregnancy identifier as proof of access,
- never reveal Pregnancy existence through differing inaccessible and unknown
  responses,
- never place Pregnancy data in authentication sessions,
- never expose credentials, accounts, cookies, or raw session tokens,
- never infer medical facts, dates, lifecycle states, or outcomes,
- never connect Pregnancy to records in another Family,
- and never allow authentication User deletion to silently destroy Pregnancy
  data.

---

# 25. Future Review Triggers

Review this decision when:

- `displayName` update or replacement is proposed,
- a date or estimated value is proposed,
- Pregnancy update or deletion behavior is proposed,
- lifecycle or outcome tracking is proposed,
- Timeline, Health, or Media first references Pregnancy,
- Pregnancy-to-Child transition is designed,
- additional FamilyMembership roles are approved,
- export or legal-retention requirements become concrete,
- or privacy, medical-safety, continuity, or acquisition obligations change.

---

# 26. References

- `docs/START-HERE.md`
- `docs/01-product-vision.md`
- `docs/02-product-principles.md`
- `docs/03-domain-model.md`
- `docs/04-mvp-scope.md`
- `docs/05-roadmap.md`
- `docs/06-security-and-medical-safety.md`
- `docs/07-ai-developer-guide.md`
- `docs/08-architecture-decisions.md`
- `docs/09-repository-layout.md`
- `docs/10-technology-stack.md`
- `docs/11-founder-independence-and-long-term-continuity.md`
- `docs/12-authentication-architecture-decision.md`
- `docs/13-family-domain-architecture-decision.md`
- `docs/99-deferred-decisions.md`

---

# 27. Sprint 2.5B Implementation Record

Status: Implemented

The minimum vertical is implemented with these boundaries:

- `@lumora/pregnancy` owns strict Zod input validation, Pregnancy contracts,
  repository contracts, and infrastructure-independent application behavior.
- `@lumora/database` owns the Prisma model, additive migration, shared-client
  repository, serializable creation transaction, and membership-scoped queries.
- `apps/api` composes the existing authentication guard, neutral principal,
  Pregnancy application service, persistence, deterministic responses, and safe
  HTTP errors.

The additive migration creates only `pregnancy` with `id`, `familyId`,
`displayName`, `createdAt`, and `updatedAt`. The required Family foreign key
uses restrictive deletion behavior, `displayName` is required without a
default or uniqueness constraint, and the Family-scoped list path has one
`familyId` index.

The implemented HTTP behavior is:

- `POST /families/:familyId/pregnancies` returns HTTP 201 with one minimum
  Pregnancy representation.
- `GET /families/:familyId/pregnancies` returns
  `{ "pregnancies": Pregnancy[] }`.
- `GET /families/:familyId/pregnancies/:pregnancyId` returns one minimum
  Pregnancy representation.
- `Pregnancy` contains only `id`, `familyId`, `displayName`, `createdAt`, and
  `updatedAt`.
- Unknown and inaccessible Family outcomes use the same `FAMILY_NOT_FOUND` HTTP
  404 response for create and list.
- Unknown, inaccessible, path-mismatched, and missing-Family direct Pregnancy
  lookups use the same `PREGNANCY_NOT_FOUND` HTTP 404 response.

Creation checks the persisted `familyId`/`userId` membership and writes the
Pregnancy in one serializable database transaction. List and direct-get queries
embed the authenticated User's persisted FamilyMembership scope. The repeatable
`pnpm test:pregnancy:postgres` command builds the repository, validates and
deploys all migrations to disposable PostgreSQL 16, runs the authentication,
Family, and Pregnancy runtime suites, and removes the container.
