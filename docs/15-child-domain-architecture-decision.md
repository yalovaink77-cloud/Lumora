# Child Domain Architecture Decision

Version: 1.4

Status: Approved — Sprint 2.6B Implemented; Sprint 2.6D Ready

Phase: MVP Domain Foundation

Decision date: 2026-07-21

Last amended: 2026-07-22

---

# 1. Purpose

Lumora's approved MVP includes creating a Child profile and organizing the
essential story of a Child within a Family context. The product principles and
domain model establish Child as an independent lifelong domain, but the approved
documentation did not originally define a concrete Child profile field, name
semantic, birth-related date, or update behavior.

This decision establishes every Child boundary supported by approved
documentation while keeping verified requirements separate from assumptions. It
does not copy Pregnancy fields merely because Pregnancy is already implemented.

Version 1.1 adds the approved minimum user-visible `displayName` field. Version
1.2 records that the field is mutable, changes its maximum to 80 Unicode code
points, and keeps mutation endpoints outside Sprint 2.6B. The resulting profile
is meaningfully recognizable without introducing legal identity, birth,
guardian, medical, demographic, or cross-domain data. Sprint 2.6B is ready
subject to the implementation gate in section 24.

Version 1.4 approves the smallest safe `displayName` mutation contract without
changing the Child entity, privacy boundary, or deferred domains. Sections 29
through 37 define the future implementation boundary.

---

# 2. Verified Requirements and Unsupported Assumptions

## Verified requirements

The approved documentation establishes that:

- Lumora is a lifelong family platform spanning pregnancy, childhood,
  adolescence, and adulthood.
- The MVP must allow a mother to create a Child profile.
- A Child must be represented clearly within a Family context.
- Child is an independent lifelong entity, not an extension of a User account.
- Child belongs to a Family.
- Family is the root aggregate and primary privacy boundary.
- FamilyMembership governs access to family-owned records.
- Child and Pregnancy are separate domains.
- A Child may originate from a Pregnancy only through a future explicit
  relationship.
- Child identity and record continuity must be preserved over time.
- Child-related information receives the highest level of care and caution.
- Child data exists to serve the Child's interests and continuity, not external
  exploitation.
- Child sensitivity must be preserved as the Child grows.
- Access must be limited through appropriate Family roles.
- A Child's history begins under guardian stewardship and eventually belongs to
  the adult, but the transition mechanics are not defined.
- Timeline, Health, and Media remain separate domains that may later reference a
  Child.
- Families and future adult Children retain privacy, export, deletion,
  portability, and continuity interests.
- Child records must never become authentication accounts or session payloads.
- Child has one approved minimum user-visible field, `displayName`.

## Unsupported assumptions

The approved documentation does not establish:

- a preferred name,
- a legal name,
- a nickname,
- a birth date or any other Child date,
- age, age calculation, or maturity state,
- sex, gender, pronouns, or demographic information,
- a profile image,
- a Child status or lifecycle vocabulary,
- a guardian, parent, or caregiver relationship record,
- a persisted Pregnancy relationship,
- which Family role may act as a guardian,
- how adult ownership begins or is proven,
- or the authority and API behavior for Child mutation other than the approved
  `displayName` contract, move, archive, or deletion operations.

Common conventions in child applications are not evidence that any of these
fields or behaviors are approved.

---

# 3. Decision

**Child is a separate lifelong, Family-owned domain whose access is authorized
through FamilyMembership.**

The following rules are approved:

- Every Child belongs to exactly one Family.
- A Child cannot exist outside a Family scope.
- A Family may contain multiple Child records; persistence must not impose a
  one-Child-per-Family constraint.
- Authentication identifies the caller.
- Persisted FamilyMembership authorizes access to the Family that owns the
  Child.
- A Child identifier alone never proves access.
- Cross-family access is denied by default.
- Child and Pregnancy remain separate records and packages.
- Child is not an authentication User, account, principal, or session.
- Child data must not be stored in Better Auth persistence or session payloads.
- Every Child has one required, user-provided `displayName`.
- No age, maturity, guardianship, medical fact, birth fact, or identity claim may
  be inferred from a Child record.

The domain boundary, minimum meaningful entity, authorization rules, privacy
requirements, and initial API behavior are approved. Sprint 2.6B is ready.

---

# 4. Child Aggregate Boundary

Child represents one independent lifelong Child record within one Family. It is
a Family-owned aggregate, not an extension of:

- an authentication User,
- a FamilyMembership,
- a guardian or parent record,
- a Pregnancy,
- or a future adult account.

Family owns the privacy scope. Child owns only behavior and data explicitly
assigned to the Child domain by an approved decision.

Child must not absorb:

- authentication identity or credentials,
- FamilyMembership roles,
- guardian or caregiver relationships,
- Pregnancy state or Pregnancy profile data,
- Timeline entries,
- Health records,
- Media metadata or files,
- school or government identifiers,
- development tracking,
- or AI-generated information.

Future domains may reference a Child by its stable identifier while remaining
separately owned and implemented.

---

# 5. Minimum Child Entity and Field Classification

The minimum Child entity contains only:

- a stable, opaque Child identifier,
- exactly one required Family identifier,
- a required human-readable `displayName`,
- creation time,
- and update time.

Field classification:

- `id` is required, system-generated, and immutable.
- `familyId` is required at creation and immutable. Moving a Child between
  Families is not approved.
- `createdAt` is required, system-generated, and immutable.
- `updatedAt` is required and system-managed. It may change only when a future
  approved operation changes an approved mutable field.
- `displayName` is required at creation, user-provided, normalized and validated
  according to section 6, and returned in every minimum Child representation.
  It is mutable through the contract approved in sections 29 through 37. No
  mutation endpoint was part of Sprint 2.6B.

No optional product field is approved.

`displayName` is the only mutable product field. Its mutation authority,
validation contract, and API behavior are defined in sections 29 through 37.

The technical timestamps are persistence history. They are not birth dates, age
evidence, lifecycle markers, or medical facts.

`displayName` is the only approved Child product field. No additional optional
or required product field may be added.

---

# 6. Approved `displayName` Decision

`displayName` is the minimum user-visible field that allows authorized Family
members to recognize a Child profile within its Family.

The following validation and persistence rules apply:

- it is user-provided,
- it is required when creating a Child,
- it must be a string,
- it is Unicode text,
- it is trimmed before validation and persistence,
- the trimmed value must be non-empty,
- the trimmed value must contain between 1 and 80 Unicode code points,
- a value containing exactly 80 Unicode code points is accepted,
- valid Unicode is accepted and preserved after trimming,
- duplicate values are allowed within one Family,
- it is not unique globally or within a Family,
- it has no system-generated default,
- it has no database default,
- it is mutable,
- and responses return the normalized persisted value.

`displayName` is only a recognizable presentation label inside the Family. It is
not:

- a legal name,
- a preferred-name assertion,
- a birth-certificate identity,
- proof of parenthood, guardianship, custody, or ownership,
- a determination of the Child's present or future identity,
- a medical, demographic, or lifecycle fact,
- or an external identifier.

No update or rename endpoint was approved for Sprint 2.6B. Sections 29 through
37 approve one future `displayName` mutation endpoint while preserving the
Child's lifelong record continuity and eventual adult ownership.

---

# 7. Presentation Label and Identity Semantics

`displayName` is not a Child name field. Its use does not assert that the value
is the Child's legal, preferred, given, family, nickname, or birth-certificate
name.

The documentation's requirement to preserve a Child's identity and continuity
does not approve:

- a legal name,
- a preferred name,
- a given name or family name,
- a nickname,
- a birth-certificate name,
- or any other identity field.

Identity continuity currently means that one stable Child record should persist
through future lifecycle and stewardship changes. It does not mean that the
system may infer or require legal or personal identity attributes.

`displayName` must retain presentation-label semantics as the Child grows. It
must not silently become a preferred name, legal identity, external identifier,
guardian claim, ownership claim, or determinant of the Child's future identity.

---

# 8. Birth-Related Dates, Age, and Lifecycle

No birth date or other Child date is approved for the MVP.

The domain model's statement that Child represents an individual "from birth"
describes the domain boundary. It does not approve storing:

- date of birth,
- time of birth,
- place of birth,
- expected or estimated birth date,
- conception or Pregnancy dates,
- age,
- corrected age,
- developmental age,
- or a source or confidence level for any date.

No age may be calculated from timestamps or another domain's data. Creation time
must never be presented as birth time.

No Child lifecycle or status enum is approved. The implementation must not
invent values such as newborn, infant, toddler, minor, adult, active, archived,
or deceased.

Age, maturity, legal capacity, and adulthood must not be inferred from elapsed
time. Future date or lifecycle behavior requires a separate product,
privacy, and legal-safety decision.

---

# 9. Family-Scoped Authorization

Every future Child operation requires:

1. an authenticated neutral principal,
2. an explicit Family context,
3. and a persisted FamilyMembership connecting that principal's User identifier
   to that Family.

During the current one-role Family foundation, every persisted membership is
explicitly `OWNER`. Persisted membership is sufficient for the approved Child
create, read, and `displayName` mutation operations. This does not:

- establish that `OWNER` is a parent or guardian,
- prove a legal relationship to the Child,
- define permissions for future roles,
- or authorize any other update, deletion, export, or ownership-transfer
  behavior.

The implementation must:

- derive the User identifier only from the authenticated principal,
- never accept client-supplied User identifiers, memberships, roles,
  guardianship, or ownership claims,
- scope every Child query through persisted FamilyMembership,
- verify that the Child's `familyId` matches the path Family,
- and enforce authorization on the server.

Membership in Family A grants no Child access in Family B, even when the same
User belongs to both Families.

Creation authorization and persistence must not contain a check-then-write gap.
A future implementation must use one serializable transaction or an equivalent
membership-scoped persistence operation.

---

# 10. Creation and Read API Behavior

Sprint 2.6B may expose only:

- `POST /families/:familyId/children`,
- `GET /families/:familyId/children`,
- `GET /families/:familyId/children/:childId`.

Required transport and authorization behavior:

- every endpoint requires authentication,
- the caller must have a persisted FamilyMembership in the path Family,
- creation derives Family ownership from the path and User identity from the
  authenticated principal,
- list returns only Children in the requested Family,
- a missing and inaccessible Family produce the same HTTP 404 behavior for
  create and list,
- a missing, inaccessible, path-Family-mismatched, or missing-Family direct
  Child lookup produces the same `CHILD_NOT_FOUND` HTTP 404 behavior,
- responses use deterministic shapes containing only approved Child fields,
- and responses contain no authentication, membership, guardian, User, account,
  cookie, token, session, medical, or unrelated data.

`POST /families/:familyId/children` accepts only:

```json
{
  "displayName": "..."
}
```

The POST body must strictly reject every unknown field, including:

- `familyId`,
- `userId`,
- membership or role claims,
- guardian or parent claims,
- Pregnancy linkage,
- birth dates or other dates,
- age or lifecycle status,
- medical, demographic, school, or government identifiers,
- and all unknown fields.

Every minimum Child response contains only:

- `id`,
- `familyId`,
- `displayName`,
- `createdAt`,
- and `updatedAt`.

The returned `displayName` is the trimmed persisted value. Successful creation,
list, and direct-get use the same minimum Child representation.

No global Child list, move, archive, deletion, transition, or
ownership-transfer endpoint is approved. The future `displayName` mutation
contract is defined separately in sections 29 through 37.

---

# 11. Authentication and Child Identity Boundary

Authentication and Child authorization remain separate:

- Better Auth authenticates the request and resolves the User.
- NestJS exposes the existing neutral authenticated principal.
- The Child application boundary receives only the principal's stable User
  identifier and explicit route identifiers.
- `@lumora/family` continues to own Family and FamilyMembership concepts.
- A future `@lumora/child` package will own approved Child rules and application
  contracts.
- `@lumora/database` remains the sole Prisma Client, schema, migration, and
  persistence owner.
- `apps/api` composes authentication, Family authorization, Child behavior,
  persistence, and HTTP transport.

Child code must not depend on Better Auth runtime types, cookies, session tokens,
account records, password records, or provider identifiers.

A Child record must never become a login account. Future adult ownership must
not be implemented by mutating the Child into a Better Auth User or by deleting
and recreating the Child record.

No Child identifier or Child information may be placed in an authentication
session.

---

# 12. Package, Database, and API Ownership

## `packages/child`

Sprint 2.6B may create `@lumora/child`, which will own:

- approved Child domain concepts,
- Child input validation,
- Family-scoped Child repository contracts,
- creation, read, and approved `displayName` mutation application behavior,
- and behavior independent of NestJS, Better Auth, Prisma, and
  `@lumora/database`.

## `@lumora/database`

`@lumora/database` remains the sole owner of:

- Prisma Client,
- schema and migrations,
- database connection lifecycle,
- FamilyMembership-scoped persistence queries,
- and future Child persistence implementations.

No Child package or application may create another Prisma Client or duplicate
Prisma configuration.

## `@lumora/family`

The Family package continues to own Family and FamilyMembership concepts. Child
must not redefine membership, roles, guardianship, invitations, or permissions.

## `apps/api`

The API owns HTTP transport, authentication guards, neutral principal
resolution, dependency composition, and safe HTTP error mapping. Child business
rules must not be placed in controllers.

---

# 13. Child Privacy and Heightened Sensitivity

The existence and details of a Child record are sensitive family information.
Child-related information receives the highest level of care and caution even
when the minimum profile contains no Health data.

The implementation must:

- collect only approved data needed for documented value,
- keep Child information private by default,
- minimize response, log, cache, analytics, and replication exposure,
- preserve sensitivity as the Child grows,
- prevent enumeration across Family boundaries,
- and avoid unnecessary retention.

The minimum Child profile must not contain medical, development, education,
government, demographic, or behavioral information.

Future Health data may require stricter permissions than the baseline Child
profile. Child must not become a shortcut Health table.

---

# 14. Guardian Stewardship and Eventual Adult Ownership

The continuity documentation approves the following philosophy:

- a Child's history begins under guardian stewardship within the Family
  boundary,
- control should shift as the Child matures,
- the adult ultimately owns their own history,
- record continuity must survive the transition,
- and permission changes, not record deletion and recreation, should express
  the transition.

This philosophy does not approve implementation mechanics.

The current Family `OWNER` role is not proof of parenthood, guardianship, legal
authority, or future adult ownership. Creating, reading, or mutating a Child
`displayName` under an `OWNER` membership must not create a persisted guardian
relationship.

Sprint 2.6B must not introduce:

- guardian records,
- parent or caregiver relationships,
- age thresholds,
- legal-capacity rules,
- an adult-ownership flag,
- a Child-to-User ownership link,
- account conversion,
- permission transfer,
- or succession workflows.

The stable Child identifier and non-destructive record model must preserve room
for a future approved guardian-to-adult permission transition without
anticipating its mechanics.

---

# 15. Relationship to Pregnancy

Child and Pregnancy remain separate domains and records.

The approved architecture permits a Child to originate from or be linked with a
Pregnancy, but it does not define:

- whether linkage is required or optional,
- cardinality,
- who may create or change the link,
- whether Child creation and linkage are one operation,
- how duplicate linkage is prevented,
- what a transition means for Pregnancy state,
- or deletion and retention effects.

Sprint 2.6B must not:

- accept `pregnancyId`,
- add a Pregnancy foreign key to Child,
- create a Child automatically from Pregnancy,
- infer birth or Pregnancy completion,
- copy Pregnancy fields into Child,
- modify or delete a Pregnancy,
- or create conversion, transition, or birth endpoints.

A future relationship must be explicit, non-destructive, Family-consistent, and
safe against duplicate or cross-Family linkage.

---

# 16. Relationship to Future Timeline, Health, and Media

## Timeline

Child may later be the subject of Timeline entries. Sprint 2.6B must not create
Timeline fields, events, tables, APIs, or an embedded chronological history.

## Health

Health information relevant to a Child belongs to the separate Health domain.
Sprint 2.6B must not add medical records, measurements, vaccinations,
appointments, medications, diagnoses, feeding, sleep, or development data.

## Media

Media may later be associated with a Child through separately approved
relationships. Sprint 2.6B must not add images, profile photos, media
identifiers, metadata, files, storage, or attachments.

All future relationships must preserve Family scope and must never connect
records owned by different Families.

---

# 17. Validation Requirements

The following validation rules are approved for creation and `displayName`
mutation:

- request bodies must reject unknown fields,
- `displayName` must be present,
- `displayName` must be a string,
- `displayName` must be trimmed before validation and persistence,
- the trimmed `displayName` must not be empty,
- the trimmed `displayName` must contain between 1 and 80 Unicode code points,
- a `displayName` containing exactly 80 Unicode code points must be accepted,
- valid Unicode must be accepted and preserved after trimming,
- duplicate `displayName` values must be accepted within one Family,
- `displayName` must not have a system-generated or database default,
- path Family and Child identifiers are opaque identifiers,
- client-supplied User identifiers, membership claims, role claims, guardian
  claims, and ownership claims are rejected,
- `familyId` comes only from the route,
- a Child references exactly one existing Family,
- and cross-Family relationships are rejected.

No validation rule may infer age, maturity, birth facts, guardianship, legal
identity, or medical meaning.

---

# 18. Deletion, Export, Retention, Continuity, and Acquisition

Child records are subject to the approved ownership, export, deletion,
portability, controlled-shutdown, and lifelong-continuity principles.

The foundation must preserve those principles by:

- keeping every Child unambiguously scoped to one Family,
- using a stable, provider-neutral Child identifier,
- preserving one continuous Child record through future stewardship changes,
- avoiding proprietary, medical, legal, or authentication ownership keys,
- allowing a future complete export to include Child records and their approved
  relationships,
- and keeping infrastructure replaceable.

No Child deletion endpoint is approved. Child deletion semantics, Family
deletion effects, adult authority, guardian authority, legal retention, export
format, export completeness, export authority, and relationship cleanup remain
unresolved.

An initial Child foreign key must not silently delete Child data because a
Family or authentication User is deleted. Until deletion semantics are
approved, persistence must use restrictive Family referential behavior rather
than destructive cascade.

Retention must not be interpreted as indefinite retention by default. Child data
must be preserved for continuity only within future approved retention and user
control rules.

An acquisition, operator change, bankruptcy, or shutdown must not:

- broaden Child visibility,
- weaken the Family boundary,
- convert Child data into a commercial asset,
- disrupt eventual adult ownership,
- or remove export, deletion, portability, and continuity rights.

---

# 19. Migration Expectations

Sprint 2.6B's first Child migration must:

- be additive,
- use a truthful 2026 identifier,
- leave existing authentication, Family, and Pregnancy migrations unchanged,
- introduce only the approved minimum Child persistence,
- require exactly one valid Family relationship,
- persist a required `displayName` with capacity for at most 80 Unicode code
  points,
- require callers to provide `displayName` explicitly rather than assigning a
  system or database default,
- avoid unique constraints on `displayName`,
- add only indexes needed for Family-scoped list and direct lookup,
- avoid uniqueness constraints limiting a Family to one Child,
- use restrictive Family deletion behavior,
- avoid Pregnancy, Timeline, Health, Media, guardian, User-ownership, and
  authentication relationships,
- and apply successfully to clean and existing Pregnancy-foundation databases.

Migration verification must use disposable PostgreSQL and include schema
validation, migration deployment, referential-integrity checks, Family-scoped
runtime queries, cleanup, and regression verification of authentication,
Family, and Pregnancy behavior.

Existing migrations must not be modified or replaced.

---

# 20. Required Tests for Sprint 2.6B

Sprint 2.6B must include:

- unit tests for approved Child creation invariants,
- validation tests rejecting a missing `displayName`,
- validation tests rejecting a non-string `displayName`,
- validation tests rejecting an empty or whitespace-only `displayName`,
- validation tests proving trimming occurs before persistence and response
  mapping,
- validation tests accepting and preserving valid Unicode,
- validation tests accepting exactly 80 Unicode code points,
- validation tests rejecting more than 80 Unicode code points,
- validation tests rejecting unknown request fields,
- tests proving duplicate `displayName` values are allowed within one Family,
- tests proving `displayName` has no system or database default,
- tests proving every Child belongs to exactly one Family,
- tests proving multiple Children may belong to one Family,
- unauthenticated HTTP 401 tests for all three endpoints,
- authenticated create, list, and direct-get tests,
- tests proving creator identity cannot be supplied by the client,
- tests proving guardian, ownership, Pregnancy, date, status, and unknown fields
  are rejected,
- two-User and two-Family isolation tests,
- tests proving one User's memberships in multiple Families remain independently
  scoped,
- tests proving missing and inaccessible Families share the same HTTP 404
  behavior,
- tests proving missing, inaccessible, path-Family-mismatched, and
  missing-Family direct Child lookups share the same HTTP 404 behavior,
- response-shape and sensitive-field exclusion tests,
- tests proving Family deletion is restricted while Child records exist,
- tests proving authentication User deletion cannot indirectly delete Child
  records,
- persistence tests proving all reads are FamilyMembership-scoped,
- tests proving authorization and creation persistence have no check-then-write
  gap,
- architecture tests proving `@lumora/child` is independent of NestJS, Better
  Auth, Prisma, and `@lumora/database`,
- migration deployment tests against disposable PostgreSQL,
- cleanup tests that leave no persistent fixture data,
- and regression tests for authentication, Family, and Pregnancy behavior.

No test may encode an unapproved name semantic, birth date, age calculation,
guardian relationship, lifecycle state, medical conclusion, or
Pregnancy-to-Child transition.

---

# 21. Explicit Exclusions

The following are outside this decision and Sprint 2.6B:

- legal, given, family, preferred, or nickname fields,
- Child product fields other than `displayName`,
- birth date, birth time, birth place, age, or maturity,
- sex, gender, pronouns, demographic, nationality, ethnicity, or language data,
- profile photo or avatar,
- Child status or lifecycle fields,
- school, government, insurance, or external identifiers,
- guardian, parent, caregiver, custody, or consent records,
- Child-to-User ownership linkage,
- guardian-to-adult transition implementation,
- Pregnancy linkage, conversion, or transition,
- Timeline entries or events,
- Health records,
- medical measurements,
- vaccinations,
- feeding, sleep, growth, or development tracking,
- appointments, reminders, or notifications,
- Media or file attachments,
- AI features,
- Child mutation endpoints other than the approved `displayName` mutation,
- Child move, archive, or deletion endpoints,
- export implementation,
- retention implementation,
- membership management or new Family roles,
- mobile UI,
- admin UI,
- analytics or social features,
- and Better Auth changes.

These exclusions must not be anticipated through speculative columns, enums,
relationships, APIs, or package abstractions.

---

# 22. Unresolved Decisions

The following require narrow approved decisions before their respective
implementation:

1. Whether any birth-related date belongs in the MVP and its exact semantics.
2. Child lifecycle or status vocabulary, if required.
3. Guardian, parent, caregiver, consent, and custody relationships.
4. Permissions for future FamilyMembership roles.
5. Guardian-to-adult ownership transition, legal thresholds, authority, and
   account association.
6. Pregnancy-to-Child relationship, cardinality, authority, and lifecycle
   effects.
7. Child deletion, Family deletion effects, retention, and relationship cleanup.
8. Export format, completeness, guardian authority, adult authority, and legal
   retention.
9. Timeline, Health, and Media relationships.

None of these decisions blocks the approved minimum create-and-read vertical or
the `displayName` mutation contract in sections 29 through 37. Their associated
behavior must stay excluded until separately approved.

---

# 23. Proposed Sprint 2.6B Scope

Sprint 2.6B may implement only:

- `packages/child` with infrastructure-independent domain contracts and
  validation,
- the approved minimum Child fields `id`, `familyId`, `displayName`,
  `createdAt`, and `updatedAt`,
- required, user-provided, trimmed, non-empty `displayName` persistence with a
  maximum of 80 Unicode code points, no uniqueness constraint, and no default,
- one additive Prisma migration owned by `@lumora/database`,
- one required Family relationship with restrictive deletion behavior,
- FamilyMembership-scoped creation, list, and direct lookup,
- the three nested Family/Child HTTP endpoints from section 10,
- deterministic minimum response shapes,
- focused validation, authorization, privacy, and cross-family isolation tests,
- disposable PostgreSQL migration and runtime verification,
- regression verification of authentication, Family, and Pregnancy,
- and truthful implementation documentation.

Sprint 2.6B must not implement any explicit exclusion or unresolved behavior.

---

# 24. Sprint 2.6B Implementation Gate

Sprint 2.6B is ready.

Implementation may begin only when all of the following are true:

- this decision remains approved,
- `displayName` remains the only Child product field,
- `displayName` remains required, user-provided, mutable, normalized,
  non-unique, and without a system or database default,
- request and response shapes remain limited to section 10,
- no Child update or rename endpoint is included,
- the resulting Child entity is meaningfully recognizable within a Family,
- `displayName` remains only a presentation label and does not become a legal,
  preferred-name, guardian, ownership, or future-identity claim,
- no birth-related date, age, guardian, medical, demographic, Pregnancy, or
  cross-domain field is assumed,
- FamilyMembership-scoped authorization remains mandatory,
- Child and Pregnancy remain separate,
- the planned schema and API contain no excluded domain,
- the implementation plan fits section 23,
- and the repository is clean and verified.

The approved `displayName` makes the minimum Child entity meaningfully usable
without weakening lifelong continuity or eventual adult ownership.

---

# 25. Security Invariants

The eventual implementation must:

- deny cross-family Child access by default,
- require authentication and persisted FamilyMembership for every operation,
- derive User identity only from the authenticated principal,
- never trust client-supplied membership, role, guardian, or ownership claims,
- never treat a Child identifier as proof of access,
- never reveal Child existence through differing inaccessible and unknown
  responses,
- never place Child data in authentication sessions,
- never expose credentials, accounts, cookies, or raw session tokens,
- never treat `displayName` as a legal name, preferred-name assertion,
  birth-certificate identity, guardian claim, ownership claim, future-identity
  determination, medical fact, demographic fact, lifecycle fact, or external
  identifier,
- never infer age, maturity, guardianship, legal identity, birth facts, medical
  facts, lifecycle states, or outcomes,
- never connect Child to records in another Family,
- never convert a Child record into a login account,
- never allow authentication User deletion to silently destroy Child data,
- and never allow Family deletion to silently cascade Child data before
  deletion semantics are approved.

---

# 26. Future Review Triggers

Review this decision when:

- `displayName` replacement, semantic expansion, or a second mutation contract
  is proposed,
- any name, date, age, demographic, or lifecycle field is proposed,
- Child update or deletion behavior is proposed,
- guardian or caregiver authorization is designed,
- guardian-to-adult ownership transition is designed,
- Pregnancy-to-Child linkage is designed,
- Timeline, Health, or Media first references Child,
- additional FamilyMembership roles are approved,
- export or legal-retention requirements become concrete,
- or privacy, child-safety, continuity, succession, or acquisition obligations
  change.

---

# 27. References

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
- `docs/14-pregnancy-domain-architecture-decision.md`
- `docs/99-deferred-decisions.md`

---

# 28. Sprint 2.6B Implementation Record

Status: Implemented

The minimum Child vertical is implemented with these boundaries:

- `@lumora/child` owns strict Zod input validation, Child contracts, repository
  contracts, and infrastructure-independent application behavior.
- `@lumora/database` owns the Prisma model, additive migration, shared-client
  repository, serializable creation transaction, and membership-scoped queries.
- `apps/api` composes the existing authentication guard, neutral principal,
  Child application service, persistence, deterministic responses, and safe
  HTTP errors.

The additive migration creates only `child` with `id`, `familyId`,
`displayName`, `createdAt`, and `updatedAt`. The Family foreign key uses
restrictive deletion behavior, `displayName` is required `VARCHAR(80)` without a
default or uniqueness constraint, and the Family-scoped list path has one
`familyId` index.

The implemented HTTP behavior is:

- `POST /families/:familyId/children` returns HTTP 201 with one minimum Child
  representation.
- `GET /families/:familyId/children` returns `{ "children": Child[] }`.
- `GET /families/:familyId/children/:childId` returns one minimum Child
  representation.
- Child responses contain only `id`, `familyId`, `displayName`, `createdAt`, and
  `updatedAt`.
- Unknown and inaccessible Family outcomes use the same `FAMILY_NOT_FOUND` HTTP
  404 response for create and list.
- Unknown, inaccessible, path-mismatched, and missing-Family direct Child
  lookups use the same `CHILD_NOT_FOUND` HTTP 404 response.
- No update, rename, or deletion endpoint is implemented.

Creation checks the persisted `familyId` and authenticated `userId` membership
and writes the Child in one serializable database transaction. List and
direct-get queries embed the authenticated User's persisted FamilyMembership
scope. The repeatable `pnpm test:child:postgres` command builds the repository,
validates and deploys all migrations to disposable PostgreSQL 16, runs the
authentication, Family, Pregnancy, and Child runtime suites, and removes the
container.

---

# 29. Child `displayName` Mutation Decision

Child `displayName` mutation is approved for one future implementation sprint.

The mutation changes only the normalized `displayName` and system-managed
`updatedAt` of one existing Child. It must not:

- change `id`, `familyId`, or `createdAt`,
- add another Child field,
- move the Child to another Family,
- change the presentation-label semantics of `displayName`,
- create a guardian, ownership, legal-identity, or authentication relationship,
- or trigger behavior in Pregnancy or another domain.

The approved endpoint is:

`PATCH /families/:familyId/children/:childId`

`PATCH` is used because the operation changes one approved mutable field rather
than replacing the Child resource. No general-purpose Child update endpoint is
approved.

---

# 30. HTTP Request, Response, and Error Contract

The request body must contain exactly:

```json
{
  "displayName": "..."
}
```

`displayName` is required even though the HTTP method is `PATCH`. An empty body
is invalid. The body must strictly reject every unknown field, including:

- `id`,
- `familyId`,
- `childId`,
- `createdAt`,
- `updatedAt`,
- `userId`,
- membership or role claims,
- guardian, parent, custody, or ownership claims,
- legal or preferred names,
- birth, age, demographic, lifecycle, or medical data,
- Pregnancy linkage,
- and all other fields.

A successful mutation returns HTTP 200 with the same minimum Child
representation used by create and direct get:

```json
{
  "id": "...",
  "familyId": "...",
  "displayName": "...",
  "createdAt": "...",
  "updatedAt": "..."
}
```

The response returns the normalized persisted `displayName`. It contains no
wrapper object and no authentication, membership, User, role, guardian,
ownership, account, cookie, token, session, legal, medical, or unrelated data.

Validation failures return HTTP 400 using the established Child validation
codes:

- `DISPLAY_NAME_REQUIRED`,
- `DISPLAY_NAME_INVALID`,
- `DISPLAY_NAME_TOO_LONG`,
- or `UNKNOWN_FIELD`.

Validation errors must use a deterministic generic message and must not echo the
submitted value or request body.

Unauthenticated requests return HTTP 401 through the existing authentication
guard.

Every unavailable scoped target returns the same HTTP 404 response:

```json
{
  "statusCode": 404,
  "code": "CHILD_NOT_FOUND",
  "message": "Child not found."
}
```

This one response applies when:

- the Family does not exist,
- the Family exists but is inaccessible to the caller,
- the Child does not exist,
- the Child exists but is inaccessible to the caller,
- the Child belongs to a different Family than `familyId`,
- or the Family/Child combination does not exist.

The mutation endpoint must not return `FAMILY_NOT_FOUND`, HTTP 403, or another
distinguishing response for these cases.

---

# 31. Validation and Normalization

Mutation uses the same `displayName` value rules as creation:

- the input is required,
- the input must be a string,
- leading and trailing whitespace is trimmed before validation and persistence,
- the trimmed value must contain between 1 and 80 Unicode code points,
- exactly 80 Unicode code points are accepted,
- more than 80 Unicode code points are rejected,
- valid Unicode is accepted and preserved after trimming,
- duplicate values remain allowed within one Family,
- no global or Family-scoped uniqueness check is performed,
- no default is applied,
- and the normalized value is the only client-provided value persisted.

The operation must not normalize case, collapse internal whitespace,
transliterate text, infer a legal or preferred name, or derive a value from
authentication User data.

---

# 32. Authentication and Authorization

The mutation requires:

1. an authenticated neutral principal,
2. the explicit path `familyId`,
3. the explicit path `childId`,
4. a persisted FamilyMembership connecting the principal's User identifier to
   the path Family,
5. and a Child whose persisted `id` and `familyId` match both path identifiers.

The User identifier comes only from the authenticated principal. The operation
must never accept or trust client-supplied User, membership, role, guardian,
custody, or ownership claims.

During the current one-role Family foundation, persisted membership is
sufficient to mutate `displayName`. This authorizes only the presentation-label
mutation defined here. It does not establish parenthood, guardianship, custody,
ownership, or authority for any deferred Child behavior.

Future FamilyMembership roles must not inherit this permission automatically.
Their mutation permissions require a separate role decision.

A Family identifier or Child identifier alone never grants access.

---

# 33. Persistence, Transaction, and Concurrency

Authorization lookup and mutation must be one atomic
FamilyMembership-scoped persistence operation. A check-then-update gap is not
allowed.

An implementation may use:

- one database statement that scopes the update by authenticated User,
  `familyId`, `childId`, and persisted FamilyMembership,
- or one serializable transaction containing the membership-scoped target
  lookup and update.

If multiple statements are required, they must execute in one serializable
transaction so membership removal, Family changes, or concurrent writes cannot
turn a previously checked authorization result into an unsafe update.

No schema change, new index, migration, history table, version column, or
updated-by relationship is required or approved.

No optimistic-concurrency precondition, ETag, `If-Match` header, revision
number, or client-supplied `updatedAt` is approved. Concurrent valid updates use
last-successful-commit-wins semantics. Each successful response must represent
the value committed by that request. Transaction serialization conflicts may be
retried only through a bounded infrastructure policy and must never be converted
into a false 404 or validation result.

If bounded retries are exhausted, the API returns a generic HTTP 500
infrastructure failure without Child data or submitted values. A new HTTP 409
contract is not approved.

The mutation must not create a Child when the scoped target is absent. Upsert is
not approved.

---

# 34. `updatedAt` Behavior

`updatedAt` remains system-managed and cannot be supplied by the client.

Every successfully persisted `displayName` mutation refreshes `updatedAt` to the
database write time and returns that persisted value. `id`, `familyId`,
`createdAt`, and all other persistence values remain unchanged.

A request whose normalized `displayName` equals the current persisted value is
valid. It is treated as a successful mutation, refreshes `updatedAt`, and
returns HTTP 200. This avoids adding comparison, conditional-request, or
no-operation semantics to the minimum contract.

Failed authentication, validation, authorization, missing-resource,
transaction, or persistence outcomes must not change `displayName` or
`updatedAt`.

`updatedAt` is persistence history only. It is not a birth, age, maturity,
lifecycle, guardian, ownership, medical, or identity timestamp.

---

# 35. Privacy, Logging, and Sensitive Output

`displayName` remains heightened-privacy Child data before, during, and after
mutation.

The future implementation must:

- keep request and response bodies out of routine application logs,
- never log the submitted or persisted `displayName`,
- avoid logging Family or Child identifiers except where a separately approved
  secure operational policy requires them,
- use request correlation metadata that does not contain Child data,
- never place Child data in authentication sessions, cookies, tokens, cache
  keys, analytics events, or authentication persistence,
- never expose credentials, password data, account records, cookies, raw
  session tokens, or Better Auth internals,
- never echo rejected input in errors,
- preserve the deterministic 404 boundary across inaccessible and unknown
  targets,
- and return only the minimum Child representation on success.

The endpoint must not emit an audit event until audit-event contents, access,
retention, and privacy handling are separately approved. This does not prevent
minimal infrastructure metrics that contain no Child data or Family/Child
identifiers.

---

# 36. Package, API, Persistence, and Test Responsibilities

## `@lumora/child`

The Child package will own:

- the strict `displayName` mutation input contract,
- normalization and validation,
- infrastructure-independent mutation application behavior,
- and the FamilyMembership-scoped repository mutation contract.

It must remain independent of NestJS, Better Auth, Prisma, and
`@lumora/database`.

## `@lumora/database`

The database package will own:

- the atomic membership-scoped mutation implementation,
- transaction and concurrency behavior,
- persisted outcome mapping,
- and shared Prisma Client use.

The implementation must use the existing Child model. No schema or migration
change is approved.

## `apps/api`

The API will own:

- the nested `PATCH` route,
- the existing authentication guard and neutral principal resolution,
- dependency composition,
- HTTP 200, 400, 401, and identical 404 mapping,
- and minimum response serialization.

Controllers must not own Child normalization, validation, authorization, or
persistence rules.

## Required future tests

The implementation sprint must include:

- missing, non-string, empty, and whitespace-only `displayName` validation,
- trimming and persisted normalized response behavior,
- valid Unicode behavior,
- exactly 80 and more than 80 Unicode code-point boundaries,
- duplicate `displayName` values within one Family,
- strict unknown-field rejection for every ownership and deferred-domain field,
- unauthenticated HTTP 401 behavior,
- authenticated successful mutation,
- same-normalized-value mutation and `updatedAt` refresh behavior,
- immutable `id`, `familyId`, and `createdAt` behavior,
- tests proving `familyId`, `childId`, `updatedAt`, and User identity cannot be
  supplied through the body,
- membership-scoped lookup and atomic mutation tests,
- two-User/two-Family isolation,
- one User with multiple Family memberships remaining correctly scoped,
- identical 404 bodies for missing, inaccessible, and path-mismatched targets,
- no upsert behavior,
- concurrent valid mutation behavior,
- failed-mutation atomicity,
- response-shape and sensitive-field exclusion,
- log checks excluding `displayName`, passwords, and raw session tokens,
- architecture tests preserving package independence and one Prisma Client
  owner,
- disposable PostgreSQL runtime verification,
- cleanup,
- and regression verification of authentication, Family, Pregnancy, and Child
  create/read behavior.

---

# 37. Explicit Exclusions and Sprint 2.6D Gate

The mutation decision does not approve:

- another Child field,
- a general Child update endpoint,
- changing `id`, `familyId`, `createdAt`, or client-supplying `updatedAt`,
- moving a Child between Families,
- bulk mutation,
- upsert,
- mutation history or audit events,
- legal, verified, preferred, given, family, nickname, or birth-certificate
  names,
- birth date, age, sex, gender, demographic, guardian, custody, ownership,
  medical, school, identifier, or lifecycle data,
- Pregnancy linkage or transition,
- Timeline, Health, Media, AI, reminder, notification, or cross-domain
  workflows,
- deletion, archive, export, retention, succession, or adult-ownership transfer,
- new Family roles, membership management, or a general permission engine,
- mobile or admin UI,
- or Better Auth changes.

These exclusions remain deferred and must not be anticipated through request
fields, response fields, columns, relationships, events, abstractions, or side
effects.

This decision unblocks exactly:

**Sprint 2.6D — Minimum Child `displayName` Mutation Vertical**

Sprint 2.6D may implement only:

- the strict mutation validation contract in `@lumora/child`,
- one FamilyMembership-scoped repository mutation operation,
- `PATCH /families/:familyId/children/:childId`,
- the minimum HTTP response and deterministic errors in section 30,
- system-managed `updatedAt` behavior,
- the tests listed in section 36,
- disposable PostgreSQL verification without a migration,
- regression verification of existing domains,
- and truthful implementation documentation.

Implementation may begin only if the repository is clean, this decision remains
approved, the endpoint requires no schema change, and no excluded or unresolved
domain behavior is introduced.
