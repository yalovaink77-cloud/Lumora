# Basic Family Roles and Membership Entry Architecture Decision

Version: 1.3

Status: Approved — Implemented and PostgreSQL-Verified

Phase: MVP Family Collaboration Foundation

Decision date: 2026-07-22

---

# 1. Purpose

Lumora's MVP includes basic Family member roles and privacy-aware access
control. The implemented Family foundation currently supports one atomic
`OWNER` membership created with each Family, while Pregnancy, Child, and
Timeline operations authorize any persisted FamilyMembership.

This decision defines:

- the exact MVP role vocabulary,
- permissions for every implemented operation,
- exactly-one-OWNER policy,
- consent-based MEMBER entry,
- delivery-neutral invitation architecture,
- minimum invitation lifecycle,
- privacy-safe API contracts,
- persistence and migration requirements,
- and the gate for the Sprint 2.8B implementation.

Sprint 2.8B implements the approved vertical. It does not expand beyond the
contracts recorded here.

---

# 2. Verified Current Behavior

The repository currently verifies that:

- Better Auth provides email/password authentication and server-managed
  sessions,
- authenticated application principals contain only `id`, `email`, and `name`,
- `User.emailVerified` exists and defaults to `false`,
- email verification delivery is not configured,
- sign-up creates a usable session without proving inbox control,
- FamilyMembership contains one role value, `OWNER`,
- Family creation atomically creates the Family and one `OWNER` membership,
- one User may belong to multiple Families,
- `(familyId, userId)` is unique,
- User deletion is restricted while memberships exist,
- Family list and direct-get are membership-scoped,
- Pregnancy, Child, and Timeline repositories authorize by persisted membership
  existence,
- current domain operations do not inspect role,
- and no invitation, add-member, role-change, member-list, remove, leave, or
  ownership-transfer behavior exists.

Current authentication proves possession of account credentials for a claimed
email string. It does not prove control of the corresponding email inbox.

---

# 3. Decision Summary

The MVP authorization role vocabulary contains exactly:

- `OWNER`,
- `MEMBER`.

Every Family has exactly one OWNER. A MEMBER enters a Family only by explicitly
accepting a single-use invitation created by that Family's OWNER.

Both roles may use all currently implemented Family-contained Pregnancy, Child,
and Timeline operations. OWNER alone may create MEMBER invitations.

Invitation acceptance requires:

- an authenticated User,
- a verified canonical account email matching the invitation target,
- possession of the invitation secret,
- an unexpired single-use invitation,
- and one atomic transaction that consumes the invitation and creates or
  resolves the active membership.

Verified email ownership is implemented and PostgreSQL-verified in Sprint
2.8A.2. Sprint 2.8B is therefore unblocked and implements the invitation
vertical against that prerequisite.

---

# 4. Role Vocabulary and Semantics

## `OWNER`

OWNER:

- creates and administers the Family membership boundary,
- is created only with the Family,
- may use all currently implemented Family, Pregnancy, Child, and Timeline
  operations,
- may initiate MEMBER invitations,
- and may use only the minimum invitation administration approved here.

OWNER does not mean:

- mother,
- father,
- guardian,
- caregiver,
- relative,
- legal representative,
- custodian,
- biological relation,
- ownership of another person,
- medical authority,
- or identity verification.

## `MEMBER`

MEMBER is a trusted, invited Family collaborator.

MEMBER:

- may list and directly get Families through its own persisted membership,
- may use all currently implemented Pregnancy operations,
- may use all currently implemented Child operations,
- may use all currently implemented Timeline operations,
- may not create invitations,
- may not administer memberships,
- may not create or change roles,
- may not transfer ownership,
- and may not remove another membership.

MEMBER is an authorization role only. It makes no relationship, guardianship,
custody, identity, legal, biological, or medical claim.

## Role boundary

`OWNER` and `MEMBER`:

- are Family-domain values,
- are persisted on FamilyMembership,
- are not Better Auth roles,
- are not session roles,
- are never copied into authentication cookies or session payloads,
- and must not be inferred from names, emails, Child data, Pregnancy data, or
  Timeline content.

No other role is approved.

---

# 5. Complete MVP Operation Permission Matrix

## Authentication operations

Registration, sign-in, session use, and sign-out remain authentication
operations. They do not depend on Family role.

## Family operations

| Operation                      | OWNER                                                 | MEMBER                                                | Other authenticated User |
| ------------------------------ | ----------------------------------------------------- | ----------------------------------------------------- | ------------------------ |
| `POST /families`               | Yes; creates a different Family and becomes its OWNER | Yes; creates a different Family and becomes its OWNER | Yes                      |
| `GET /families`                | Returns own memberships                               | Returns own memberships                               | Returns own memberships  |
| `GET /families/:familyId`      | Yes                                                   | Yes                                                   | No                       |
| Create MEMBER invitation       | Yes                                                   | No                                                    | No                       |
| Accept own matching invitation | Yes, if targeted                                      | Yes, if targeted                                      | Yes, if targeted         |
| List memberships               | Not approved                                          | Not approved                                          | Not approved             |
| Change roles                   | Not approved                                          | Not approved                                          | Not approved             |
| Remove or leave                | Not approved                                          | Not approved                                          | Not approved             |
| Transfer ownership             | Not approved                                          | Not approved                                          | Not approved             |

Creating a new Family is not administration of an existing Family. Any
authenticated User may create a new Family and becomes that new Family's sole
OWNER.

## Pregnancy operations

Both OWNER and MEMBER may:

- `POST /families/:familyId/pregnancies`,
- `GET /families/:familyId/pregnancies`,
- `GET /families/:familyId/pregnancies/:pregnancyId`.

## Child operations

Both OWNER and MEMBER may:

- `POST /families/:familyId/children`,
- `GET /families/:familyId/children`,
- `GET /families/:familyId/children/:childId`,
- `PATCH /families/:familyId/children/:childId` for the approved
  `displayName` mutation.

## Timeline operations

Both OWNER and MEMBER may:

- create a Pregnancy Timeline event,
- list Pregnancy Timeline events,
- directly get a Pregnancy Timeline event,
- create a Child Timeline event,
- list Child Timeline events,
- directly get a Child Timeline event.

## Consequence for current repositories

Existing Pregnancy, Child, Timeline, and Family read queries authorize by
membership existence. That remains correct because OWNER and MEMBER have the
same permissions for those operations.

Future OWNER-only invitation queries must additionally require persisted
`role = OWNER`. Role checks must not be inferred from the authenticated
principal or duplicated inside Pregnancy, Child, or Timeline packages.

---

# 6. Exactly-One-OWNER Policy

Every existing Family has exactly one OWNER.

The MVP rules are:

- Family creation remains the only OWNER-creation operation,
- Family and initial OWNER membership are committed atomically,
- an invitation can create only MEMBER access,
- a Family cannot have a second OWNER,
- role is immutable,
- role-change endpoints do not exist,
- OWNER membership removal does not exist,
- ownership transfer is deferred,
- and last-owner behavior is outside implementation because OWNER removal is not
  approved.

The future migration must enforce at most one OWNER per Family with a
PostgreSQL partial unique index on `familyId` where `role = 'OWNER'`, or an
equally strong database-native constraint.

The at-least-one invariant remains preserved by:

- the existing atomic Family-plus-OWNER creation transaction,
- no API or repository operation that deletes an OWNER membership,
- no operation that changes an OWNER role,
- restrictive User deletion while the membership exists,
- and migration verification that every existing Family has exactly one OWNER
  before the new role is enabled.

No general role hierarchy, promotion, demotion, transfer, or last-owner engine
is approved.

---

# 7. Minimum Membership Entry Flow

The only approved way to add a MEMBER is:

1. an authenticated OWNER submits a target email for one Family,
2. the server normalizes and validates that email,
3. the server creates one pending invitation bound to that Family, normalized
   email, inviter membership, and `MEMBER`,
4. the server generates one opaque invitation secret,
5. the OWNER receives the raw secret exactly once,
6. the OWNER transmits it to the intended person through a private out-of-band
   channel,
7. the target authenticates with an account whose verified canonical email
   matches the invitation,
8. the target explicitly submits the invitation secret for acceptance,
9. the server atomically validates, consumes, and creates or resolves the MEMBER
   membership,
10. and the successful response returns the Family and caller's membership.

A User must never be inserted into FamilyMembership merely because an OWNER
knows or submits an email address.

Invitation creation must not:

- create a User,
- create a FamilyMembership,
- reveal whether an account exists,
- send email,
- require the target to exist yet,
- or place the target email in a session.

---

# 8. Email Normalization

Invitation input accepts exactly one `email` string.

`docs/18-verified-email-ownership-architecture-decision.md` supersedes the
provisional normalization steps in version 1.0 of this decision.

The shared canonicalization algorithm is:

1. require the original string to pass the installed Better Auth/Zod practical
   email syntax validation,
2. lowercase the complete address with JavaScript's locale-independent
   `String.prototype.toLowerCase()`,
3. and perform no other transformation.

The normalized result is persisted as `targetEmailNormalized`.

Therefore:

- surrounding whitespace is rejected rather than trimmed,
- raw Unicode email input is unsupported,
- NFC and compatibility normalization are not applied,
- provider-specific dot and plus transformations are prohibited,
- and invitation acceptance compares the persisted target with the principal's
  exact canonical email.

No package may introduce a second, inconsistent normalization algorithm.
Display casing is not preserved because the invitation response does not return
the target email.

`@lumora/auth` owns the canonicalizer implementation. Family consumes it through
an infrastructure-neutral port and does not import Better Auth.

---

# 9. Email-Control and Delivery Decision

## Verified email is required

An authenticated matching email string alone is insufficient.

Successful acceptance requires trustworthy evidence that:

- the authenticated User controls the matching email address,
- `emailVerified` is true as a result of an approved verification flow,
- and the verification state is available through a neutral identity boundary.

The invitation secret is a second requirement. It does not replace email
ownership proof.

## Current capability

The current Better Auth configuration:

- enables email/password authentication,
- issues a session after unverified registration,
- persists `emailVerified = false`,
- does not configure verification delivery,
- does not require verified email for sign-in or guarded application access,
- and does not expose verification state in the neutral principal.

Therefore the current foundation cannot safely prove control of the invited
email.

## Delivery-neutral invitation

The invitation mechanism itself does not require automated email delivery. The
OWNER receives an opaque secret once and may send it through a private
out-of-band channel.

However, verified email ownership remains mandatory. If the prerequisite
verification architecture requires email delivery to establish
`emailVerified`, that delivery is security-critical and cannot be bypassed by
the invitation flow.

Authenticated pending-invitation discovery is not approved. It would expose
email-bound invitations to an account that has not yet proven email control.

---

# 10. Invitation Secret Handling

The invitation secret must:

- contain 256 bits of cryptographically secure random entropy,
- be generated by the platform cryptographic random generator,
- use unpadded base64url encoding,
- contain exactly 43 characters,
- be independent for every invitation,
- and never encode Family, User, email, role, timestamp, or sequential data.

The raw secret:

- is returned exactly once in the successful OWNER creation response,
- is never persisted,
- is never recoverable,
- is never returned by another endpoint,
- is never placed in a URL by the server,
- and must not enter logs, analytics, traces, sessions, cookies, cache keys, or
  error messages.

Persistence stores only a SHA-256 digest of the high-entropy secret. The digest
has a unique constraint. The implementation must use maintained platform
cryptographic primitives, not custom cryptography.

Acceptance:

1. validates the exact base64url shape,
2. computes the fixed-length digest,
3. uses the digest for indexed lookup,
4. and uses timing-safe equality for any in-memory digest comparison.

`@lumora/family` owns a secret-service port. Infrastructure composition owns the
cryptographic implementation. The Family package must not depend on Node
cryptography, NestJS, Prisma, or Better Auth.

---

# 11. Expiry and Minimum Lifecycle

Expiry is security-critical because:

- the invitation secret is a bearer capability,
- automated revocation is not included,
- manual revocation is deferred,
- and an unbounded secret would create indefinite membership-entry exposure.

Every invitation expires exactly seven days after creation.

The expiry:

- is system-generated,
- is measured from database-authoritative `createdAt`,
- is persisted as `TIMESTAMPTZ(3)`,
- is computed from database time as `createdAt + 7 days`,
- is not supplied or changed by the client,
- and is checked inside acceptance's transaction.

The minimum lifecycle is:

- **Pending** — `consumedAt` is null and `expiresAt` is in the future.
- **Expired** — `consumedAt` is null and database time is at or after
  `expiresAt`.
- **Consumed** — `consumedAt` and `acceptedByUserId` are set atomically.
- **Active MEMBER** — a FamilyMembership exists with `role = MEMBER`.

Pending, expired, and consumed are derived states. No invitation status enum is
required.

Expired invitations cannot be accepted. Creating a new invitation after expiry
is a new invitation, not resend behavior.

Rejection, manual revocation, resend, editable expiry, removal, leave, role
change, and ownership transfer remain deferred. Seven-day expiry plus verified
email binding makes manual revocation unnecessary for this minimum vertical.

---

# 12. Invitation Creation API Contract

The future OWNER endpoint is:

`POST /families/:familyId/invitations`

It requires:

- authentication,
- a persisted FamilyMembership for the caller and path Family,
- persisted `role = OWNER`,
- and strict request validation before Family lookup.

The body accepts exactly:

```json
{
  "email": "member@example.com"
}
```

Validation errors return HTTP 400 with:

- `EMAIL_REQUIRED`,
- `EMAIL_INVALID`,
- or `UNKNOWN_FIELD`.

When more than one validation fault exists, precedence is:

1. `UNKNOWN_FIELD`,
2. `EMAIL_REQUIRED`,
3. `EMAIL_INVALID`.

The message is always:

```text
Invalid Family invitation request.
```

Validation errors never echo the email or body.

Successful creation returns HTTP 201:

```json
{
  "invitation": {
    "id": "...",
    "familyId": "...",
    "role": "MEMBER",
    "expiresAt": "2026-07-29T12:00:00.000Z",
    "createdAt": "2026-07-22T12:00:00.000Z"
  },
  "invitationSecret": "..."
}
```

The response excludes:

- target email,
- inviter identity,
- target account existence,
- membership data,
- authentication data,
- and unrelated Family data.

Unknown Family, inaccessible Family, and non-OWNER membership all return:

```json
{
  "statusCode": 404,
  "code": "FAMILY_NOT_FOUND",
  "message": "Family not found."
}
```

This preserves Family non-enumeration, including when a MEMBER already knows the
Family exists.

Invitation creation does not query User by target email. Its status and response
must be identical whether the target account exists, does not exist, or is
unverified.

If an unconsumed, unexpired invitation already exists for the same Family and
normalized email, creation returns HTTP 409:

```json
{
  "statusCode": 409,
  "code": "INVITATION_ALREADY_PENDING",
  "message": "A pending invitation already exists."
}
```

This outcome is visible only to the authenticated OWNER of that Family and
reveals no target account state. The raw secret is not returned again.

---

# 13. Invitation Acceptance API Contract

The future acceptance endpoint is:

`POST /family-invitations/accept`

It is not nested under Family because the target must not know or submit a
Family identifier.

The endpoint requires authentication.

The body accepts exactly:

```json
{
  "invitationSecret": "..."
}
```

Validation occurs before invitation lookup.

Validation errors return HTTP 400 with:

- `INVITATION_SECRET_REQUIRED`,
- `INVITATION_SECRET_INVALID`,
- or `UNKNOWN_FIELD`.

When more than one validation fault exists, precedence is:

1. `UNKNOWN_FIELD`,
2. `INVITATION_SECRET_REQUIRED`,
3. `INVITATION_SECRET_INVALID`.

The message is always:

```text
Invalid Family invitation acceptance request.
```

After input validation and before invitation lookup, the neutral identity
boundary requires verified canonical email. An unverified authenticated User
receives:

```json
{
  "statusCode": 403,
  "code": "VERIFIED_EMAIL_REQUIRED",
  "message": "Verified email is required."
}
```

That response is independent of whether the invitation exists.

Successful acceptance returns HTTP 200:

```json
{
  "family": {
    "id": "...",
    "displayName": "...",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "membership": {
    "id": "...",
    "familyId": "...",
    "userId": "...",
    "role": "MEMBER",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

The membership `userId` is always the authenticated caller. The response
contains no target email, inviter identity, secret, other membership, or
authentication state.

For a newly created membership, `role` is always `MEMBER`. If the caller already
has membership in the Family, acceptance returns that existing membership and
its unchanged role; it never promotes, demotes, or creates OWNER.

Every validly shaped but unavailable acceptance target returns HTTP 404:

```json
{
  "statusCode": 404,
  "code": "INVITATION_NOT_FOUND",
  "message": "Invitation not found."
}
```

This identical outcome covers:

- unknown secret,
- expired invitation,
- target-email mismatch,
- invitation for a different authenticated User,
- malformed persisted relationship,
- mismatched Family,
- consumed invitation accepted by another User,
- missing Family,
- missing inviter membership,
- or any other unavailable invitation state.

The endpoint never accepts `familyId`, `userId`, email, role, invitation ID, or
membership ID.

---

# 14. Acceptance Atomicity and Idempotency

Acceptance must run in one serializable transaction or equivalent atomic
operation that:

1. locks or conditionally claims the invitation,
2. verifies it is unexpired and correctly bound,
3. confirms authenticated verified canonical email equality,
4. confirms the invitation role is MEMBER,
5. confirms the Family relationship,
6. creates or resolves `(familyId, userId)` membership,
7. sets `consumedAt` and `acceptedByUserId`,
8. and commits all effects together.

No membership may survive if invitation consumption fails. No invitation may be
consumed without a matching membership outcome.

Concurrent acceptance must produce one active membership. The existing unique
`(familyId, userId)` constraint remains authoritative.

Idempotency rules:

- the first valid acceptance succeeds,
- after the verified-email gate, repeating the same secret as the same
  authenticated accepted User returns the same Family and membership with HTTP
  200 even if the invitation has since expired or the User's verified canonical
  email has changed,
- an additional valid invitation for a User already holding MEMBER membership
  is consumed and returns the existing membership unchanged,
- an invitation accepted by a User already holding OWNER membership is consumed
  and returns the existing OWNER membership unchanged,
- and consumed acceptance by any different User returns the identical
  `INVITATION_NOT_FOUND` 404.

Acceptance never changes an existing role and never creates a duplicate
membership.

The consumed-same-User replay check occurs before pending-invitation expiry and
target-email checks. It relies on immutable `acceptedByUserId`, not current
email equality. This does not grant new access because the membership already
exists; if that membership no longer exists in a future model, replay must
return the identical `INVITATION_NOT_FOUND` response until removal semantics are
separately approved.

---

# 15. Invitation Lookup and Membership Visibility

No invitation lookup endpoint is required.

The opaque secret plus acceptance response provides the minimum flow. The
following are deferred:

- pending-invitation discovery,
- invitation list,
- invitation detail,
- invitation status,
- resend,
- and revocation.

No Family membership-list endpoint is required for invitation creation or
acceptance.

The implementation must not expose:

- a broad member directory,
- member emails,
- User names,
- invitation target emails,
- inviter identity,
- or other account details.

Membership visibility requires a separate privacy and product decision.

---

# 16. Future Persistence Model

## Role extension

`FamilyMembershipRole` adds exactly:

- `OWNER`,
- `MEMBER`.

Role remains required with no database default.

## Invitation entity

The minimum invitation persistence contains:

- `id` — opaque, system-generated, immutable,
- `familyId` — required and immutable,
- `inviterMembershipId` — required and immutable,
- `targetEmailNormalized` — required, immutable, and `TEXT` so it matches the
  canonical account-email storage contract,
- `role` — required, immutable, and constrained to MEMBER,
- `secretHash` — required, immutable, fixed-length, and unique,
- `expiresAt` — required, system-generated, timezone-aware,
- `consumedAt` — nullable, system-managed, timezone-aware,
- `acceptedByUserId` — nullable and set only with consumption,
- `createdAt` — required, system-generated, and `TIMESTAMPTZ(3)`,
- and `updatedAt` — required, system-managed, and `TIMESTAMPTZ(3)`.

There is no raw-secret field, status enum, delivery field, message, relationship
label, resend count, revocation field, rejection field, or member profile.

## Constraints

The database must enforce:

- Family foreign key with restrictive deletion,
- inviter membership foreign key with restrictive deletion,
- inviter membership and invitation belonging to the same Family through a
  composite relational constraint,
- accepted User foreign key with restrictive deletion,
- unique `secretHash`,
- role constrained to MEMBER,
- `consumedAt` and `acceptedByUserId` both null or both non-null,
- `expiresAt > createdAt`,
- unique `(familyId, userId)` membership,
- and at most one OWNER per Family.

FamilyMembership requires a composite candidate key on `(id, familyId)` for the
same-Family inviter relationship.

Required indexes are:

- invitation `familyId`,
- `(familyId, targetEmailNormalized, consumedAt, expiresAt)` for active-pending
  checks,
- `inviterMembershipId`,
- unique `secretHash`,
- and the partial unique OWNER index.

No index for account discovery, member listing, relationship labels, or
unapproved lifecycle queries is authorized.

## Retention boundary

Consumed and expired invitation records remain Family-bound security records in
this minimum model. No deletion, purge, anonymization, or retention interval is
approved here because Family deletion, User deletion while memberships exist,
and retention policy are all explicitly deferred.

This does not make retention a Sprint 2.8B implementation blocker: that sprint
does not delete Users, Families, memberships, or invitations. It does require
that invitation data remain private, excluded from routine logs and sessions,
and eligible for the future user-controlled deletion and retention decision.
Public launch, deletion implementation, or indefinite production retention is a
review trigger.

---

# 17. Duplicate Invitation and Concurrency Rules

Only one unconsumed, unexpired invitation may be operationally pending for a
Family and normalized target email.

Because expiry depends on database time, the implementation must enforce this
through:

- an indexed pending lookup,
- one serializable creation transaction,
- bounded serialization-conflict retry,
- and deterministic `INVITATION_ALREADY_PENDING` mapping.

Expired or consumed records do not block creation of a new invitation.

Concurrent OWNER creation requests must result in:

- one newly created invitation and raw secret,
- and one `INVITATION_ALREADY_PENDING` response.

No retry may return or reconstruct a previously issued raw secret.

---

# 18. Authentication and Authorization Boundaries

Better Auth remains responsible only for:

- authentication identity,
- credential processing,
- session creation and validation,
- and trustworthy email-verification state after the prerequisite is approved.

Better Auth must not own:

- FamilyMembership,
- Family role,
- invitation lifecycle,
- invitation secret,
- permission matrix,
- or membership creation.

Persisted FamilyMembership remains the authorization source of truth.

Role checks:

- occur against persisted membership data,
- are required for OWNER-only invitation creation,
- are not read from sessions,
- and are not client-supplied.

The neutral identity boundary for acceptance must provide:

- stable authenticated User ID,
- canonical account email,
- trustworthy email-verification state.

It must not provide Family roles or permissions.

Existing Pregnancy, Child, and Timeline packages continue to receive neutral
User IDs and rely on membership-scoped persistence. They must not import Family
role logic or Better Auth.

---

# 19. Package and Infrastructure Responsibilities

## `@lumora/family`

The Family package will own:

- OWNER and MEMBER domain constants and types,
- the permission decisions in this document,
- invitation input validation and normalization contracts,
- invitation lifecycle invariants,
- secret-service port,
- identity-verification port,
- repository contracts,
- create and accept application behavior,
- and infrastructure-independent errors.

It must remain independent of:

- NestJS,
- Better Auth,
- Prisma,
- `@lumora/database`,
- Node cryptographic implementation,
- and email-delivery providers.

## `@lumora/database`

The database package will own:

- Prisma schema and migration,
- invitation repository adapter,
- role and invitation constraints,
- transactions,
- database-time expiry,
- membership and OWNER-role queries,
- duplicate-pending checks,
- and atomic invitation consumption.

## `apps/api`

The API will own:

- authentication guard composition,
- neutral verified-identity resolution,
- the cryptographic secret-service adapter,
- the two approved HTTP endpoints,
- HTTP status and privacy-safe error mapping,
- and response serialization.

Controllers must not own role, invitation, normalization, secret, transaction,
or permission rules.

## `@lumora/auth`

Authentication will own the prerequisite verified-email capability and neutral
identity integration. It must not create invitations or memberships.

## Subject domains

Pregnancy, Child, and Timeline packages remain unchanged. Their repositories may
continue membership-existence authorization because MEMBER is explicitly
approved for all their current operations.

---

# 20. Privacy and Non-Enumeration

Invitation and membership information is sensitive Family-boundary data.

The future implementation must:

- never reveal whether a target email has an account,
- never reveal whether a target account is verified during invitation creation,
- never query target account existence as part of invitation creation,
- never reveal a Family to a MEMBER attempting OWNER administration,
- never reveal invitation existence to an unverified or mismatched User,
- never expose another User's email or identity,
- never include roles or invitations in authentication sessions,
- never log raw or normalized target emails routinely,
- never log invitation secrets or hashes,
- never log invitation request or response bodies,
- never place invitation material in analytics, traces, cache keys, cookies, or
  URLs,
- and never echo private input in errors.

Existing Family, Pregnancy, Child, and Timeline identical-404 behavior remains
unchanged.

Operational metrics may contain only aggregate counts without Family, User,
email, membership, invitation, or secret identifiers.

No audit-log implementation is approved. A future audit decision must define
privacy, access, retention, and redaction before recording invitation events.

---

# 21. Error Precedence

## Invitation creation

The server evaluates:

1. authentication — HTTP 401,
2. target-independent body validation — HTTP 400,
3. membership plus OWNER authorization and Family scope — identical
   `FAMILY_NOT_FOUND` HTTP 404,
4. duplicate active-pending invitation — HTTP 409,
5. creation — HTTP 201.

No target User lookup occurs.

## Invitation acceptance

The server evaluates:

1. authentication — HTTP 401,
2. target-independent body validation — HTTP 400,
3. verified-email requirement — HTTP 403 independent of invitation existence,
4. secret lookup and same-User consumed replay within one transaction,
5. for pending invitations, expiry, email binding, Family, and consumption
   within that transaction — identical `INVITATION_NOT_FOUND` HTTP 404,
6. success or same-User idempotent replay — HTTP 200.

Database constraint errors must map to these deterministic outcomes and must not
be exposed directly.

---

# 22. Migration Requirements

The future migration must:

- be additive and forward-only,
- use a truthful 2026 identifier,
- leave all existing migrations unchanged,
- add MEMBER to the existing PostgreSQL role enum,
- preserve every existing OWNER membership unchanged,
- verify every existing Family has exactly one OWNER before enabling the new
  behavior,
- add the partial unique OWNER constraint,
- create only the minimum invitation table and constraints,
- add only required indexes,
- avoid raw secret persistence,
- avoid account-existence coupling,
- avoid destructive data changes,
- and apply to clean and existing Timeline-foundation databases.

Migration rollback after shared deployment requires an explicit forward-fix or
recovery plan. Removing a PostgreSQL enum value is not a safe automatic rollback.

No migration may add relationship labels, guardian records, custom roles,
permission tables, member profiles, delivery state, or deferred lifecycle
fields.

---

# 23. Required Future Tests

The future implementation must test:

- exact OWNER and MEMBER vocabulary,
- absence of database role defaults,
- exactly one OWNER for every Family,
- second OWNER rejection,
- immutable roles,
- atomic Family plus OWNER creation regression,
- MEMBER access to every existing Family read, Pregnancy, Child, and Timeline
  operation,
- MEMBER rejection from invitation creation,
- OWNER invitation creation,
- target account existence-independent creation responses,
- strict email normalization and validation,
- strict request unknown-field rejection,
- 256-bit secret generation and exact encoding,
- raw secret returned once,
- only digest persistence,
- secret and email exclusion from logs, sessions, responses, and errors,
- seven-day expiry,
- expired invitation rejection,
- verified email required before lookup,
- matching verified email acceptance,
- wrong-email, invalid, unavailable, expired, and consumed non-owner outcomes
  sharing identical `INVITATION_NOT_FOUND`,
- serializable single-use consumption,
- concurrent acceptance,
- same-User idempotent replay,
- duplicate-membership prevention,
- existing-membership acceptance without role change,
- atomic consumption and membership rollback,
- cross-Family invitation isolation,
- invitation cannot create OWNER,
- duplicate pending invitation concurrency,
- restrictive referential behavior,
- no invitation or member-list endpoint,
- no role update, remove, leave, transfer, resend, reject, revoke, or deletion
  endpoint,
- package independence,
- one Prisma Client owner,
- clean migration deployment and status on disposable PostgreSQL,
- fixture cleanup,
- and regression of Authentication, Family, Pregnancy, Child, and Timeline.

Verification must use a repeatable disposable PostgreSQL command and must not
depend on persistent users, Families, memberships, invitations, or secrets.

---

# 24. Continuity and Acquisition Safeguards

Role, membership, invitation, and email-binding data remains user-entrusted
Family information.

The architecture preserves:

- explicit Family ownership,
- stable membership identity,
- replaceable authentication and delivery infrastructure,
- open future export compatibility,
- documented authorization semantics,
- and conservative referential behavior.

Founder absence, acquisition, bankruptcy, operator change, or shutdown must not:

- broaden invitation or membership visibility,
- reinterpret MEMBER or OWNER as commercial ownership of Family data,
- expose target emails or secrets,
- weaken role authorization,
- remove portability rights,
- or turn membership relationships into an unrestricted commercial dataset.

This decision does not implement export, retention, deletion, shutdown,
succession, audit, or ownership transfer.

---

# 25. Explicit Exclusions and Deferred Decisions

The following are not approved:

- implementation during Sprint 2.8A,
- roles beyond OWNER and MEMBER,
- multiple OWNER memberships,
- role changes,
- ownership transfer,
- last-owner workflows,
- relationship roles such as mother, father, guardian, caregiver, or relative,
- legal, custody, biological, or guardianship claims,
- custom roles,
- granular permission engine,
- direct membership addition,
- member listing or directory,
- member identity or email disclosure,
- member removal,
- member leave,
- Family deletion,
- Family rename,
- invitation lookup or list,
- pending-invitation discovery,
- rejection,
- manual revocation,
- resend,
- editable expiry,
- automated invitation email delivery,
- notification behavior,
- audit-log implementation,
- export, retention, shutdown, or succession implementation,
- Pregnancy-to-Child linkage,
- Timeline expansion,
- Media,
- Health,
- AI,
- guardianship,
- adult ownership transfer,
- and Family roles in Better Auth sessions.

Deferred behavior must not be anticipated through speculative fields, endpoints,
enums, package abstractions, or permissions.

---

# 26. Sprint 2.8B Implementation Gate

Sprint 2.8B is implemented.

All Family-role, permission, invitation, lifecycle, API, persistence, privacy,
and package decisions required for the minimum vertical are approved here and
realized by the Sprint 2.8B vertical.

The verified-email architecture is approved and implemented in
`docs/18-verified-email-ownership-architecture-decision.md`.

Sprint 2.8A.2 implemented and PostgreSQL-verified the approved canonical email,
delivery, Better Auth, principal, privacy, session, scanner-resistance, and
testing requirements without introducing a second authentication system or
custom verification cryptography.

Sprint 2.8B implements only:

- MEMBER enum support,
- exactly-one-OWNER preservation,
- minimum invitation persistence,
- the two endpoints in sections 12 and 13,
- secret generation and digest handling,
- OWNER-only creation,
- verified-email-bound atomic acceptance,
- tests in section 23,
- and truthful implementation documentation.

---

# 27. Sprint 2.8B Implementation Record

Sprint 2.8B implements:

- `OWNER` and `MEMBER` as the only FamilyMembership roles,
- PostgreSQL partial unique enforcement of exactly one OWNER per Family,
- additive `family_invitation` persistence with digest-only secret storage,
- `POST /families/:familyId/invitations` for OWNER-created MEMBER invitations,
- `POST /family-invitations/accept` for authenticated verified-email acceptance,
- atomic invitation consumption and MEMBER membership creation,
- same-User idempotent replay after consumption,
- identical non-enumerating `FAMILY_NOT_FOUND` and `INVITATION_NOT_FOUND`
  outcomes,
- and MEMBER access to already approved Family, Pregnancy, Child, and Timeline
  operations through persisted membership existence.

`pnpm test:family:postgres` verifies migration deploy/status, invitation
create/accept, digest-only persistence, concurrent create and accept races,
MEMBER domain access, MEMBER invitation denial, and existing Authentication,
Family, Pregnancy, Child, Timeline, and email-verification runtime suites.

No invitation email delivery, member listing, role change, removal, leave,
ownership transfer, or Family role session claims are implemented.

---

# 28. Future Review Triggers

Review this decision when:

- verified email ownership is approved and implemented,
- Sprint 2.8B begins,
- member listing is proposed,
- removal or leave is proposed,
- ownership transfer is proposed,
- another role is proposed,
- relationship or guardian semantics are proposed,
- automated invitation delivery is proposed,
- audit requirements become concrete,
- export or deletion requirements become concrete,
- or continuity, acquisition, privacy, or legal obligations change.

---

# 29. References

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
- `docs/16-timeline-domain-architecture-decision.md`
- `docs/18-verified-email-ownership-architecture-decision.md`
- `docs/99-deferred-decisions.md`
