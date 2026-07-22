# Minimum Mobile Pregnancy Experience Architecture Decision

Version: 1.0

Status: Approved — Implemented (Sprint 2.11B)

Phase: MVP Client Pregnancy Foundation

Decision date: 2026-07-23

---

# 1. Purpose

Sprint 2.10B completed the minimum mobile Family list, create, and detail
experience in `apps/mobile`. The next product gap is Family-scoped Pregnancy UI.

This decision defines the smallest truthful mobile Pregnancy experience that:

- uses only currently implemented Pregnancy API behavior,
- preserves Family as the privacy boundary,
- allows an authenticated Family member to list, create, and open Pregnancies
  for one accessible Family,
- navigates safely back to the owning Family,
- preserves medical-safety and non-enumeration requirements,
- and reserves a future navigation boundary for Pregnancy Timeline UI without
  implementing Timeline, Child, Health, Media, or AI surfaces.

Sprint 2.11A is documentation-only. It does not implement Pregnancy UI, change
application code, dependencies, API routes, packages, Prisma schema,
migrations, or tests.

---

# 2. Verified Backend and Mobile State

## 2.1 Stored Pregnancy fields (implemented)

Prisma model `Pregnancy` / domain type `Pregnancy` contain exactly:

| Field         | Kind                        | User-visible meaning                                     |
| ------------- | --------------------------- | -------------------------------------------------------- |
| `id`          | system opaque identifier    | routing / identity only; not a product label             |
| `familyId`    | immutable Family ownership  | scope / owning Family context                            |
| `displayName` | user-authored product field | **only meaningful user-visible Pregnancy product field** |
| `createdAt`   | system timestamp            | optional secondary metadata                              |
| `updatedAt`   | system timestamp            | optional secondary metadata                              |

No other Pregnancy product field exists. In particular, the domain does **not**
store due date, conception date, trimester, status, fetus count, gender,
doctor, clinic, symptoms, diagnosis, health values, medical notes, or Child
linkage.

`displayName` is a presentation label only (ADR-014). It is not a legal name,
medical fact, lifecycle statement, Child identity, or Pregnancy-to-Child link.

Because `displayName` exists as an approved meaningful user-visible field, this
mobile architecture is unblocked. UI must not be designed around bare IDs alone.

## 2.2 Pregnancy API contracts (implemented)

Controller: `PregnancyController` at `families/:familyId/pregnancies`, guarded
by `AuthGuard`.

Authorization (verified repository + ADR-017):

- every operation requires authentication and a persisted `FamilyMembership`
  for the path `familyId` and the authenticated principal,
- both `OWNER` and `MEMBER` may create, list, and direct-get Pregnancies,
- the mobile client never decides authorization or role,
- roles must not enter Better Auth sessions or durable Pregnancy UI state.

### Create

- **Method / path:** `POST /families/:familyId/pregnancies`
- **Body (only):** `{ "displayName": string }`
- **Validation (server authoritative; `@lumora/pregnancy`):**
  - `displayName` required
  - must be a string (`DISPLAY_NAME_INVALID` if not)
  - trimmed; empty/whitespace rejected (`DISPLAY_NAME_REQUIRED`)
  - max length 100 Unicode code points after trim (`DISPLAY_NAME_TOO_LONG`)
  - unknown fields rejected (`UNKNOWN_FIELD`)
  - duplicate `displayName` values within one Family are allowed
  - no additional normalization beyond trim
- **Success:** Nest default POST success (HTTP 201) with one Pregnancy DTO:
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
- **Behavior:** create checks membership then writes Pregnancy in one
  serializable transaction. Path `familyId` is authoritative; the body must not
  carry ownership claims.

### List

- **Method / path:** `GET /families/:familyId/pregnancies`
- **Success body:**
  ```json
  {
    "pregnancies": [
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
- **Scope:** only Pregnancies in the path Family, and only when the caller has
  membership in that Family.
- **Ordering (verified repository contract):**
  `createdAt` ascending, then `id` ascending.
- **Pagination:** none. The API returns the full Family-scoped set.
- **Unavailable Family:** identical `FAMILY_NOT_FOUND` HTTP 404 as create.
- **Role / medical fields:** not included.

### Direct get

- **Method / path:** `GET /families/:familyId/pregnancies/:pregnancyId`
- **Success body:** the same minimum Pregnancy representation as list items.
- **Unavailable:** HTTP 404 with
  `{ "statusCode": 404, "code": "PREGNANCY_NOT_FOUND", "message": "Pregnancy not found." }`
  for missing, inaccessible, cross-Family, and path-mismatched Pregnancy
  (non-enumeration). Identical response shape in all those cases.
- **Role / medical fields:** not included.

### Explicitly out of this mobile sprint’s API surface

No Pregnancy update, rename, delete, lifecycle, status, date, Child-link, or
Timeline endpoints are part of this experience. Existing Child and Timeline APIs
remain implemented on the backend and are **not** approved for mobile UI here.

## 2.3 Mobile shell and Family UI (implemented)

Verified through Sprint 2.10B:

- registration, sign-in, session restore, sign-out
- ADR-019 disclosure gate (`authenticated-entry` → `/disclosure`)
- authenticated Home, Safety & Limitations, Families list/create/detail
- Expo Router `(app)` group requires completed in-memory disclosure continuation
- Better Auth Expo SecureStore cookie transport + `GET /auth/me`
- validated `EXPO_PUBLIC_LUMORA_API_BASE_URL`
- Family process-memory state cleared on sign-out / principal change

Pregnancy routes can therefore be nested under an existing Family route inside
`(app)` and inherit authentication and disclosure guards without redesigning
those flows.

---

# 3. Decision Summary

`apps/mobile` gains a minimum authenticated, Family-scoped Pregnancy experience
after disclosure continuation:

1. Family detail links to that Family’s Pregnancy list.
2. Pregnancy list loads via `GET /families/:familyId/pregnancies`.
3. Empty list offers create.
4. Create uses `POST /families/:familyId/pregnancies` with `{ displayName }` only.
5. Successful creation refreshes the Family-scoped list and opens the created
   Pregnancy detail.
6. Selecting a list item opens
   `GET /families/:familyId/pregnancies/:pregnancyId` detail.
7. Unavailable Family or Pregnancy routes show generic privacy-safe states.
8. Back navigation returns to the owning Family Pregnancy list or Family detail.
9. Home, Families, Safety & Limitations, and sign-out remain available through
   established shell navigation.
10. No Child, Timeline, Health, Media, AI, invitation, member, or medical
    inference UI is approved in this decision.

Server remains the authorization authority. The mobile client never decides
membership or roles.

---

# 4. Approved Product Flow

After disclosure continuation (`status === "authenticated"`):

```text
Home
  → Families list
      → Family detail
          → Pregnancy list (for that Family)
              → Create Pregnancy → (success) Pregnancy detail
              → Pregnancy detail
  → Safety & Limitations (existing)
  → Sign out (existing)
```

Rules:

- Disclosure continues to precede all Pregnancy routes via the `(app)` guard.
- Authentication continues to precede disclosure and Pregnancy routes.
- Pregnancy navigation remains nested under one Family; no cross-Family list or
  global Pregnancy feed is approved.
- Back navigation from Pregnancy detail returns to that Family’s Pregnancy list;
  from Pregnancy list to Family detail; established Family back behavior is
  preserved.
- Back navigation must not bypass disclosure for the current process lifetime.
- Pregnancy UI does not replace Home or Families.

---

# 5. Mobile Routes

All routes are Expo Router file routes inside the authenticated `(app)` group and
nested under the existing Family detail path segment.

| Surface          | Route                                                  | Purpose                      |
| ---------------- | ------------------------------------------------------ | ---------------------------- |
| Pregnancy list   | `/(app)/families/[familyId]/pregnancies`               | Family-scoped Pregnancy list |
| Create Pregnancy | `/(app)/families/[familyId]/pregnancies/create`        | Dedicated create screen      |
| Pregnancy detail | `/(app)/families/[familyId]/pregnancies/[pregnancyId]` | Minimum Pregnancy detail     |

Family detail (`/(app)/families/[familyId]`) gains one clear accessible entry to
the Pregnancy list for that Family in the implementation sprint. That entry is
the only approved Family-detail expansion for this architecture.

Rationale for a dedicated create screen (not a modal): clearer focus order,
keyboard-safe form behavior, and a simpler guard/test surface — matching the
approved Family create pattern.

Deep links / typed navigation into Pregnancy routes must still pass
authentication and disclosure guards. Identifiers appear only as path segments,
never as query strings carrying secrets or personal data. Both `familyId` and
`pregnancyId` must be path-encoded safely by the client.

---

# 6. Pregnancy List Behavior

## 6.1 Request

- `GET {API_BASE}/families/{familyId}/pregnancies`
- Cookie session via Better Auth Expo `getCookie()` (same pattern as Family /
  `GET /auth/me`)
- `credentials: "omit"`
- No bearer/JWT
- `familyId` path-encoded

## 6.2 Presentation fields

For each Pregnancy, show:

- `displayName` (primary)
- optional secondary `createdAt` (ISO parsed for conservative local-friendly
  display, same conservative approach as Family UI)

Do **not** show role, medical status, trimester, due date, Child linkage, or
Timeline preview. List responses do not include those fields, and the client
must not invent them.

Owning Family context may be shown using already-loaded Family `displayName` /
route context when available, without implying clinical ownership language.

## 6.3 Ordering

Preserve server order: `createdAt` ascending, then `id` ascending.
Do not re-sort client-side into a different product order.

## 6.4 States

- **Loading:** initial fetch in progress; announce loading.
- **Empty:** `pregnancies: []` for an accessible Family with no Pregnancies.
  Primary action: Create Pregnancy.
- **Populated:** list items navigate to detail for the same `familyId`.
- **Unavailable Family:** HTTP 404 `FAMILY_NOT_FOUND` — generic Family
  unavailable presentation; safe return to Families; do not reveal whether the
  Family exists for others.
- **Retryable network/timeout error:** generic retry; do not claim Pregnancies
  exist or do not exist.
- **Unauthorized (401):** clear local auth/session through the central auth
  boundary and return to sign-in; clear Pregnancy in-memory state.

## 6.5 Refresh and pagination

- **Pull-to-refresh:** approved for the Family-scoped Pregnancy list.
- **Pagination / infinite scroll:** not approved; API has no pagination.
- **In-memory cache:** list results may be held in process memory for the
  current authenticated principal and current `familyId` only.
- **No AsyncStorage / SecureStore** for Pregnancy domain data.

## 6.6 Privacy

- Do not log Pregnancy ids, names, Family ids, or response bodies in routine
  logs.
- Do not reveal Pregnancy existence outside the caller’s membership scope.
- Empty vs error must not become an enumeration channel.

---

# 7. Pregnancy Creation Behavior

## 7.1 Route and request

- Screen: `/(app)/families/[familyId]/pregnancies/create`
- `POST {API_BASE}/families/{familyId}/pregnancies`
- Body: `{ "displayName": string }` only

## 7.2 Client validation (fail-fast, server authoritative)

Mirror server rules before submit:

- required string
- trim leading and trailing whitespace for submission
- non-empty after trim
- maximum 100 Unicode code points (count code points, not UTF-16 code units)
- no additional normalization
- no unknown fields

Server validation remains authoritative. Map HTTP 400 codes
(`DISPLAY_NAME_REQUIRED`, `DISPLAY_NAME_INVALID`, `DISPLAY_NAME_TOO_LONG`,
`UNKNOWN_FIELD`) to generic, field-safe user messages without echoing raw
payloads.

## 7.3 Submission UX

- Disable submit while in flight (duplicate-submit prevention).
- Show visible progress on the primary action.
- Keyboard-safe form; accessible label and error association.
- **No optimistic creation:** wait for successful response before navigating or
  inserting into durable list state.
- On success:
  1. refresh or update the in-memory Pregnancy list for that `familyId` from
     server authority (refresh preferred; upsert of the returned DTO may follow
     a successful refresh, matching Family create discipline),
  2. navigate to
     `/(app)/families/{familyId}/pregnancies/{createdPregnancyId}`.
- On `FAMILY_NOT_FOUND`: generic Family unavailable; do not create locally.
- On retryable network failure: stay on create screen with generic retryable
  error.
- Prevent stale success navigation after sign-out, principal change, or Family
  context change.
- Back/cancel returns safely to the Pregnancy list for the same Family.

## 7.4 Explicit non-goals for creation

Do not add due date, conception date, trimester, status, fetus/baby count,
gender, doctor, clinic, symptoms, diagnosis, health values, medical notes,
Child creation, Timeline event creation, Media, AI, avatar/image, or onboarding
wizard.

---

# 8. Pregnancy Detail Behavior

## 8.1 Route and request

- Screen: `/(app)/families/[familyId]/pregnancies/[pregnancyId]`
- `GET {API_BASE}/families/{familyId}/pregnancies/{pregnancyId}`
- Same cookie transport as list/create
- Both identifiers path-encoded

## 8.2 Presentation fields

Show:

- `displayName` (title)
- optional `createdAt` / `updatedAt` as secondary metadata
- owning Family context via route/Family memory when available (Family
  `displayName` already loaded is preferred over inventing new copy)

Do not show role, membership data, medical interpretation, Child linkage, or
Timeline content.

If timestamps are shown, format them conservatively and do not infer
locale-sensitive medical meaning beyond display.

## 8.3 States

- **Loading**
- **Available:** show minimum approved fields
- **Unavailable:** identical generic “Pregnancy not found” presentation for
  HTTP 404 `PREGNANCY_NOT_FOUND` whether missing, inaccessible, cross-Family,
  or path-mismatched
- **Retryable network error**
- **Unauthorized:** central auth sign-out path

## 8.4 Mutations and future Timeline boundary

- No edit/rename/delete controls.
- No lifecycle/status controls.
- No medical badges, risk colors, warning scores, or health interpretations.
- A future Pregnancy Timeline entry point may be reserved **in architecture
  only** as the next Family→Pregnancy→Timeline navigation boundary after a
  separate Timeline mobile ADR.
- The first Pregnancy UI implementation **must not** show a non-functional
  Timeline control, placeholder, or disabled feature card.

## 8.5 Back navigation

Safe back navigation returns to
`/(app)/families/[familyId]/pregnancies` for the same Family. If that list is
unavailable, fall back to Family detail / Families without bypassing auth or
disclosure.

---

# 9. Mobile Pregnancy API Client Architecture

Implement the smallest client inside `apps/mobile` (for example
`src/pregnancy/`), not a new generalized domain SDK package.

## 9.1 Transport

- Reuse Better Auth Expo cookie transport (`getCookie()`)
- Reuse validated API base URL helper
- Nested Family/Pregnancy paths exactly as implemented
- Path-safe `encodeURIComponent` for `familyId` and `pregnancyId`
- No custom JWT / bearer tokens
- No Prisma / Nest / backend framework types in the mobile client
- Map JSON to local DTOs matching the Pregnancy response shape exactly
- Reject malformed response shapes safely

## 9.2 Reliability

- Bounded request timeout (implementation default: 15 seconds, same bound as
  Family client unless a later shared helper owns one constant)
- `AbortController` cancellation on route exit, sign-out, principal change, and
  Family context change
- Ignore stale responses that complete after a newer request for the same
  Family-scoped surface (request generation / sequence token)
- Distinguish:
  - `unauthorized` (401) → central session boundary; clear Pregnancy memory
  - `family_not_found` (404 `FAMILY_NOT_FOUND`) → generic Family unavailable
  - `pregnancy_not_found` (404 `PREGNANCY_NOT_FOUND`) → generic Pregnancy
    unavailable
  - `validation` (400 with known codes) → safe field errors on create
  - `network` / timeout / abort → retryable error
  - generic server / malformed → safe generic failure
- No infinite retry

## 9.3 Logging

- No cookies, tokens, emails, Pregnancy payloads, Family payloads, or raw
  response bodies in routine logs
- No sensitive debug UI

## 9.4 Permitted Family-client refactor boundary (implementation sprint)

A **small** refactor of the existing Family mobile client is permitted only if
it extracts shared authenticated HTTP mechanics (cookie header composition,
`credentials: "omit"`, timeout + abort wiring, unauthorized mapping helpers)
into a tiny mobile-owned utility used by Family and Pregnancy clients.

Strict boundary:

- must not create a generalized cross-domain SDK
- must not import NestJS, Prisma, or backend packages
- must not merge Family and Pregnancy DTOs/state into one domain store
- must not change Family API contracts or user-visible Family behavior
- must keep Family and Pregnancy result-kind mapping explicit at each client
  boundary

If extraction would expand scope or risk regressions, duplicate the smallest
HTTP pattern instead.

---

# 10. State Ownership

| Concern                               | Owner                                  |
| ------------------------------------- | -------------------------------------- |
| Membership / authorization            | Server (`FamilyMembership`)            |
| Session authenticity                  | Better Auth server + mobile auth shell |
| Pregnancy list/detail/create UI state | Mobile process memory only             |
| Family UI state                       | Existing Family process memory         |
| Disclosure continuation               | Existing in-memory shell flag          |

Rules:

- Server remains authoritative.
- Pregnancy state is scoped by `familyId` (and detail by `pregnancyId`).
- No offline-first, background sync, or domain-data SecureStore/AsyncStorage.
- Clear all Pregnancy in-memory state on sign-out and principal change.
- Clear or fully isolate Pregnancy state when Family context changes so one
  Family’s Pregnancies cannot populate another Family’s UI.
- Cancel in-flight Pregnancy requests on route exit, sign-out, principal
  change, or relevant Family change.
- Stale responses must not repopulate cleared state or another Family’s state.
- Refresh list after successful create; no optimistic record.
- Error state must be resettable (retry / new fetch / leaving screen).
- Isolate state between users.
- Avoid a global state framework unless already approved and required.

---

# 11. Navigation and Guards

- Pregnancy routes live only under `(app)` and under
  `families/[familyId]/pregnancies…`.
- `(app)` already requires `authenticated` (disclosure continued).
- Unauthenticated users redirect to sign-in.
- `authenticated-entry` users redirect to `/disclosure` and cannot open
  Pregnancy routes.
- Invalid or inaccessible Family/Pregnancy routes fail safely after the
  auth/disclosure gate (generic unavailable UI).
- Direct/deep-link access does not bypass privacy checks; the server remains
  authoritative for membership scope.
- Sign-out / principal change clears Pregnancy state and protected navigation.
- No redirect loops among Home, Families, Family detail, Pregnancy surfaces,
  disclosure, and auth.
- Home, Families, Safety & Limitations, and sign-out remain reachable through
  established shell navigation.

---

# 12. Medical Safety

Pregnancy records in Lumora are **user-entered organizational records** within a
Family. They are **not** clinical pregnancy records and displayed values are
**not** medically verified.

The UI must not:

- diagnose,
- calculate gestational age,
- infer trimester,
- estimate due date,
- score risk,
- recommend treatment,
- or provide emergency guidance.

Additional rules:

- no medical badges, risk colors, warning scores, or health interpretations
- no user-entered field may be relabeled with stronger medical meaning
  (`displayName` remains a presentation label only)
- Safety & Limitations remains available through the existing shell route
- the general ADR-019 disclaimer does not authorize future Health or AI behavior
- creating or viewing a Pregnancy must not be presented as clinical onboarding

---

# 13. Privacy and Security

- FamilyMembership remains the server authorization source.
- Both OWNER and MEMBER retain existing approved Pregnancy operations.
- Mobile client never decides authorization.
- Missing / inaccessible / cross-Family / path-mismatched Pregnancy behavior
  remains non-enumerating (`PREGNANCY_NOT_FOUND`).
- Missing / inaccessible Family behavior for list/create remains non-enumerating
  (`FAMILY_NOT_FOUND`).
- No Pregnancy data in analytics, routine logs, crash payloads, notification
  previews, or URL query strings.
- No local domain-data persistence.
- No role in session/principal or durable Pregnancy UI state.
- No production mock Pregnancy data.
- No screenshot-protection claim.
- State cannot leak across users or Families.
- This experience must not weaken ADR-019 disclosure, verified-email, Family,
  or invitation security semantics.

---

# 14. Accessibility and Presentation Minimums

- Readable text scaling
- Screen-reader headings and labels
- List semantics for Pregnancy list
- Logical focus order on create form
- Sufficient contrast
- Minimum ~48 dp touch targets
- Loading and error announcements
- Keyboard-safe create form
- Error text associated with the `displayName` input
- Non-color-only errors
- Accessible refresh / retry / create / back actions
- Long Unicode `displayName` wrapping/truncation without losing accessible full
  value
- Safe Area handling
- Empty-state and unavailable-state actions must be accessible

Do not create a complete visual/branding system in the implementation sprint.

---

# 15. Testing Strategy (for the implementation sprint)

## 15.1 Pregnancy API client

- list success / empty list
- create success
- direct-get success
- exact DTO mapping
- malformed response
- validation error mapping
- `FAMILY_NOT_FOUND` mapping
- `PREGNANCY_NOT_FOUND` mapping
- unauthorized / session expiry
- retryable network failure
- timeout / cancellation
- encoded Family/Pregnancy ids
- no bearer/JWT
- no sensitive logging

## 15.2 State

- family-scoped state
- refresh after create
- no optimistic create
- sign-out / principal-change clearing
- Family-context isolation
- stale-response prevention
- process-memory only
- no domain storage (AsyncStorage/SecureStore)

## 15.3 Navigation / screens

- Family detail → Pregnancy list
- empty / list → create
- create success → created Pregnancy detail
- list → detail
- unavailable Family
- missing / inaccessible / cross-Family Pregnancy
- auth / disclosure guards
- correct back navigation
- no redirect loops
- sign-out prevents stale route/state

## 15.4 Medical safety / privacy / architecture

- no medical inference or unapproved medical fields
- no Child linkage UI
- no Timeline / Health / AI controls
- Safety & Limitations remains accessible
- no Family role in principal/session
- no backend framework imports in mobile Pregnancy client
- no API/schema change

## 15.5 Regression

- mobile authentication / session restore / sign-out
- disclosure gate
- Family list / create / detail
- Better Auth Expo transport
- backend OWNER/MEMBER Pregnancy access
- existing Child / Timeline / invitation PostgreSQL suites

---

# 16. Device / Emulator Smoke (implementation sprint)

When a device or emulator is available, verify:

1. Sign in
2. Complete disclosure
3. Select or create a Family
4. Open Pregnancy list from Family detail
5. Empty or populated list behavior
6. Create Pregnancy
7. Open created Pregnancy detail
8. Pull-to-refresh list
9. Unavailable Family / Pregnancy route shows generic not-found UI
10. Sign out
11. Cold restart / session restoration still requires disclosure before
    Pregnancy routes

This documentation sprint does not claim device verification.

---

# 17. Implementation Slicing

## 17.1 Exact next implementation sprint

**Sprint 2.11B — Minimum Mobile Pregnancy List, Create, and Detail**

In scope:

- mobile Pregnancy API client (cookie transport, timeout, abort, DTO mapping)
- optional tiny shared authenticated HTTP helper extracted from Family client
  under the §9.4 boundary
- Family-scoped Pregnancy process-memory state
- Pregnancy list (`/(app)/families/[familyId]/pregnancies`)
- Pregnancy create (`/(app)/families/[familyId]/pregnancies/create`)
- Pregnancy detail (`/(app)/families/[familyId]/pregnancies/[pregnancyId]`)
- Family detail entry to Pregnancies
- navigation/guards within existing authenticated + disclosure shell
- focused client/navigation/state/accessibility/medical-safety tests
- Android/iOS interactive smoke when available

Out of scope for 2.11B:

- Child UI
- Timeline UI (including non-functional Timeline controls)
- Pregnancy update/delete/lifecycle/status
- due-date / gestational-age / trimester inference
- medical scoring or advice
- invitation / member / role UI
- Media / Health / AI
- offline sync / local domain persistence
- API/schema/migration changes

Sprint 2.11B is architecturally unblocked by this decision.

---

# 18. Explicit Exclusions and Deferred Decisions

This decision does not implement or approve:

- Pregnancy UI code in Sprint 2.11A
- Pregnancy rename/edit/delete
- due-date calculation or storage
- gestational-age calculation
- trimester inference
- medical scoring, diagnosis, treatment, or emergency guidance
- doctor/clinic workflows
- symptoms/diagnoses/treatment fields
- Child linkage or Pregnancy-to-Child transition
- Child UI
- Timeline UI or Timeline placeholders
- Media / Health / AI
- notifications / reminders
- invitation / member / role UI
- analytics / crash-reporting SDK
- local domain-data persistence or offline sync
- push / background refresh
- pagination or search/filter (API does not provide them)
- localization architecture
- admin/web Pregnancy UI
- API/schema/migration changes
- generalized design system
- pilot/Beta planning

Deferred:

- Pregnancy Timeline mobile entry after a dedicated Timeline mobile ADR
- Pregnancy `displayName` update/rename UX (no update endpoint today)
- any future medical or date fields only through ADR-014 review triggers
- Child UI after ADR-023 / Sprint 2.12B
  (`docs/23-minimum-mobile-child-experience-architecture-decision.md`)

---

# 19. Sprint 2.11A Completion Record

Sprint 2.11A documents:

- verified Pregnancy stored fields and the meaningful `displayName` field
- verified nested create/list/direct-get contracts, ordering, and not-found codes
- OWNER/MEMBER authorization behavior for Pregnancy operations
- approved Family-nested mobile routes and product flow
- list/create/detail presentation rules without inventing fields
- cookie-based Pregnancy API client boundary and optional Family HTTP helper
  refactor boundary
- Family-scoped process-memory state ownership
- navigation/guard requirements behind disclosure
- medical-safety, privacy, and accessibility minimums
- testing and device-smoke expectations
- exact follow-on implementation sprint 2.11B

No application code, dependencies, lockfiles, schema, migrations, or tests are
changed by this sprint.

---

# 20. Sprint 2.11B Completion Record

Sprint 2.11B implements the minimum Family-scoped Pregnancy experience in
`apps/mobile` against existing Pregnancy API contracts only.

## 20.1 Routes and Family detail entry

- `/(app)/families/[familyId]/pregnancies` — Family-scoped list, pull-to-refresh,
  empty state, create entry
- `/(app)/families/[familyId]/pregnancies/create` — `displayName` only, Unicode
  code-point validation mirroring the server
- `/(app)/families/[familyId]/pregnancies/[pregnancyId]` — direct-get detail;
  generic unavailable UI for `PREGNANCY_NOT_FOUND`
- Family detail provides an accessible Pregnancies entry
- Routes remain inside `(app)` and inherit authentication + disclosure guards

## 20.2 Pregnancy API client behavior

- Cookie session via Better Auth Expo `getCookie()` + validated API base URL
- Nested Family/Pregnancy paths; path-encoded identifiers
- Exact DTO mapping with response `familyId` consistency checks
- `AbortController` + 15s bounded timeout
- Distinguishes unauthorized, `FAMILY_NOT_FOUND`, `PREGNANCY_NOT_FOUND`,
  validation, network, server, malformed, and aborted results
- Unauthorized clears Pregnancy process-memory state and uses the central
  session sign-out boundary
- No sensitive logging; no Family/Pregnancy HTTP helper SDK extraction was
  required

## 20.3 Process-memory Family-scoped state

- Server remains authoritative; no AsyncStorage/SecureStore Pregnancy persistence
- State scoped by `familyId`; cleared on sign-out, principal change, and Family
  context change
- Stale in-flight responses ignored; create refreshes list without optimistic
  insert

## 20.4 Medical-safety presentation

- Organizational record copy only; `displayName` remains a presentation label
- No gestational age, trimester, due date, risk, diagnosis, Child, or Timeline
  controls

## 20.5 Verification performed

- Mobile lint, type-check, tests, Expo shell verification, and workspace
  verification suite for this sprint
- Android/iOS static `expo export` validation where applicable
- Prisma schema/migrations and backend Pregnancy API contracts unchanged

## 20.6 Device / emulator smoke

No safe existing Android emulator, iOS simulator, or connected device was
available for interactive smoke in this environment. Interactive smoke is
therefore not claimed. Static Android/iOS bundle validation remains the
truthful substitute.

## 20.7 Next truthful UI checkpoint

Minimum Child mobile list/create/detail architecture (documentation-first),
only after ADR-aligned Pregnancy UI is complete — do not begin that sprint here.
