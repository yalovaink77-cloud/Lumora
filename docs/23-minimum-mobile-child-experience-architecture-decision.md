# Minimum Mobile Child Experience Architecture Decision

Version: 1.0

Status: Approved — Documentation Complete (Client Not Implemented)

Phase: MVP Client Child Foundation

Decision date: 2026-07-23

---

# 1. Purpose

Sprint 2.11B completed the minimum Family-scoped Pregnancy experience in
`apps/mobile`. The next product gap is Family-scoped Child UI.

This decision defines the smallest truthful mobile Child experience that:

- uses only currently implemented Child API behavior,
- preserves Family as the privacy boundary,
- allows an authenticated Family member to list, create, open, and rename
  (displayName only) Child records for one accessible Family,
- navigates safely back to the owning Family,
- preserves Child heightened-privacy requirements,
- and reserves a future navigation boundary for Child Timeline UI without
  implementing Timeline, Pregnancy linkage, Health, Media, AI, guardianship, or
  deletion.

Sprint 2.12A is documentation-only. It does not implement Child UI, change
application code, dependencies, API routes, packages, Prisma schema,
migrations, or tests.

---

# 2. Verified Backend and Mobile State

## 2.1 Stored Child fields (implemented)

Prisma model `Child` / domain type `Child` contain exactly:

| Field         | Kind                        | User-visible meaning                                 |
| ------------- | --------------------------- | ---------------------------------------------------- |
| `id`          | system opaque identifier    | routing / identity only; not a product label         |
| `familyId`    | immutable Family ownership  | scope / owning Family context                        |
| `displayName` | user-authored product field | **only meaningful user-visible Child product field** |
| `createdAt`   | system timestamp            | optional secondary metadata                          |
| `updatedAt`   | system timestamp            | optional secondary metadata; refreshes on mutation   |

No other Child product field exists. In particular, the domain does **not**
store legal name, birth date, age, gender, demographics, guardian, photo,
Pregnancy association, Health values, or lifecycle/status.

`displayName` is a presentation label only (ADR-015). It is not a legal or
verified name, authentication identity, medical identification, ownership, or
guardianship evidence.

Because `displayName` exists as an approved meaningful user-visible field, and
because create/list/direct-get/`displayName` mutation APIs are implemented, this
mobile architecture is unblocked.

## 2.2 Child API contracts (implemented)

Controller: `ChildController` at `families/:familyId/children`, guarded by
`AuthGuard`.

Authorization (verified repository + ADR-017):

- every operation requires authentication and a persisted `FamilyMembership`
  for the path `familyId` and the authenticated principal,
- both `OWNER` and `MEMBER` may create, list, direct-get, and mutate
  `displayName`,
- the mobile client never decides authorization or role,
- roles and Child data must not enter Better Auth sessions or durable mobile
  identity state.

### Create

- **Method / path:** `POST /families/:familyId/children`
- **Body (only):** `{ "displayName": string }`
- **Validation (server authoritative; `@lumora/child`):**
  - `displayName` required
  - must be a string (`DISPLAY_NAME_INVALID` if not)
  - trimmed; empty/whitespace rejected (`DISPLAY_NAME_REQUIRED`)
  - trimmed value must contain between 1 and **80** Unicode code points
    (`DISPLAY_NAME_TOO_LONG` if more than 80)
  - exactly 80 Unicode code points accepted
  - unknown fields rejected (`UNKNOWN_FIELD`)
  - duplicate `displayName` values within one Family are allowed
  - no additional normalization beyond trim
- **Success:** Nest default POST success (HTTP 201) with one Child DTO:
  ```json
  {
    "id": "...",
    "familyId": "...",
    "displayName": "...",
    "createdAt": "<ISO-8601>",
    "updatedAt": "<ISO-8601>"
  }
  ```
- **Unavailable Family (missing or inaccessible):** HTTP 404 with
  `{ "statusCode": 404, "code": "FAMILY_NOT_FOUND", "message": "Family not found." }`
  — identical for missing and inaccessible Family (non-enumeration).

### List

- **Method / path:** `GET /families/:familyId/children`
- **Success body:**
  ```json
  {
    "children": [
      {
        "id": "...",
        "familyId": "...",
        "displayName": "...",
        "createdAt": "<ISO-8601>",
        "updatedAt": "<ISO-8601>"
      }
    ]
  }
  ```
- **Scope:** only Children in the path Family, and only when the caller has
  membership in that Family.
- **Ordering (verified repository contract):**
  `createdAt` ascending, then `id` ascending.
- **Pagination:** none.
- **Unavailable Family:** identical `FAMILY_NOT_FOUND` HTTP 404 as create.
- **Role / legal / medical / guardian / Pregnancy fields:** not included.

### Direct get

- **Method / path:** `GET /families/:familyId/children/:childId`
- **Success body:** the same minimum Child representation as list items.
- **Unavailable:** HTTP 404 with
  `{ "statusCode": 404, "code": "CHILD_NOT_FOUND", "message": "Child not found." }`
  for missing, inaccessible, cross-Family, and path-mismatched Child
  (non-enumeration).

### displayName mutation (implemented Sprint 2.6D)

- **Method / path:** `PATCH /families/:familyId/children/:childId`
- **Body (only):** `{ "displayName": string }`
- **Validation:** same rules as create (required trimmed string, 1–80 Unicode
  code points, unknown fields rejected).
- **Success:** HTTP 200 with the same minimum Child DTO (normalized
  `displayName`, refreshed `updatedAt`).
- **Same-value update (verified runtime):** submitting the current
  `displayName` is accepted and still refreshes `updatedAt`.
- **Duplicate labels:** allowed within one Family.
- **Unavailable target:** identical `CHILD_NOT_FOUND` HTTP 404 for missing
  Family, inaccessible Family, missing Child, inaccessible Child,
  path-mismatched Child, or missing Family/Child combination. Mutation must
  **not** return `FAMILY_NOT_FOUND` for these cases.
- **Not approved:** family reassignment, general Child update, deletion,
  optimistic-concurrency client preconditions, or any other field mutation.

### Explicitly out of this mobile sprint’s API surface

No Child deletion, lifecycle, guardian, Pregnancy-link, Timeline, Health, or
Media endpoints are part of this experience. Existing Timeline APIs remain
implemented on the backend and are **not** approved for mobile UI here.

## 2.3 Mobile shell, Family, and Pregnancy UI (implemented)

Verified through Sprint 2.11B:

- registration, sign-in, session restore, sign-out
- ADR-019 disclosure gate
- authenticated Home, Safety & Limitations
- Family list/create/detail
- Family-scoped Pregnancy list/create/detail
- Expo Router `(app)` disclosure continuation
- Better Auth Expo SecureStore cookie transport
- validated `EXPO_PUBLIC_LUMORA_API_BASE_URL`
- process-memory Family/Pregnancy state cleared on sign-out / principal change

Child routes can therefore be nested under an existing Family route inside
`(app)` and inherit authentication and disclosure guards.

---

# 3. Decision Summary

`apps/mobile` gains a minimum authenticated, Family-scoped Child experience
after disclosure continuation:

1. Family detail links to that Family’s Children list.
2. Children list loads via `GET /families/:familyId/children`.
3. Empty list offers create.
4. Create uses `POST /families/:familyId/children` with `{ displayName }` only.
5. Successful creation refreshes the Family-scoped list and opens the created
   Child detail.
6. Selecting a list item opens `GET /families/:familyId/children/:childId`.
7. Child detail offers one approved edit-displayName action.
8. Edit uses `PATCH /families/:familyId/children/:childId` with
   `{ displayName }` only; success refreshes detail/list and returns to Child
   detail.
9. Unavailable Family or Child routes show generic privacy-safe states.
10. Home, Families, Pregnancies, Safety & Limitations, and sign-out remain
    available through established shell navigation.
11. No Pregnancy linkage, Timeline, Health, Media, AI, guardian, deletion, or
    medical/legal inference UI is approved.

Server remains the authorization authority. The mobile client never decides
membership or roles.

---

# 4. Approved Product Flow

After disclosure continuation (`status === "authenticated"`):

```text
Home
  → Families list
      → Family detail
          → Children list (for that Family)
              → Create Child → (success) Child detail
              → Child detail
                  → Edit displayName → (success) Child detail
  → Safety & Limitations (existing)
  → Sign out (existing)
```

Rules:

- Disclosure precedes all Child routes via the `(app)` guard.
- Authentication precedes disclosure and Child routes.
- Child navigation remains nested under one Family; no cross-Family list or
  global Child feed is approved.
- Back navigation: Child detail → Children list; Children list → Family detail;
  edit → Child detail (or cancel to Child detail).
- Back navigation must not bypass disclosure for the current process lifetime.

---

# 5. Mobile Routes

All routes are Expo Router file routes inside the authenticated `(app)` group and
nested under the existing Family detail path segment.

| Surface          | Route                                                | Purpose                         |
| ---------------- | ---------------------------------------------------- | ------------------------------- |
| Children list    | `/(app)/families/[familyId]/children`                | Family-scoped Child list        |
| Create Child     | `/(app)/families/[familyId]/children/create`         | Dedicated create screen         |
| Child detail     | `/(app)/families/[familyId]/children/[childId]`      | Minimum Child detail            |
| Edit displayName | `/(app)/families/[familyId]/children/[childId]/edit` | Dedicated displayName edit only |

**Edit approach decision:** use one dedicated edit route (not an in-detail
inline mode). Rationale: clearer focus order, keyboard-safe form behavior, and a
simpler guard/test surface — matching the approved Family/Pregnancy create
pattern — while remaining the smallest testable mutation UI.

Family detail (`/(app)/families/[familyId]`) gains one clear accessible entry to
the Children list for that Family in the implementation sprint, in addition to
the existing Pregnancies entry. No non-functional Timeline/Child-count/dashboard
controls are approved.

Deep links must still pass authentication and disclosure guards. Identifiers
appear only as path segments. `familyId` and `childId` must be path-encoded
safely.

---

# 6. Child List Behavior

## 6.1 Request

- `GET {API_BASE}/families/{familyId}/children`
- Cookie session via Better Auth Expo `getCookie()`
- `credentials: "omit"`
- No bearer/JWT
- `familyId` path-encoded

## 6.2 Presentation fields

For each Child, show:

- `displayName` (primary)
- optional secondary `createdAt` (conservative YYYY-MM-DD style display; not a
  birth date or medical date)

Do **not** show role, guardian, legal name, age, gender, Pregnancy linkage, or
Timeline preview.

Owning Family context may use already-loaded Family `displayName` / route
context when available.

## 6.3 Ordering

Preserve server order: `createdAt` ascending, then `id` ascending.
Do not re-sort client-side into a different product order.

## 6.4 States

- **Loading**
- **Empty:** `children: []` — primary action Create Child
- **Populated:** items navigate to detail for the same `familyId`
- **Unavailable Family:** HTTP 404 `FAMILY_NOT_FOUND` — generic Family
  unavailable; safe return to Families
- **Retryable network/timeout error**
- **Unauthorized (401):** central auth sign-out; clear Child in-memory state

## 6.5 Refresh and pagination

- **Pull-to-refresh:** approved
- **Pagination:** not approved
- **In-memory cache:** process memory for current principal + `familyId` only
- **No AsyncStorage / SecureStore** for Child domain data

---

# 7. Child Creation Behavior

## 7.1 Route and request

- Screen: `/(app)/families/[familyId]/children/create`
- `POST {API_BASE}/families/{familyId}/children`
- Body: `{ "displayName": string }` only

## 7.2 Client validation (fail-fast, server authoritative)

Mirror server rules:

- required string
- trim for submission
- non-empty after trim
- maximum **80** Unicode code points (count code points, not UTF-16 units)
- no additional normalization
- no unknown fields

Map HTTP 400 codes to generic field-safe messages without echoing payloads.

## 7.3 Submission UX

- Disable submit while in flight
- Visible progress
- Keyboard-safe; accessible label/error association
- **No optimistic creation**
- On success:
  1. refresh/update the in-memory Child list for that `familyId`,
  2. navigate to `/(app)/families/{familyId}/children/{createdChildId}`
- On `FAMILY_NOT_FOUND`: generic Family unavailable
- Prevent stale success navigation after sign-out, principal change, or Family
  context change
- Cancel/back returns to the Children list for the same Family

## 7.4 Explicit non-goals for creation

No legal name, birth date, age, gender, guardian, photo, Pregnancy association,
Health fields, Timeline event, or onboarding wizard.

---

# 8. Child Detail Behavior

## 8.1 Route and request

- Screen: `/(app)/families/[familyId]/children/[childId]`
- `GET {API_BASE}/families/{familyId}/children/{childId}`
- Same cookie transport; both identifiers path-encoded

## 8.2 Presentation fields

Show:

- `displayName` (title)
- optional `createdAt` / `updatedAt` as secondary metadata
- owning Family context via route/Family memory when available

Do not present `displayName` as a legal or verified name. Do not show guardian,
Pregnancy, Timeline, Health, or medical interpretation controls.

## 8.3 States

- **Loading**
- **Available**
- **Unavailable:** identical generic “Child not found” for HTTP 404
  `CHILD_NOT_FOUND`
- **Retryable network error**
- **Unauthorized:** central auth sign-out path

## 8.4 Approved actions

- One accessible **Edit name** / **Edit display name** action navigating to the
  dedicated edit route
- Safe back navigation to Children list

## 8.5 Explicit non-goals for detail

No deletion, lifecycle/status, guardian/ownership, Pregnancy linkage, Timeline
button/placeholder, Media, Health, or AI controls.

A future Child Timeline entry point may be reserved **in architecture only**.
The first Child UI implementation must not show a non-functional Timeline
control.

---

# 9. displayName Edit Behavior

## 9.1 Route and request

- Screen: `/(app)/families/[familyId]/children/[childId]/edit`
- `PATCH {API_BASE}/families/{familyId}/children/{childId}`
- Body: `{ "displayName": string }` only

## 9.2 Client validation

Same as create (trim, non-empty, max 80 Unicode code points, no unknown fields).
Server remains authoritative.

## 9.3 Submission UX

- Prefill with current `displayName` when available from detail memory or a
  prior successful get
- Disable submit while in flight (duplicate-submit prevention)
- Visible progress
- Keyboard-safe; accessible label/error association
- **Pessimistic mutation only** (no optimistic rename): wait for successful
  response before updating durable list/detail memory or navigating
- On success:
  1. update in-memory detail and matching list entry for that `familyId`
     using the returned DTO (including refreshed `updatedAt`),
  2. navigate with `replace` to
     `/(app)/families/{familyId}/children/{childId}`
- Same-value submission is allowed and must be treated as success when the
  server returns 200
- On `CHILD_NOT_FOUND`: generic Child unavailable; do not distinguish causes
- Prevent stale success navigation after sign-out, principal change, or Family
  context change
- Cancel/back returns to Child detail for the same identifiers

## 9.4 Explicit non-goals for edit

No general Child editing, family reassignment, deletion, or additional fields.

---

# 10. Mobile Child API Client Architecture

Implement the smallest client inside `apps/mobile` (for example `src/child/`),
not a new generalized domain SDK package.

## 10.1 Transport

- Reuse Better Auth Expo cookie transport (`getCookie()`)
- Reuse validated API base URL helper
- Nested Family/Child paths exactly as implemented
- Path-safe encoding for `familyId` and `childId`
- No custom JWT / bearer tokens
- No Prisma / Nest / backend framework types
- Exact DTO mapping; reject malformed shapes
- Verify response `familyId` matches the path Family

## 10.2 Reliability

- Bounded timeout default: 15 seconds
- `AbortController` cancellation on route exit, sign-out, principal change, and
  Family context change
- Stale-response protection via generation/sequence tokens
- Distinguish:
  - `unauthorized` (401) → central session boundary; clear Child memory
  - `family_not_found` (404 `FAMILY_NOT_FOUND`) on create/list
  - `child_not_found` (404 `CHILD_NOT_FOUND`) on get/update
  - `validation` (400 with known codes)
  - `network` / timeout / abort → retryable
  - generic server / malformed → safe failure
- No infinite retry

## 10.3 Logging

- No cookies, tokens, emails, Child payloads, Family payloads, or raw response
  bodies in routine logs
- No sensitive debug UI

## 10.4 Permitted HTTP-helper refactor boundary

A small mobile-internal HTTP helper may be extracted from Family/Pregnancy
clients only if it removes proven duplication (cookie header, omit credentials,
timeout/abort wiring, unauthorized mapping) without becoming a cross-domain SDK,
without merging DTO/state stores, and without changing existing Family/Pregnancy
behavior. Otherwise duplicate the smallest pattern.

---

# 11. State Ownership

| Concern                                | Owner                                  |
| -------------------------------------- | -------------------------------------- |
| Membership / authorization             | Server (`FamilyMembership`)            |
| Session authenticity                   | Better Auth server + mobile auth shell |
| Child list/detail/create/edit UI state | Mobile process memory only             |
| Family / Pregnancy UI state            | Existing process-memory providers      |
| Disclosure continuation                | Existing in-memory shell flag          |

Rules:

- Server remains authoritative
- Child state scoped by `familyId` (detail/edit by `childId`)
- No offline-first, background sync, or domain SecureStore/AsyncStorage
- Clear all Child memory on sign-out and principal change
- Clear or isolate when Family context changes
- Cancel in-flight Child requests on route exit / sign-out / principal change /
  Family change
- Stale responses must not populate another user or Family
- Refresh list after successful create
- Synchronize list/detail after successful displayName update using the
  returned DTO
- No optimistic create; no optimistic rename
- Error state must be resettable
- Avoid a global state framework unless already approved and required

---

# 12. Navigation and Guards

- Child routes live only under `(app)` and under
  `families/[familyId]/children…`
- `(app)` requires `authenticated` (disclosure continued)
- Unauthenticated → sign-in; `authenticated-entry` → `/disclosure`
- Invalid/inaccessible Family/Child routes fail safely after the
  auth/disclosure gate
- Direct/deep-link access does not bypass privacy checks
- Sign-out / principal change clears Child state and protected navigation
- No redirect loops among Home, Families, Family detail, Pregnancies,
  Children, disclosure, and auth
- Home, Families, Pregnancies, Safety & Limitations, and sign-out remain
  reachable through established navigation

---

# 13. Heightened Child Privacy and Safety

Child records have heightened privacy protection relative to ordinary
organizational labels.

Rules:

- `displayName` is a user-provided presentation label only
- it is not a legal or verified name
- it is not authentication, identity verification, medical identification,
  ownership, or guardianship evidence
- a Child record is not a login account or session identity
- no Child data enters authentication sessions or durable principal state
- no Child data in analytics, routine logs, crash payloads, notification
  previews, or URL query strings
- no local domain-data persistence
- no legal, medical, developmental, demographic, age, maturity, or lifecycle
  inference from Child fields or timestamps
- no Pregnancy linkage or adult-ownership assumption in UI
- membership role must not be displayed as parenthood or guardianship
- Safety & Limitations remains available through the existing shell route
- ADR-019 disclosure does not authorize future Health or AI Child behavior

---

# 14. Accessibility and Presentation Minimums

- Readable text scaling
- Screen-reader headings and labels
- List semantics
- Logical focus order on create/edit forms
- Sufficient contrast
- Minimum ~48 dp touch targets
- Loading and error announcements
- Keyboard-safe create and edit forms
- Error association with the `displayName` input
- Non-color-only errors
- Long Unicode `displayName` wrapping/truncation without losing accessible full
  value
- Safe Area handling
- Accessible refresh / retry / create / edit / back actions

Do not create a complete visual/branding system in the implementation sprint.

---

# 15. Testing Strategy (for the implementation sprint)

## 15.1 Child API client

- create / list / get / update success
- exact DTO mapping and `familyId` consistency
- malformed response
- `FAMILY_NOT_FOUND` / `CHILD_NOT_FOUND`
- validation errors
- unauthorized / session expiry
- network / server errors
- timeout / cancellation
- path encoding
- no JWT/bearer
- no sensitive logging

## 15.2 Validation

- missing / invalid / whitespace-only
- trimming
- 1 and 80 Unicode code points accepted
- 81 rejected
- emoji/surrogate-pair handling
- duplicate labels allowed
- unknown fields rejected
- same-value update accepted

## 15.3 State

- Family isolation
- create refresh
- detail state
- update list/detail synchronization and `updatedAt` refresh
- sign-out / principal / Family clearing
- stale-response protection
- no persistence
- no optimistic create/rename

## 15.4 Navigation / screens

- Family detail → Children
- list / empty / create / detail / edit
- create success → created detail
- update success → detail
- generic unavailable Family/Child states
- auth / disclosure guards
- correct back behavior
- no redirect loops

## 15.5 Privacy / architecture

- no legal / medical / guardian / Pregnancy fields
- no Timeline UI or placeholders
- no session role / Child data
- no local persistence / analytics
- no backend framework imports
- no API/schema/migration change
- Safety & Limitations remains accessible

## 15.6 Regression

- authentication / session / disclosure
- Family mobile flow
- Pregnancy mobile flow
- backend OWNER/MEMBER Child access
- Timeline and invitation PostgreSQL suites

---

# 16. Device / Emulator Smoke (implementation sprint)

When a device or emulator is available, verify:

1. Sign in
2. Complete disclosure
3. Select or create a Family
4. Open Children from Family detail
5. Empty or populated list
6. Create Child
7. Open Child detail
8. Update displayName
9. Pull-to-refresh list
10. Unavailable Family / Child route shows generic not-found UI
11. Cold restart / session restoration still requires disclosure
12. Sign out

This documentation sprint does not claim device verification.

---

# 17. Implementation Slicing

## 17.1 Exact next implementation sprint

**Sprint 2.12B — Minimum Mobile Child List, Create, Detail, and displayName Edit**

In scope:

- mobile Child API client (cookie transport, timeout, abort, DTO mapping)
- optional tiny shared authenticated HTTP helper under the §10.4 boundary
- Family-scoped Child process-memory state
- Children list / create / detail / displayName edit screens
- Family detail entry to Children
- navigation/guards within existing authenticated + disclosure shell
- focused client/navigation/state/privacy/accessibility tests
- Android/iOS interactive smoke when available

Out of scope for 2.12B:

- Timeline UI (including non-functional controls)
- Pregnancy linkage
- Child deletion / lifecycle / status
- legal name / birth date / age / gender / demographics
- guardianship / ownership transfer
- Media / Health / AI
- invitation / member / role UI
- offline sync / local domain persistence
- API/schema/migration changes

Sprint 2.12B is architecturally unblocked by this decision.

---

# 18. Explicit Exclusions and Deferred Decisions

This decision does not implement or approve:

- Child UI code in Sprint 2.12A
- general Child update beyond `displayName`
- family reassignment
- deletion / lifecycle / status
- legal name / birth date / age / gender / demographics
- guardianship / custody / ownership
- Pregnancy linkage or Pregnancy-to-Child transition
- Child login / session identity
- Timeline UI or Timeline placeholders
- Media / Health / AI
- notifications
- invitation / member / role UI
- analytics / crash-reporting SDK
- local domain-data persistence or offline sync
- push / background refresh
- pagination or search/filter
- localization architecture
- admin/web Child UI
- API/schema/migration changes
- generalized design system
- pilot/Beta planning

Deferred:

- Child Timeline mobile entry after a dedicated Timeline mobile ADR
- any birth-related date or second Child product field only through ADR-015
  review triggers
- guardian/adult ownership transition
- Pregnancy-to-Child relationship UI

---

# 19. Sprint 2.12A Completion Record

Sprint 2.12A documents:

- verified Child stored fields and meaningful `displayName` field
- verified nested create/list/direct-get/`displayName` mutation contracts
- verified 80 Unicode code-point limit, ordering, same-value update +
  `updatedAt` refresh, and not-found codes
- OWNER/MEMBER authorization behavior for Child operations
- approved Family-nested mobile routes including dedicated edit route
- cookie-based Child API client boundary and optional HTTP helper refactor
  boundary
- Family-scoped process-memory state ownership
- pessimistic create/rename behavior
- navigation/guard requirements behind disclosure
- heightened privacy, safety, and accessibility minimums
- testing and device-smoke expectations
- exact follow-on implementation sprint 2.12B

No application code, dependencies, lockfiles, schema, migrations, or tests are
changed by this sprint.
