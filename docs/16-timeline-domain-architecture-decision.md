# Timeline Domain Architecture Decision

Version: 1.1

Status: Approved — Sprint 2.7B Implemented

Phase: MVP Domain Foundation

Decision date: 2026-07-22

Version 1.1 records the verified Sprint 2.7B implementation in section 30.

---

# 1. Purpose

Lumora's approved MVP must allow authorized Family members to record meaningful
events for a Pregnancy or Child and view those events chronologically.

The existing domain model establishes Timeline at a high level but does not
define a minimum event, chronology semantics, subject invariants, API contract,
authorization behavior, persistence boundary, or implementation gate.

This decision defines the smallest safe Timeline create-and-read vertical. It
does not promote Timeline into a central cross-domain event platform and does
not introduce Media, Health, AI, notifications, Pregnancy-to-Child transition,
or another deferred domain.

---

# 2. Verified Requirements, Approved Decisions, and Unsupported Assumptions

## Verified requirements

The approved documentation establishes that:

- the MVP includes recording Timeline events,
- the MVP includes viewing Timeline events chronologically,
- a meaningful Pregnancy or Child story requires chronological entries,
- Timeline is a separate domain,
- Family is the root aggregate and primary privacy boundary,
- Timeline data is scoped to one Family,
- FamilyMembership controls access to Family-owned information,
- Timeline may concern a Pregnancy or Child,
- Pregnancy and Child remain separate domains,
- Timeline may preserve continuity across lifecycle stages without merging
  Pregnancy and Child,
- Child and Pregnancy information is sensitive and private by default,
- medical statements must not be treated as verified clinical facts,
- user data must remain portable and usable through future export,
- and implementation must follow an approved decision.

## Approved product decisions

This decision records the following approved product choices:

- every Timeline event belongs to exactly one Family,
- Family is not a Timeline subject in the MVP,
- every event targets exactly one existing Pregnancy or one existing Child,
- an event never targets both subjects and never targets neither,
- the subject belongs to the same Family as the event,
- `title` and `occurredAt` are the only user-provided event fields,
- Pregnancy and Child events have separate nested paths,
- events are listed only for one subject,
- ordering is `occurredAt` descending, then `createdAt` descending, then `id`
  descending,
- and the first vertical has no update, delete, reassignment, upsert, combined
  feed, or pagination behavior.

## Unsupported assumptions

The documentation does not approve:

- a note, body, or description,
- category, event type, taxonomy, icon, or color,
- location,
- author attribution or `createdBy`,
- event verification,
- a medical classification,
- a system-generated diagnosis or milestone,
- recurring events,
- Media attachments,
- Health records,
- reminders or notifications,
- AI-generated content,
- a Family-wide combined Timeline feed,
- a Pregnancy-and-Child combined feed,
- Pregnancy-to-Child linkage,
- Timeline mutation or deletion,
- pagination,
- export format or retention mechanics,
- or Timeline as a central event layer.

These concepts must not be inferred from common Timeline products.

---

# 3. Decision

**Timeline is a Family-owned domain of user-authored historical statements,
where each event belongs to exactly one Pregnancy or one Child and is read only
through that subject's nested Family path.**

The minimum vertical must:

- authenticate every request,
- authorize through persisted FamilyMembership,
- validate Family and subject ownership,
- prevent cross-Family subject references,
- preserve Pregnancy and Child as independent domains,
- expose separate Pregnancy and Child paths,
- return only minimum event data,
- order each subject's events deterministically,
- and preserve privacy, medical safety, portability, and continuity.

Sprint 2.7B is implemented according to the gate in section 24 and recorded in
section 30.

---

# 4. Timeline Aggregate and Minimum Entity

One Timeline event represents one user-authored statement that something
meaningful occurred for one Pregnancy or Child.

The minimum persistence identity contains:

- `id`,
- `familyId`,
- exactly one of `pregnancyId` or `childId`,
- `title`,
- `occurredAt`,
- `createdAt`,
- and `updatedAt`.

Field classification:

- `id` is required, opaque, system-generated, and immutable.
- `familyId` is required and immutable.
- `pregnancyId` is required only for a Pregnancy event and immutable.
- `childId` is required only for a Child event and immutable.
- `title` is required and user-provided.
- `occurredAt` is required and user-provided.
- `createdAt` is required, system-generated, and immutable.
- `updatedAt` is required and system-managed. No approved operation changes an
  event in the first vertical, so it initially equals persistence update history
  only and must not be exposed as another event date.

There is no optional product field in the minimum entity.

---

# 5. Ownership and Subject Invariants

Every Timeline event must satisfy all of these invariants:

1. it belongs to exactly one existing Family,
2. it targets exactly one existing Pregnancy or exactly one existing Child,
3. it never targets both,
4. it never targets neither,
5. its subject belongs to the same Family,
6. and its subject type and identifier never change.

Family owns the event's privacy and authorization scope. Family is not a direct
event subject in the MVP.

A Pregnancy event and Child event remain independent records. Timeline must not:

- convert a Pregnancy into a Child,
- infer that a birth or transition occurred,
- link Pregnancy and Child,
- copy fields between them,
- change either subject,
- or imply that events for separate subjects describe the same real-world
  occurrence.

The invariant applies in domain contracts, persistence, queries, migrations,
tests, and HTTP composition.

---

# 6. `title` Semantics and Validation

`title` is a short user-provided label describing the event.

The following rules apply:

- it is required,
- it must be a string,
- it is Unicode text,
- ill-formed Unicode surrogate sequences are rejected,
- null code point `U+0000` is rejected because PostgreSQL text cannot store it,
- leading and trailing whitespace is trimmed before validation and persistence,
- the trimmed value must contain between 1 and 80 Unicode code points,
- exactly 80 Unicode code points are accepted,
- more than 80 Unicode code points are rejected,
- valid Unicode and internal whitespace are preserved,
- duplicate titles are allowed for one subject and within one Family,
- it is not unique,
- it has no system or database default,
- case is preserved,
- and responses return the normalized persisted value.

The 80-code-point limit is the smallest existing repository convention for a
short user-recognizable label and minimizes collection of sensitive Timeline
content.

For the MVP, “meaningful after trimming” means non-empty after trimming. The
system must not attempt language-dependent semantic scoring, punctuation
judgment, medical classification, or identity verification.

`title` is plain text. Clients must render it as text, not executable HTML or
Markdown. The service does not interpret markup, infer structured meaning, or
transform it into Health data.

Persistence uses a required `VARCHAR(80)` column with no default or uniqueness
constraint. Domain validation remains authoritative for the Unicode-code-point
rule.

`title` is not:

- a medically verified fact,
- a diagnosis,
- a treatment recommendation,
- an identity field,
- a lifecycle status,
- a developmental classification,
- or a system-generated conclusion.

---

# 7. `occurredAt` Semantics, Format, and Timezone

`occurredAt` represents when the user says the event occurred.

It may differ from `createdAt`. It is not derived from event creation time,
Pregnancy data, Child data, another event, or a server inference.

## Accepted API input

The request value must be a string in this exact RFC 3339 profile:

```text
YYYY-MM-DDTHH:mm:ss.SSSZ
YYYY-MM-DDTHH:mm:ss.SSS±HH:mm
```

The accepted lexical shape is:

```text
^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}(?:Z|[+-]\d{2}:\d{2})$
```

Additional validation must reject:

- nonexistent Gregorian calendar dates,
- years outside `0001` through `9999`,
- values whose UTC normalization falls outside years `0001` through `9999`,
- hours outside `00` through `23`,
- minutes or seconds outside `00` through `59`,
- leap-second value `60`,
- numeric offsets outside `-14:00` through `+14:00`,
- offsets with non-zero minutes when the offset hour is `14`,
- negative zero offset `-00:00`,
- date-only input,
- local date-time input without an offset,
- space in place of uppercase `T`,
- lowercase `z`,
- fractional precision other than exactly three digits,
- and expanded or signed years.

`Z` and `+00:00` both represent UTC. A valid non-zero numeric offset is applied
when converting the instant to UTC. The original textual offset is not retained
as a separate field.

The MVP does not reject a value solely because it is before or after the server
clock. The value remains a user statement and must not trigger lifecycle,
medical, developmental, Pregnancy, age, or status inference.

## Persistence

`occurredAt` is persisted as a timezone-aware PostgreSQL instant with
millisecond precision. The intended Prisma native representation is
`DateTime @db.Timestamptz(3)` or an equivalent timezone-aware mapping owned by
`@lumora/database`.

Persistence normalizes the instant to UTC. No separate timezone, offset, locale,
or precision field is approved.

## API serialization

Responses serialize `occurredAt` in canonical UTC with exactly three
millisecond digits:

```text
YYYY-MM-DDTHH:mm:ss.SSSZ
```

`createdAt` and `updatedAt` continue to use the repository's existing ISO 8601
UTC serialization convention.

---

# 8. Chronological Ordering

Subject Timeline lists use this exact total ordering:

1. `occurredAt` descending,
2. `createdAt` descending,
3. `id` descending.

“Descending” means the greatest persisted value appears first.

Therefore:

- the newest user-stated occurrence appears first,
- events with the same `occurredAt` are ordered by newest creation time,
- and events with the same `occurredAt` and `createdAt` are ordered by
  descending opaque identifier.

The database query must apply all three sort keys. Application-side sorting,
locale sorting, title sorting, and unspecified database order are not
acceptable.

The ordering is scoped to one Pregnancy or one Child. No combined Family,
Pregnancy-and-Child, or cross-subject ordering is approved.

---

# 9. Authentication and FamilyMembership Authorization

Every Timeline operation requires:

1. an authenticated neutral principal,
2. an explicit `familyId`,
3. an explicit Pregnancy or Child subject path,
4. persisted FamilyMembership connecting the principal's User identifier to the
   path Family,
5. a persisted subject matching the path subject identifier and Family,
6. and, for direct get, an event matching the Family, subject, and event path.

The User identifier comes only from the authenticated principal.

The implementation must never accept or trust client-supplied:

- User identifiers,
- Family identifiers in the body,
- subject identifiers in the body,
- membership claims,
- role claims,
- guardian or ownership claims,
- or authorization decisions.

During the current one-role Family foundation, persisted membership is
sufficient for the minimum create-and-read vertical. `OWNER` does not prove
parenthood, guardianship, custody, authorship, legal authority, medical
authority, or ownership of another person.

Future Family roles must not inherit Timeline permissions automatically. Their
permissions require a separate approved role decision.

A Family, subject, or event identifier alone never grants access.

---

# 10. Approved Pregnancy Timeline HTTP Contract

The Pregnancy Timeline paths are:

- `POST /families/:familyId/pregnancies/:pregnancyId/timeline-events`
- `GET /families/:familyId/pregnancies/:pregnancyId/timeline-events`
- `GET /families/:familyId/pregnancies/:pregnancyId/timeline-events/:timelineEventId`

The POST body accepts exactly:

```json
{
  "title": "...",
  "occurredAt": "2026-07-22T11:10:00.000Z"
}
```

Successful creation returns HTTP 201 with:

```json
{
  "id": "...",
  "familyId": "...",
  "pregnancyId": "...",
  "title": "...",
  "occurredAt": "2026-07-22T11:10:00.000Z",
  "createdAt": "...",
  "updatedAt": "..."
}
```

The response must not contain `childId`, `subjectType`, or a generic
`subjectId`.

Successful list returns HTTP 200:

```json
{
  "timelineEvents": []
}
```

Each item uses the Pregnancy event representation above and the list follows
the ordering in section 8. An existing authorized Pregnancy with no events
returns the empty list above.

Successful direct get returns HTTP 200 with one Pregnancy event representation.

---

# 11. Approved Child Timeline HTTP Contract

The Child Timeline paths are:

- `POST /families/:familyId/children/:childId/timeline-events`
- `GET /families/:familyId/children/:childId/timeline-events`
- `GET /families/:familyId/children/:childId/timeline-events/:timelineEventId`

The POST body accepts exactly:

```json
{
  "title": "...",
  "occurredAt": "2026-07-22T11:10:00.000Z"
}
```

Successful creation returns HTTP 201 with:

```json
{
  "id": "...",
  "familyId": "...",
  "childId": "...",
  "title": "...",
  "occurredAt": "2026-07-22T11:10:00.000Z",
  "createdAt": "...",
  "updatedAt": "..."
}
```

The response must not contain `pregnancyId`, `subjectType`, or a generic
`subjectId`.

Successful list returns HTTP 200:

```json
{
  "timelineEvents": []
}
```

Each item uses the Child event representation above and the list follows the
ordering in section 8. An existing authorized Child with no events returns the
empty list above.

Successful direct get returns HTTP 200 with one Child event representation.

Separate paths and subject-specific responses prevent ambiguous polymorphic
request bodies. The body never accepts a Family or subject identifier.

---

# 12. Validation and Safe Error Contract

Request bodies are strict and reject every unknown field, including:

- `id`,
- `familyId`,
- `pregnancyId`,
- `childId`,
- `subjectId`,
- `subjectType`,
- `userId`,
- membership or role claims,
- guardian or ownership claims,
- `createdAt`,
- `updatedAt`,
- note, body, or description,
- category or event type,
- Media or Health data,
- medical classification,
- location,
- reminder or notification data,
- AI content,
- and all other fields.

Validation failures return HTTP 400 with one of:

- `TITLE_REQUIRED`,
- `TITLE_INVALID`,
- `TITLE_TOO_LONG`,
- `OCCURRED_AT_REQUIRED`,
- `OCCURRED_AT_INVALID`,
- `UNKNOWN_FIELD`,
- or `UNKNOWN_QUERY_PARAMETER`.

Validation errors use a deterministic generic message and never echo the title,
occurredAt value, request body, subject identifier, or sensitive content.
Ill-formed Unicode maps to `TITLE_INVALID`.

Authentication is evaluated first. Target-independent body and query validation
is evaluated before any Family, subject, or event lookup. The same invalid input
must produce the same HTTP 400 outcome regardless of whether a target exists or
is accessible. Valid input then enters the membership-scoped operation, where
all unavailable target outcomes collapse to `TIMELINE_NOT_FOUND`.

The create endpoints accept no query parameters. The list and direct-get
endpoints accept neither request bodies nor query parameters. Unsupported query
parameters return HTTP 400 with `UNKNOWN_QUERY_PARAMETER`; they must not be
silently treated as pagination, filtering, or ordering controls.

Unauthenticated requests return HTTP 401 through the existing authentication
guard.

Every unavailable target returns the same HTTP 404 response:

```json
{
  "statusCode": 404,
  "code": "TIMELINE_NOT_FOUND",
  "message": "Timeline resource not found."
}
```

This response applies identically when:

- the Family is missing or inaccessible,
- the Pregnancy is missing, inaccessible, or belongs to another Family,
- the Child is missing, inaccessible, or belongs to another Family,
- the event is missing or inaccessible,
- the event belongs to another Family,
- the event belongs to another Pregnancy,
- the event belongs to another Child,
- a Pregnancy event is requested through a Child path,
- a Child event is requested through a Pregnancy path,
- or any Family, subject, and event path combination is mismatched.

The endpoints must not return `FAMILY_NOT_FOUND`, `PREGNANCY_NOT_FOUND`,
`CHILD_NOT_FOUND`, subject-specific Timeline errors, HTTP 403, or another
response that reveals which target exists.

---

# 13. Atomicity, Persistence, and Referential Integrity

## Creation

Membership authorization, subject ownership validation, and event persistence
must not contain a check-then-write gap.

Creation must use one serializable transaction or an equivalent atomic
membership-scoped persistence operation that:

1. verifies persisted FamilyMembership,
2. verifies that the path subject exists in the same Family,
3. writes exactly one event for that Family and subject,
4. and returns success only when all checks and the write commit.

Failure must not create a partial or unscoped event.

## Reads

List and direct-get queries must embed:

- authenticated User membership scope,
- `familyId`,
- subject type,
- subject identifier,
- and, for direct get, event identifier.

Filtering after an unscoped query is not acceptable.

## Database invariants

The first Timeline migration must introduce one `timeline_event` table with:

- required `familyId`,
- optional `pregnancyId` and persistence-only `pregnancyFamilyId`,
- optional `childId` and persistence-only `childFamilyId`,
- required `title`,
- required `occurredAt`,
- and the approved system fields.

The duplicated subject-Family scalar fields exist only to express strong
composite relational constraints through Prisma. They are not domain fields,
API fields, user input, or independent values.

The database must enforce:

- one required Family relationship,
- exactly one Pregnancy-or-Child subject relationship,
- a check constraint accepting only one of:
  - non-null `pregnancyId` and `pregnancyFamilyId`, null Child subject fields,
    and `pregnancyFamilyId = familyId`, or
  - non-null `childId` and `childFamilyId`, null Pregnancy subject fields, and
    `childFamilyId = familyId`,
- a composite foreign key from `(pregnancyId, pregnancyFamilyId)` to
  Pregnancy `(id, familyId)`,
- a composite foreign key from `(childId, childFamilyId)` to Child
  `(id, familyId)`,
- and a direct foreign key from `familyId` to Family.

The migration may add only the composite candidate keys on Pregnancy
`(id, familyId)` and Child `(id, familyId)` required by PostgreSQL for those
foreign keys. These are relational support constraints, not domain uniqueness:
opaque `id` remains each subject's identity and no product behavior may depend
on the composite key.

This exact shape prevents cross-Family subjects and both-or-neither subjects
without triggers, unrepresented polymorphic foreign keys, or application-only
integrity. `@lumora/database` owns the Prisma mapping and custom check constraint.
The Timeline domain package must not depend on Prisma or another domain
package's infrastructure.

The event table has exactly two chronological list indexes:

- `(familyId, pregnancyId, occurredAt DESC, createdAt DESC, id DESC)`,
- `(familyId, childId, occurredAt DESC, createdAt DESC, id DESC)`.

The primary key supports event identity. No title, occurredAt-only, combined
Family-feed, search, taxonomy, author, or pagination-specific index is approved.

Family, Pregnancy, and Child deletion must not silently cascade Timeline data.
Until deletion semantics are approved, referential behavior must be
restrictive.

Authentication User deletion must not delete Timeline data indirectly.

---

# 14. Package, Database, and API Responsibilities

## `packages/timeline`

Sprint 2.7B may create `@lumora/timeline`, which will own:

- Timeline domain concepts,
- the minimum event and subject invariants,
- strict Zod input validation and normalization,
- chronology contracts,
- subject-specific response-neutral application behavior,
- FamilyMembership-scoped repository contracts,
- create, list, and direct-get application behavior,
- and infrastructure-independent errors.

`@lumora/timeline` must not depend on:

- NestJS,
- Better Auth,
- Prisma,
- `@lumora/database`,
- `@lumora/pregnancy`,
- or `@lumora/child`.

It may represent the approved subject distinction through its own neutral
Timeline subject contract without importing Pregnancy or Child implementations.

## `@lumora/database`

The database package remains the sole owner of:

- Prisma Client,
- schema and migrations,
- relational constraints,
- database connection lifecycle,
- subject existence and Family-consistency queries,
- membership-scoped persistence,
- transactions,
- ordering queries,
- and Timeline repository implementation.

Database adapters may use Pregnancy and Child persistence models without
coupling the Pregnancy and Child domain packages to Timeline.

## `apps/api`

The API owns:

- the six nested HTTP routes,
- existing authentication guard use,
- neutral principal resolution,
- path-to-neutral-subject composition,
- dependency injection,
- HTTP status and deterministic error mapping,
- and subject-specific minimum response serialization.

Controllers must not own validation, chronology, authorization, subject
integrity, or persistence rules.

## `@lumora/family`

The Family package continues to own FamilyMembership concepts. Timeline must not
duplicate roles, invitations, guardianship, or permission logic.

## `@lumora/pregnancy` and `@lumora/child`

Pregnancy and Child packages remain independent and unchanged. They must not
depend on Timeline or implement Timeline persistence.

---

# 15. Privacy, Logging, and Sensitive Output

Timeline data receives heightened privacy protection because it concerns
Pregnancy or Child history.

The implementation must:

- keep Timeline private by default,
- require persisted FamilyMembership for every operation,
- prevent cross-Family enumeration,
- return only approved minimum fields,
- keep titles, occurredAt values, request bodies, and response bodies out of
  routine logs,
- avoid routine logging of Family, subject, and event identifiers,
- use correlation metadata that contains no Timeline content,
- never place Timeline data in authentication sessions, cookies, tokens, cache
  keys, analytics events, or authentication persistence,
- never expose credentials, password data, accounts, cookies, or raw session
  tokens,
- never echo rejected content in errors,
- and minimize replication and retention of Timeline content.

No audit event is approved until audit contents, access, retention, and privacy
handling are separately decided.

---

# 16. Medical Safety

Timeline events are user-authored historical statements.

Recording or returning an event does not establish that:

- the statement is medically verified,
- the event occurred with clinical accuracy,
- the title is a diagnosis,
- the title represents a Health record,
- occurredAt is a medically verified date,
- or the event establishes Pregnancy, birth, age, development, lifecycle, or
  outcome facts.

Timeline must not:

- diagnose,
- recommend treatment,
- prescribe,
- calculate gestational age or developmental age,
- infer trimester, due date, birth, maturity, or lifecycle status,
- convert title text into structured Health data,
- assign a medical taxonomy,
- score clinical risk,
- generate medical conclusions,
- or discourage professional care.

Health behavior remains outside Timeline and Sprint 2.7B.

---

# 17. Continuity, Portability, and Acquisition Safeguards

The foundation must preserve:

- stable opaque event identifiers,
- explicit Family ownership,
- explicit Pregnancy-or-Child subject identity,
- portable UTC timestamps,
- plain Unicode titles,
- deterministic chronology,
- provider-neutral domain contracts,
- replaceable infrastructure,
- and readable future export representation.

These choices preserve room for a future open, complete export without making
Timeline dependent on a proprietary event system, vendor identifier, or binary
format.

Lumora remains steward, not owner, of Timeline data. Acquisition, bankruptcy,
operator change, or shutdown must not:

- broaden Timeline visibility,
- weaken FamilyMembership authorization,
- convert event history into a commercial asset,
- remove future export or deletion rights,
- fragment Child continuity,
- or reinterpret user-authored statements as platform-owned facts.

This decision does not implement export, deletion, retention, succession,
shutdown runbooks, legal retention, guardianship, or adult ownership transfer.

---

# 18. Relationship to Pregnancy and Child

Timeline references an existing Pregnancy or Child without taking ownership of
that subject.

Timeline may read persistence-level subject identity only through
`@lumora/database` to enforce the approved relationship. Timeline application
and domain code must not import Pregnancy or Child infrastructure.

Creating an event:

- does not modify the Pregnancy or Child,
- does not change a lifecycle status,
- does not establish Pregnancy-to-Child linkage,
- does not copy subject fields,
- and does not create an event in the other subject's Timeline.

The same title and occurredAt may appear independently for different subjects.
No deduplication or inferred relationship is approved.

---

# 19. Relationship to Deferred Domains

## Central event layer

`FD-001` remains deferred. The minimum Timeline does not become the central
event platform for domain-generated events. Pregnancy and Child do not emit
events automatically.

## Media

Timeline events contain no Media identifier, attachment, metadata, file, image,
video, or document. `FD-003` remains deferred.

## Health

Timeline contains no Health relationship or medical structure. A medically
relevant title remains unverified plain text and must not become a Health record.

## AI

Timeline does not generate, summarize, classify, recommend, or infer content
through AI.

## Notifications

Timeline does not schedule reminders, notifications, jobs, or background
workflows.

---

# 20. Pagination Decision

Pagination is explicitly deferred for the first implementation vertical.

The minimum list endpoints return all authorized events for one subject in the
ordering defined in section 8. They accept no cursor, page, limit, offset, or
sort parameter.

Pagination requires a separate decision covering:

- stable cursor composition across the three sort keys,
- maximum page size,
- response metadata,
- invalid cursor behavior,
- and privacy-safe query handling.

The first migration should preserve the required ordering indexes so pagination
can be added later without changing event semantics.

---

# 21. Mutation and Deletion Boundaries

No Timeline update endpoint is approved.

No Timeline deletion, archive, restore, move, reassignment, merge, conversion,
or upsert endpoint is approved.

The first vertical cannot change:

- Family,
- subject type,
- subject identifier,
- title,
- occurredAt,
- createdAt,
- or updatedAt through a client operation.

Future correction of title or occurredAt, deletion, retention, and relationship
cleanup require separate decisions.

---

# 22. Migration Expectations

Sprint 2.7B's migration must:

- be additive,
- use a truthful 2026 identifier,
- leave all existing migrations unchanged,
- introduce only minimum Timeline persistence,
- use one `timeline_event` table with the composite relation scalars and
  constraints defined in section 13,
- require `familyId`, `title`, and timezone-aware `occurredAt`,
- require exactly one nullable subject key to be present,
- prohibit both or neither subject,
- enforce Family-consistent subject references at the database level,
- avoid unique constraints on title or occurredAt,
- add only indexes required for the two subject-scoped chronological queries,
- use restrictive deletion behavior for Family and subjects,
- avoid User, membership, author, Media, Health, AI, notification, and
  Pregnancy-to-Child relationships,
- and apply successfully to clean and existing Child-foundation databases.

No existing table may receive a Timeline product field. Relational support
is limited to the Pregnancy and Child composite candidate keys in section 13
and must not change their domain semantics.

Migration verification must use disposable PostgreSQL and include schema
validation, migration deployment and status, constraint checks, chronological
queries, cleanup, and regression verification of Authentication, Family,
Pregnancy, and Child.

The repeatable root verification command must be
`pnpm test:timeline:postgres`, following the existing domain convention.

---

# 23. Required Tests for Sprint 2.7B

The implementation must include:

- title validation for missing, non-string, empty, whitespace-only, trimming,
  valid Unicode, ill-formed Unicode, null code point, exactly 80 code points,
  more than 80 code points, and unknown fields,
- occurredAt validation for missing, non-string, malformed, nonexistent date,
  missing offset, invalid offset, wrong precision, leap second, exact accepted
  UTC, and exact accepted numeric-offset forms,
- UTC normalization and canonical serialization tests,
- normalized UTC year-boundary tests,
- tests accepting duplicate title and occurredAt values,
- tests proving occurredAt may differ from createdAt,
- tests proving no past-or-future server-clock rule is applied,
- tests proving every event has exactly one Family and one subject,
- database constraint tests rejecting both or neither subject,
- database constraint tests rejecting cross-Family subjects,
- authenticated Pregnancy event create, list, and get,
- authenticated Child event create, list, and get,
- unauthenticated HTTP 401 tests for all six endpoints,
- two-User/two-Family isolation,
- one User with memberships in multiple Families remaining correctly scoped,
- identical `TIMELINE_NOT_FOUND` responses for every missing, inaccessible,
  mismatched, wrong-subject-type, and cross-Family target,
- strict body rejection of Family, subject, ownership, deferred-domain, and
  timestamp-management fields,
- exact Pregnancy and Child response-shape tests,
- ordering tests for all three descending keys,
- tests proving there is no combined Family feed,
- tests proving no pagination parameters are accepted,
- tests proving no upsert, update, delete, or reassignment route exists,
- creation atomicity and authorization race-safety tests,
- Family, Pregnancy, and Child deletion-restriction tests while events exist,
- tests proving authentication User deletion cannot delete events indirectly,
- response and log sensitive-data exclusion,
- package architecture tests proving `@lumora/timeline` independence,
- one Prisma Client owner verification,
- disposable PostgreSQL migration and runtime tests,
- fixture cleanup,
- and regression tests for all implemented domains.

No test may encode an unapproved taxonomy, medical conclusion, lifecycle state,
Media behavior, Health behavior, Pregnancy-to-Child transition, or central event
platform.

---

# 24. Sprint 2.7B Scope and Implementation Gate

Sprint 2.7B may implement only:

- `packages/timeline` with infrastructure-independent contracts and validation,
- the minimum event fields in section 4,
- the exact title and occurredAt semantics in sections 6 and 7,
- one additive migration owned by `@lumora/database`,
- database-enforced Family and exactly-one-subject integrity,
- FamilyMembership-scoped creation, chronological list, and direct get,
- the six nested endpoints in sections 10 and 11,
- the deterministic response and error contracts,
- no pagination,
- focused privacy, medical-safety, ordering, authorization, and isolation tests,
- disposable PostgreSQL migration and runtime verification,
- regression verification of existing domains,
- and truthful implementation documentation.

Implementation may begin only when:

- this decision remains approved,
- Timeline remains limited to user-authored events,
- title and occurredAt remain the only user-provided fields,
- every event has exactly one same-Family Pregnancy or Child subject,
- Family remains the ownership and privacy boundary,
- the schema can enforce the subject invariants without coupling domain
  packages,
- all paths remain subject-specific and nested,
- no combined feed, central event layer, Media, Health, AI, notification,
  mutation, deletion, or pagination behavior is introduced,
- and the repository is clean and verified.

Sprint 2.7B is implemented.

---

# 25. Explicit Exclusions

The following are outside Sprint 2.7A and Sprint 2.7B:

- Timeline implementation during Sprint 2.7A,
- a central cross-domain event platform,
- Family as an event subject,
- events targeting both Pregnancy and Child,
- events without a subject,
- a combined Family feed,
- a combined Pregnancy-and-Child feed,
- Pregnancy-to-Child linkage or transition,
- note, body, description, or long-form content,
- category, event type, taxonomy, icon, or color,
- location,
- Media attachments or storage,
- Health records or medical structures,
- medical verification, diagnosis, interpretation, or recommendations,
- system-generated events or milestones,
- reminders, notifications, jobs, or automation,
- AI-generated or AI-classified content,
- author or creator persistence,
- event update, correction, deletion, archive, or restore,
- Family or subject reassignment,
- upsert,
- pagination, filtering, search, or custom sorting,
- new Family roles, invitations, or permission engine,
- export, retention, succession, shutdown, or deletion implementation,
- guardianship, lifecycle, or adult ownership transfer,
- mobile UI,
- admin UI,
- analytics or social behavior,
- and Better Auth changes.

These exclusions must not be anticipated through speculative fields,
relationships, enums, endpoints, events, or package abstractions.

---

# 26. Deferred and Unresolved Decisions

The following remain deferred:

1. title or occurredAt correction behavior,
2. event deletion, retention, and relationship cleanup,
3. note, description, and long-form content,
4. category or event taxonomy,
5. location,
6. Media relationships and `FD-003`,
7. Health relationships and medical-data permissions,
8. AI behavior,
9. reminders and notifications,
10. pagination, filtering, and search,
11. combined Family or cross-subject feeds,
12. Timeline as a central event layer and `FD-001`,
13. domain-generated events,
14. event author attribution,
15. export format, completeness, and authority,
16. permissions for future Family roles,
17. Pregnancy-to-Child linkage,
18. guardianship and adult ownership transfer,
19. audit-event content and retention,
20. and mobile presentation.

None of these decisions blocks the approved minimum create-and-read vertical.

---

# 27. Security Invariants

The eventual implementation must:

- deny cross-Family Timeline access by default,
- require authentication and persisted FamilyMembership,
- derive User identity only from the authenticated principal,
- validate Family and subject ownership atomically during creation,
- scope all reads through membership, Family, subject type, and subject ID,
- enforce exactly one same-Family subject at the database level,
- never treat an identifier as proof of access,
- never reveal which Family, subject, or event exists,
- never place Timeline content in authentication sessions,
- never log Timeline titles or request/response bodies routinely,
- never expose credentials, accounts, cookies, or raw session tokens,
- never infer medical, developmental, Pregnancy, or lifecycle facts,
- never transform Timeline content into Health data,
- never create Pregnancy-to-Child linkage,
- never silently cascade-delete Timeline history,
- and never weaken user ownership, portability, continuity, shutdown, or
  acquisition safeguards.

---

# 28. Future Review Triggers

Review this decision when:

- event mutation or deletion is proposed,
- another Timeline content field is proposed,
- pagination or search becomes necessary,
- a combined feed is proposed,
- a third business domain begins contributing events,
- domain-generated events are proposed,
- `FD-001` or `FD-003` review conditions are met,
- Media or Health first references Timeline,
- Pregnancy-to-Child continuity is designed,
- future Family roles are approved,
- export or retention requirements become concrete,
- mobile Timeline design becomes concrete,
- or privacy, medical-safety, child-protection, continuity, acquisition, or
  shutdown obligations change.

---

# 29. Sprint 2.7A Completion Record

Status: Complete when this decision is committed

Sprint 2.7A delivers only:

- this approved Timeline architecture decision,
- the authoritative reading-order update,
- and the high-level domain-model correction from “Child and/or Pregnancy” to
  exactly one Child or Pregnancy.

It adds no source code, package, endpoint, Prisma model, migration, or runtime
behavior. Targeted documentation formatting, whitespace verification, diff
review, and a clean post-commit working tree are the completion gate.

---

# 30. Sprint 2.7B Implementation Record

Status: Implemented

The minimum Timeline create-and-read vertical is implemented within the approved
boundaries:

- `@lumora/timeline` owns strict Zod validation, normalized input, neutral
  subject contracts, application behavior, and repository contracts without
  depending on NestJS, Prisma, Better Auth, Pregnancy, or Child packages.
- `@lumora/database` owns one `timeline_event` Prisma model, one additive
  migration, the repository adapter, serializable creation, membership-scoped
  reads, and deterministic database ordering.
- The database enforces exactly one subject with a check constraint and
  same-Family ownership with composite foreign keys.
- `apps/api` exposes only the approved Pregnancy and Child nested create, list,
  and direct-get routes.
- Every unavailable Family, Pregnancy, Child, subject-route, and event
  combination returns the same `TIMELINE_NOT_FOUND` HTTP 404 response.

`title` is normalized and persisted as required `VARCHAR(80)`. `occurredAt`
accepts only the approved millisecond RFC 3339 profile, is persisted as
`TIMESTAMPTZ(3)`, and is returned in canonical UTC. Lists order by
`occurredAt DESC`, `createdAt DESC`, and `id DESC`.

The repeatable `pnpm test:timeline:postgres` command builds the repository,
validates and deploys all migrations to disposable PostgreSQL 16, and runs the
Authentication, Family, Pregnancy, Child, and Timeline runtime suites before
removing the container.

No update, deletion, upsert, reassignment, combined feed, pagination, Media,
Health, AI, notification, medical interpretation, or Pregnancy-to-Child
behavior is implemented.

---

# 31. References

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
- `docs/15-child-domain-architecture-decision.md`
- `docs/99-deferred-decisions.md`
