# Minimum Mobile Timeline Experience Architecture Decision

Version: 1.0

Status: Approved — Documentation Complete (Client Not Implemented)

Phase: MVP Client Timeline Foundation

Decision date: 2026-07-23

---

# 1. Purpose

Sprint 2.12B completed the minimum Family-scoped Child experience in
`apps/mobile`. The next product gap is subject-scoped Timeline UI.

This decision defines the smallest truthful mobile Timeline experience that:

- uses only currently implemented Timeline API behavior,
- preserves Family as the privacy boundary,
- preserves exactly-one-subject Timeline targeting (one Pregnancy **or** one
  Child, never both, never neither),
- allows an authenticated Family member to list, create, and open Timeline
  events for one Pregnancy and, separately, for one Child,
- navigates safely within the owning Family and subject,
- presents events as unverified user-authored statements,
- and avoids medical, developmental, lifecycle, or AI interpretation.

Sprint 2.13A is documentation-only. It does not implement Timeline UI, change
application code, dependencies, API routes, packages, Prisma schema,
migrations, or tests.

---

# 2. Verified Backend and Mobile State

## 2.1 Stored Timeline event fields (implemented)

Prisma model / domain type contain exactly:

| Field         | Kind                        | Notes                                             |
| ------------- | --------------------------- | ------------------------------------------------- |
| `id`          | system opaque identifier    | routing / identity only                           |
| `familyId`    | immutable Family ownership  | same Family as the subject                        |
| `pregnancyId` | optional subject FK         | present iff Pregnancy subject; mutually exclusive |
| `childId`     | optional subject FK         | present iff Child subject; mutually exclusive     |
| `title`       | user-authored product field | presentation text only                            |
| `occurredAt`  | user-authored instant       | when the user says the event occurred             |
| `createdAt`   | system timestamp            | may differ from `occurredAt`                      |
| `updatedAt`   | system timestamp            | system-managed                                    |

Exactly-one-subject rules (verified ADR-016 + repository + DB check):

- every event belongs to one Family,
- every event targets exactly one Pregnancy **or** one Child,
- never both, never neither,
- the subject must belong to the same Family,
- no Family-wide event subject or feed exists.

User-provided fields are only `title` and `occurredAt`. No note, category,
Media, Health, AI, reminder, or system-generated milestone fields exist.

## 2.2 Timeline API contracts (implemented)

Controllers (AuthGuard):

- `PregnancyTimelineController` at
  `families/:familyId/pregnancies/:pregnancyId/timeline-events`
- `ChildTimelineController` at
  `families/:familyId/children/:childId/timeline-events`

Authorization (verified repository + ADR-016 / ADR-017):

- every operation requires authentication and a persisted `FamilyMembership`
  for the path `familyId` and the authenticated principal,
- both `OWNER` and `MEMBER` may create, list, and direct-get Timeline events
  for accessible subjects,
- the mobile client never decides authorization or role,
- roles and Timeline payloads must not enter Better Auth sessions or durable
  mobile identity state.

### Pregnancy create

- **Method / path:**
  `POST /families/:familyId/pregnancies/:pregnancyId/timeline-events`
- **Body (only):** `{ "title": string, "occurredAt": string }`
- **Success:** Nest default POST success (HTTP 201) with:
  ```json
  {
    "id": "...",
    "familyId": "...",
    "pregnancyId": "...",
    "title": "...",
    "occurredAt": "YYYY-MM-DDTHH:mm:ss.SSSZ",
    "createdAt": "<ISO-8601>",
    "updatedAt": "<ISO-8601>"
  }
  ```
- Response must not contain `childId`, `subjectType`, or a generic
  `subjectId`.

### Pregnancy list

- **Method / path:**
  `GET /families/:familyId/pregnancies/:pregnancyId/timeline-events`
- **Success body:** `{ "timelineEvents": [ ...Pregnancy event DTOs ] }`
- **Ordering (verified):** `occurredAt` desc, then `createdAt` desc, then `id`
  desc
- **Pagination:** none; no query parameters accepted
- Empty authorized subject returns `{ "timelineEvents": [] }`

### Pregnancy direct get

- **Method / path:**
  `GET /families/:familyId/pregnancies/:pregnancyId/timeline-events/:timelineEventId`
- **Success body:** one Pregnancy event DTO

### Child create / list / direct get

Same contracts under:

- `POST /families/:familyId/children/:childId/timeline-events`
- `GET /families/:familyId/children/:childId/timeline-events`
- `GET /families/:familyId/children/:childId/timeline-events/:timelineEventId`

Child success DTOs contain `childId` and must not contain `pregnancyId`.

### Title validation (server authoritative; `@lumora/timeline`)

- required string
- trimmed; empty/whitespace rejected (`TITLE_REQUIRED`)
- must be well-formed Unicode without NUL (`TITLE_INVALID`)
- trimmed value between 1 and **80** Unicode code points (`TITLE_TOO_LONG`)
- duplicates allowed within one subject
- unknown fields rejected (`UNKNOWN_FIELD`)

### occurredAt validation (server authoritative)

Accepted RFC 3339 profile only:

```text
YYYY-MM-DDTHH:mm:ss.SSSZ
YYYY-MM-DDTHH:mm:ss.SSS±HH:mm
```

Rules verified in package tests and ADR-016:

- exactly three millisecond digits required
- explicit `Z` or numeric offset required
- date-only and offset-less local date-times rejected
- nonexistent calendar values rejected
- years `0001`–`9999` after UTC normalization
- no past/future server-clock rejection
- persisted as timezone-aware instant; responses serialize canonical UTC
  `YYYY-MM-DDTHH:mm:ss.SSSZ` via `toISOString()`
- original offset is not retained as a separate field

### Unavailable targets

Every unavailable create/list/get target returns identical HTTP 404:

```json
{
  "statusCode": 404,
  "code": "TIMELINE_NOT_FOUND",
  "message": "Timeline resource not found."
}
```

This applies for missing/inaccessible Family, Pregnancy, Child, event,
cross-Family, and wrong-subject combinations. Timeline endpoints do **not**
return `FAMILY_NOT_FOUND`, `PREGNANCY_NOT_FOUND`, or `CHILD_NOT_FOUND`.

Validation failures return HTTP 400 with
`TITLE_*` / `OCCURRED_AT_*` / `UNKNOWN_FIELD` / `UNKNOWN_QUERY_PARAMETER` and
must not echo submitted values.

### Explicitly out of this mobile sprint’s API surface

No Timeline update, delete, reassignment, combined feed, Media, Health, AI, or
notification endpoints are approved or implemented.

## 2.3 Mobile shell, Family, Pregnancy, and Child UI (implemented)

Verified through Sprint 2.12B:

- authentication, disclosure, Safety & Limitations
- Family list/create/detail
- Family-scoped Pregnancy list/create/detail
- Family-scoped Child list/create/detail/displayName edit
- Expo Router `(app)` disclosure continuation
- Better Auth Expo SecureStore cookie transport
- validated `EXPO_PUBLIC_LUMORA_API_BASE_URL`
- process-memory Family/Pregnancy/Child state cleared on sign-out / principal
  change

Timeline routes can therefore nest under existing Pregnancy and Child detail
paths inside `(app)` and inherit authentication and disclosure guards.

---

# 3. Decision Summary

`apps/mobile` gains a minimum authenticated, subject-scoped Timeline experience
after disclosure continuation:

1. Pregnancy detail links to that Pregnancy’s Timeline list.
2. Child detail links to that Child’s Timeline list.
3. Each list loads via the subject-specific GET Timeline API.
4. Empty list offers create.
5. Create uses subject-specific POST with `{ title, occurredAt }` only.
6. Successful creation refreshes the subject-scoped list and opens the created
   event detail.
7. Selecting a list item opens the subject-specific direct-get detail.
8. Unavailable Family/subject/event routes show generic privacy-safe
   `TIMELINE_NOT_FOUND` UI.
9. Pregnancy and Child Timeline trees remain separate; no combined feed.
10. No update/delete, Media, Health, AI, category, note, or Pregnancy-to-Child
    linkage UI is approved.

Server remains the authorization authority.

---

# 4. Approved Product Flows

After disclosure continuation (`status === "authenticated"`):

```text
Home
  → Families
      → Family detail
          → Pregnancies
              → Pregnancy detail
                  → Pregnancy Timeline list
                      → Create event → (success) Pregnancy event detail
                      → Pregnancy event detail
          → Children
              → Child detail
                  → Child Timeline list
                      → Create event → (success) Child event detail
                      → Child event detail
  → Safety & Limitations (existing)
  → Sign out (existing)
```

Rules:

- Disclosure and authentication precede all Timeline routes.
- Subject identity remains explicit in routes; no polymorphic create body.
- No Family-wide or Pregnancy+Child combined Timeline feed.
- Back navigation:
  - event detail → subject Timeline list
  - create cancel → subject Timeline list
  - Timeline list → owning Pregnancy or Child detail
- Back navigation must not bypass disclosure for the current process lifetime.

---

# 5. Mobile Routes

All routes are Expo Router file routes inside authenticated `(app)`.

## 5.1 Pregnancy Timeline

| Surface       | Route                                                                             |
| ------------- | --------------------------------------------------------------------------------- |
| Timeline list | `/(app)/families/[familyId]/pregnancies/[pregnancyId]/timeline`                   |
| Create event  | `/(app)/families/[familyId]/pregnancies/[pregnancyId]/timeline/create`            |
| Event detail  | `/(app)/families/[familyId]/pregnancies/[pregnancyId]/timeline/[timelineEventId]` |

## 5.2 Child Timeline

| Surface       | Route                                                                      |
| ------------- | -------------------------------------------------------------------------- |
| Timeline list | `/(app)/families/[familyId]/children/[childId]/timeline`                   |
| Create event  | `/(app)/families/[familyId]/children/[childId]/timeline/create`            |
| Event detail  | `/(app)/families/[familyId]/children/[childId]/timeline/[timelineEventId]` |

Pregnancy detail and Child detail each gain one accessible Timeline entry in
the implementation sprint. No non-functional Media/Health/AI/update/delete
controls are approved.

Deep links must still pass authentication and disclosure guards. Identifiers
appear only as path segments and must be path-encoded safely. No Timeline
identifiers in query strings.

---

# 6. Timeline List Behavior

## 6.1 Requests

- Pregnancy:
  `GET {API_BASE}/families/{familyId}/pregnancies/{pregnancyId}/timeline-events`
- Child:
  `GET {API_BASE}/families/{familyId}/children/{childId}/timeline-events`
- Cookie session via Better Auth Expo `getCookie()`
- `credentials: "omit"`
- No bearer/JWT
- All path identifiers encoded

## 6.2 Presentation fields

For each event, show:

- `title` (primary)
- `occurredAt` presented in device-local readable date/time text derived from
  the UTC response instant

Optional secondary `createdAt` may appear only as non-medical metadata if
needed for clarity; it must never replace or imply `occurredAt`.

Do **not** show categories, icons implying medical meaning, risk colors,
inferred milestones, gestational age, developmental stage, Media, Health, AI,
or the other subject type.

## 6.3 Ordering

Preserve server order exactly:

1. `occurredAt` descending
2. `createdAt` descending
3. `id` descending

Do not re-sort client-side into a different product order.

## 6.4 States

- **Loading**
- **Empty:** `timelineEvents: []` — primary action Create event
- **Populated:** items navigate to subject-scoped event detail
- **Unavailable:** HTTP 404 `TIMELINE_NOT_FOUND` — generic Timeline unavailable;
  safe return to the owning Pregnancy or Child detail (or Families if subject
  context is unusable)
- **Retryable network/timeout error**
- **Unauthorized (401):** central auth sign-out; clear Timeline in-memory state

## 6.5 Refresh and pagination

- **Pull-to-refresh:** approved
- **Pagination:** not approved (API provides none)
- **In-memory cache:** process memory for current principal + Family + subject
  type + subject ID only
- **No AsyncStorage / SecureStore** for Timeline domain data

---

# 7. Timeline Creation Behavior

## 7.1 Routes and requests

- Pregnancy create screen →
  `POST …/pregnancies/{pregnancyId}/timeline-events`
- Child create screen →
  `POST …/children/{childId}/timeline-events`
- Body: `{ "title": string, "occurredAt": string }` only

## 7.2 Title validation (fail-fast, server authoritative)

Mirror server rules:

- required string
- trim for submission
- non-empty after trim
- maximum **80** Unicode code points
- well-formed Unicode; reject NUL / ill-formed surrogate pairs client-side when
  practical
- no unknown fields

## 7.3 occurredAt capture (approved mobile interaction)

### Interaction

Use platform-native date and time selection through
`@react-native-community/datetimepicker` (Expo SDK 57 compatible; see §10).

Approved create UX:

1. Prefill an editable local date/time with the device’s current instant as a
   convenience (“now”).
2. Require explicit user interaction with the native date control **and** the
   native time control before the first successful submit of a newly opened
   create screen may proceed, **or** require an explicit accessible
   confirmation that the prefilled “now” value is accepted.
3. Present date and time in device-local UI.
4. Convert the confirmed local selection into one RFC 3339 string with exactly
   three millisecond digits and an explicit offset (`Z` or `±HH:mm`) before
   submission.
5. Prefer serialization with the device’s numeric offset at confirmation time,
   or equivalent UTC `Z` via `Date#toISOString()` after constructing the
   confirmed local instant — both are accepted by the API.
6. Do not manually parse locale-formatted free-text dates typed by the user.
7. Do not treat `createdAt` as `occurredAt`.
8. Do not calculate gestational age, age, trimester, due date, development, or
   medical timing from the selection.

### Dependency decision

A mobile dependency **is required** for safe native date/time selection in the
implementation sprint:

- package: `@react-native-community/datetimepicker`
- installation method: `pnpm --filter @lumora/mobile exec expo install
@react-native-community/datetimepicker` (or equivalent Expo-managed install)
  so Expo selects the SDK 57–compatible version
- do **not** pin an arbitrary unvetted latest version outside Expo’s
  compatibility resolution
- do **not** install the dependency in Sprint 2.13A
- do **not** require native prebuild directories (`android/` / `ios/`) solely for
  this documentation sprint; the implementation sprint must remain within the
  existing Expo managed/export verification pattern unless Expo’s install path
  itself requires a documented plugin addition

If Expo’s install path later proves incompatible with the repository’s
no-prebuild verification policy, stop and open a focused decision rather than
inventing a free-text date parser.

### Display after API UTC normalization

List/detail screens convert the response UTC `occurredAt` into device-local
readable date/time text. If the device timezone later changes, presentation may
change; the persisted instant does not. No original offset field exists to
restore.

### Accessibility

Native date/time controls must expose accessible labels/hints. Confirmed
selection must also appear as readable text associated with the create form.
Errors for invalid/missing occurredAt must be announced and not color-only.

## 7.4 Submission UX

- Disable submit while in flight
- Visible progress
- Keyboard-safe title field; accessible label/error association
- **No optimistic creation**
- On success:
  1. refresh/update the in-memory Timeline list for that Family + subject,
  2. navigate to the created event detail under the same subject tree
- On `TIMELINE_NOT_FOUND`: generic Timeline unavailable
- Prevent stale success navigation after sign-out, principal change, Family
  change, or subject change
- Cancel/back returns to the subject Timeline list

## 7.5 Explicit non-goals for creation

No note, description, category, location, Media, Health, AI content, reminder,
system-generated event, Pregnancy-to-Child linkage, or subject reassignment.

---

# 8. Timeline Event Detail Behavior

## 8.1 Routes and requests

- Pregnancy:
  `GET …/pregnancies/{pregnancyId}/timeline-events/{timelineEventId}`
- Child:
  `GET …/children/{childId}/timeline-events/{timelineEventId}`

## 8.2 Presentation fields

Show:

- `title`
- device-local presentation of `occurredAt`
- optional secondary `createdAt` / `updatedAt` as system metadata
- owning subject context via route / Pregnancy or Child memory when available

Present explicit user-authored / unverified meaning where appropriate (for
example: “User-authored Timeline note. Not a medical record.”).

## 8.3 States

- **Loading**
- **Available**
- **Unavailable:** identical generic “Timeline resource not found” for HTTP 404
  `TIMELINE_NOT_FOUND`
- **Retryable network error**
- **Unauthorized:** central auth sign-out path

## 8.4 Approved actions

- Safe back navigation to the subject Timeline list

## 8.5 Explicit non-goals for detail

No edit, delete, Media, Health, AI interpretation, subject reassignment, or
cross-link to the other subject type.

---

# 9. Mobile Timeline API Client Architecture

Implement the smallest client inside `apps/mobile` (for example
`src/timeline/`), not a new generalized domain SDK package.

## 9.1 Transport and methods

- Reuse Better Auth Expo cookie transport (`getCookie()`)
- Reuse validated API base URL helper
- Separate public methods for Pregnancy and Child create/list/get
- Internal shared request implementation is allowed only if it does **not**
  expose a polymorphic external request body that accepts subject type/id
- Path-safe encoding for `familyId`, subject id, and `timelineEventId`
- No custom JWT / bearer tokens
- No Prisma / Nest / backend framework types
- Exact DTO mapping; reject malformed shapes
- Enforce response `familyId` matches path Family
- Enforce exactly-one-subject response shape:
  - Pregnancy DTO must include `pregnancyId` and must not include `childId`
  - Child DTO must include `childId` and must not include `pregnancyId`
- Enforce response subject id matches path subject id

## 9.2 Reliability

- Bounded timeout default: 15 seconds
- `AbortController` cancellation on route exit, sign-out, principal change,
  Family change, and subject change
- Stale-response protection via generation/sequence tokens
- Distinguish:
  - `unauthorized` (401) → central session boundary; clear Timeline memory
  - `timeline_not_found` (404 `TIMELINE_NOT_FOUND`) for create/list/get
    unavailable Family/subject/event outcomes
  - `validation` (400 with known codes)
  - `network` / timeout / abort → retryable
  - generic server / malformed → safe failure
- No infinite retry

## 9.3 Logging

- No cookies, tokens, emails, Timeline payloads, titles, occurredAt values,
  Family/Pregnancy/Child payloads, or raw response bodies in routine logs
- No sensitive debug UI

## 9.4 Permitted HTTP-helper refactor boundary

A small mobile-internal HTTP helper may be extracted from
Family/Pregnancy/Child clients only if it removes proven duplication without
becoming a cross-domain SDK, without merging DTO/state stores, and without
changing existing Family/Pregnancy/Child behavior. Otherwise duplicate the
smallest pattern.

---

# 10. Dependency Requirement for Implementation Sprint

Sprint **2.13B** must add:

`@react-native-community/datetimepicker`

selected through Expo’s SDK-compatible install path for the current Expo SDK
(`~57`). No other date/time library is approved by this decision. No dependency
is installed in Sprint 2.13A.

---

# 11. State Ownership

| Concern                              | Owner                                  |
| ------------------------------------ | -------------------------------------- |
| Membership / authorization           | Server (`FamilyMembership`)            |
| Session authenticity                 | Better Auth server + mobile auth shell |
| Timeline list/detail/create UI state | Mobile process memory only             |
| Family / Pregnancy / Child UI state  | Existing process-memory providers      |
| Disclosure continuation              | Existing in-memory shell flag          |

Rules:

- Server remains authoritative
- Timeline state scoped by `familyId` + subject type + subject ID
- Pregnancy Timeline memory and Child Timeline memory must not collide
- No offline-first, background sync, or domain SecureStore/AsyncStorage
- Clear all Timeline memory on sign-out and principal change
- Isolate or clear when Family or subject route context changes
- Cancel in-flight Timeline requests on route exit / sign-out / principal /
  Family / subject change
- Stale responses must not populate another user, Family, or subject
- Refresh list after successful create
- No optimistic create
- Error state must be resettable
- Avoid a global state framework unless already approved and required

---

# 12. Navigation and Guards

- Timeline routes live only under `(app)` and under the subject-specific trees
  in §5
- `(app)` requires `authenticated` (disclosure continued)
- Unauthenticated → sign-in; `authenticated-entry` → `/disclosure`
- Invalid/inaccessible Family/subject/event routes fail safely after the
  auth/disclosure gate with generic `TIMELINE_NOT_FOUND` presentation
- Direct/deep-link access does not bypass privacy checks
- Sign-out / principal change clears Timeline state and protected navigation
- No redirect loops among Home, Families, Pregnancies, Children, Timeline,
  disclosure, and auth
- No route ambiguity between Pregnancy and Child Timeline trees
- Home, Families, Pregnancies, Children, Safety & Limitations, and sign-out
  remain reachable through established navigation

---

# 13. Privacy and Medical Safety

Rules:

- Timeline titles are sensitive user-authored Family data
- events are unverified historical statements, not medical records or verified
  milestones
- `occurredAt` is a user-selected instant, not a medically inferred date
- no diagnosis, risk score, developmental inference, treatment, gestational
  calculation, age calculation, or emergency monitoring
- no Child legal/identity inference from Timeline content
- no Timeline data enters authentication sessions or durable principal state
- no Timeline data in analytics, routine logs, crash payloads, notification
  previews, or URL query strings
- no local domain-data persistence
- FamilyMembership remains the server authorization source
- both OWNER and MEMBER use only the approved create/list/get operations
- Safety & Limitations remains available through the existing shell route
- ADR-019 disclosure does not authorize future Health or AI Timeline behavior

---

# 14. Accessibility and Presentation Minimums

- Readable text scaling
- Screen-reader headings and labels
- Chronological-list semantics
- Readable date/time text and screen-reader-friendly `occurredAt`
- Accessible native date/time controls and confirmation of selected value
- Logical focus order on create forms
- Sufficient contrast
- Minimum ~48 dp touch targets
- Loading and error announcements
- Keyboard-safe title form
- Error association with title / occurredAt controls
- Non-color-only errors
- Long Unicode title wrapping/truncation without losing accessible full value
- Safe Area handling
- Accessible refresh / retry / create / back actions

Do not create a complete visual/branding system in the implementation sprint.

---

# 15. Testing Strategy (for the implementation sprint)

## 15.1 Timeline API client

- Pregnancy list/create/get success
- Child list/create/get success
- exact DTO mapping and exactly-one-subject validation
- Family/subject consistency
- ordering preservation (no client re-sort into a different order)
- `TIMELINE_NOT_FOUND`
- unauthorized / session expiry
- malformed / network / server / timeout / cancellation
- safe path encoding
- no JWT/bearer
- no sensitive logging

## 15.2 Validation / input

- title missing/invalid/whitespace-only
- trimming
- 1 and 80 Unicode code points accepted; 81 rejected
- emoji/surrogate correctness
- duplicate titles allowed
- occurredAt required
- RFC 3339 with milliseconds and explicit offset / `Z`
- invalid calendar values rejected
- timezone/DST serialization behavior for confirmed local selection
- no `createdAt` substitution
- unknown fields rejected

## 15.3 State

- Family / subject / type isolation
- Pregnancy and Child separation
- refresh after create
- stale-response prevention
- clearing / cancellation
- process-memory only
- no Timeline persistence

## 15.4 Navigation / screens

- Pregnancy detail → Pregnancy Timeline
- Child detail → Child Timeline
- list/create/detail flows for both subjects
- create success → created event detail
- generic unavailable states
- auth / disclosure guards
- correct back behavior
- no combined feed
- no redirect loops

## 15.5 Safety / architecture

- no medical inference
- no unapproved fields
- no update/delete UI
- no Media / Health / AI
- no local persistence / analytics
- no backend framework imports
- no API/schema/migration change beyond the approved datetimepicker dependency
- Safety & Limitations remains accessible

## 15.6 Regression

- authentication / session / disclosure
- Family mobile flow
- Pregnancy mobile flow
- Child mobile flow
- backend Timeline authorization and PostgreSQL suites

---

# 16. Device / Emulator Smoke (implementation sprint)

When a device or emulator is available, verify:

1. Sign in
2. Complete disclosure
3. Pregnancy detail → Timeline
4. Create and view a Pregnancy event with date/time selection
5. Child detail → Timeline
6. Create and view a Child event
7. Chronological order preserved
8. Pull-to-refresh
9. Unavailable route shows generic not-found UI
10. Cold restart / session restoration still requires disclosure
11. Sign out

This documentation sprint does not claim device verification.

---

# 17. Implementation Slicing

## 17.1 Exact next implementation sprint

**Sprint 2.13B — Minimum Mobile Timeline List, Create, and Detail**

In scope:

- install Expo-compatible `@react-native-community/datetimepicker`
- mobile Timeline API client (cookie transport, timeout, abort, DTO mapping,
  exactly-one-subject validation)
- optional tiny shared authenticated HTTP helper under the §9.4 boundary
- subject-scoped Timeline process-memory state
- Pregnancy and Child Timeline list/create/detail screens
- Pregnancy detail and Child detail Timeline entry points
- navigation/guards within existing authenticated + disclosure shell
- focused client/navigation/state/privacy/accessibility/input tests
- Android/iOS interactive smoke when available

Out of scope for 2.13B:

- Timeline update / delete / reassignment
- combined Family or Pregnancy+Child feed
- note / category / location
- Media / Health / AI
- reminders / notifications
- Pregnancy-to-Child linkage
- invitation / member / role UI
- offline sync / local domain persistence
- API/schema/migration changes

Sprint 2.13B is architecturally unblocked by this decision, provided the
datetimepicker Expo install remains compatible with the repository’s
verification policy.

---

# 18. Explicit Exclusions and Deferred Decisions

This decision does not implement or approve:

- Timeline UI code in Sprint 2.13A
- combined Family / Pregnancy / Child feed
- Family as Timeline subject
- event update / delete / reassignment
- note / description / category / location
- Media / Health / medical classification / inference
- AI
- reminders / notifications
- Pregnancy-to-Child linkage
- system-generated milestones
- invitation / member / role UI
- analytics / crash-reporting SDK
- local domain-data persistence or offline sync
- push / background refresh
- pagination or search/filter
- localization architecture
- admin/web Timeline UI
- API/schema/migration changes
- generalized design system
- pilot/Beta planning
- installing datetimepicker in this documentation sprint

Deferred:

- Timeline update/delete UX after a dedicated mutation ADR
- any additional Timeline fields only through ADR-016 review triggers
- Media/Health/AI Timeline experiences
- combined feeds of any kind

---

# 19. Sprint 2.13A Completion Record

Sprint 2.13A documents:

- verified Timeline stored fields and exactly-one-subject behavior
- verified six subject-specific create/list/direct-get contracts
- verified title and occurredAt validation, UTC serialization, ordering, and
  identical `TIMELINE_NOT_FOUND` behavior
- OWNER/MEMBER authorization behavior for Timeline operations
- approved separate Pregnancy and Child mobile Timeline route trees
- list/create/detail presentation rules without inventing fields
- occurredAt native date/time capture, serialization, timezone, and display
  decision
- required Expo-compatible datetimepicker dependency for Sprint 2.13B
- cookie-based Timeline API client boundary and optional HTTP helper refactor
  boundary
- subject-scoped process-memory state ownership
- navigation/guard requirements behind disclosure
- privacy, medical-safety, and accessibility minimums
- testing and device-smoke expectations
- exact follow-on implementation sprint 2.13B

No application code, dependencies, lockfiles, schema, migrations, or tests are
changed by this sprint.
