# Minimum Mobile Family Experience Architecture Decision

Version: 1.0

Status: Approved — Implemented (Sprint 2.10B)

Phase: MVP Client Family Foundation

Decision date: 2026-07-22

---

# 1. Purpose

Sprint 2.9B completed the authenticated Expo shell and ADR-019 disclosure
presentation in `apps/mobile`. The next product gap is Family UI.

This decision defines the smallest truthful mobile Family experience that:

- uses only currently implemented Family API behavior,
- preserves Family as the privacy boundary,
- allows an authenticated user to list, create, and open accessible Families,
- keeps Home, Safety & Limitations, and sign-out available,
- and provides the navigation foundation for later Pregnancy and Child UI
  without designing those surfaces here.

Sprint 2.10A is documentation-only. It does not implement Family UI, change
application code, dependencies, API routes, packages, Prisma schema,
migrations, or tests.

---

# 2. Verified Backend and Mobile Shell State

## 2.1 Family API contracts (implemented)

Controller: `FamilyController` at `/families`, guarded by `AuthGuard`.

### Create

- **Method / path:** `POST /families`
- **Body (only):** `{ "displayName": string }`
- **Validation (server authoritative):**
  - `displayName` required
  - trimmed; empty/whitespace rejected
  - max length 100 Unicode code points after trim
  - unknown fields rejected (`UNKNOWN_FIELD`)
- **Success:** HTTP 201-equivalent Nest success with
  ```json
  {
    "family": {
      "id": "...",
      "displayName": "...",
      "createdAt": "<ISO-8601>",
      "updatedAt": "<ISO-8601>"
    },
    "membership": {
      "id": "...",
      "familyId": "...",
      "userId": "...",
      "role": "OWNER",
      "createdAt": "<ISO-8601>",
      "updatedAt": "<ISO-8601>"
    }
  }
  ```
- **Behavior:** creates Family and caller `OWNER` membership atomically.
  Any authenticated principal may create a Family, including a user who is
  already a `MEMBER` of another Family; they become `OWNER` of the new Family.

### List

- **Method / path:** `GET /families`
- **Success body:**
  ```json
  {
    "families": [
      {
        "id": "...",
        "displayName": "...",
        "createdAt": "<ISO-8601>",
        "updatedAt": "<ISO-8601>"
      }
    ]
  }
  ```
- **Scope:** only Families for which the caller has a `FamilyMembership`.
- **Ordering (verified repository contract):**
  `createdAt` ascending, then `id` ascending.
- **Pagination:** none. The API returns the full accessible set.
- **Role:** not included in list items.

### Direct get

- **Method / path:** `GET /families/:familyId`
- **Success body:** the same minimum Family representation as list items
  (`id`, `displayName`, `createdAt`, `updatedAt`).
- **Unavailable:** HTTP 404 with
  `{ "statusCode": 404, "code": "FAMILY_NOT_FOUND", "message": "Family not found." }`
  for both missing and inaccessible Families (non-enumeration).
- **Role:** not included.

### Explicitly out of this mobile sprint’s API surface

Existing invitation routes (`POST /families/:familyId/invitations`,
`POST /family-invitations/accept`) remain implemented on the API and are
**not** part of the minimum mobile Family experience defined here.

## 2.2 Mobile shell (implemented)

Verified in Sprint 2.9B:

- registration, sign-in, session restore, sign-out
- ADR-019 disclosure gate (`authenticated-entry` → `/disclosure`)
- authenticated Home and Safety & Limitations
- Expo Router `(app)` group requires completed in-memory disclosure continuation
- Better Auth Expo SecureStore cookie transport + `GET /auth/me`
- validated `EXPO_PUBLIC_LUMORA_API_BASE_URL`

Family routes can therefore be placed inside `(app)` and inherit disclosure and
authentication guards without redesigning those flows.

## 2.3 Meaningful user-visible Family field

The only user-authored product field available today is `displayName`.
Timestamps `createdAt` / `updatedAt` are system fields and may be shown as
secondary metadata. No other Family product field exists.

---

# 3. Decision Summary

`apps/mobile` gains a minimum authenticated Family experience after disclosure
continuation:

1. Home links to Families.
2. Families list loads via `GET /families`.
3. Empty list offers create.
4. Create uses `POST /families` with `{ displayName }` only.
5. Successful creation navigates to the created Family detail.
6. Selecting a list item opens `GET /families/:familyId` detail.
7. Unavailable direct routes show a generic not-found state.
8. Safety & Limitations and sign-out remain reachable from the authenticated
   shell.
9. No Pregnancy, Child, Timeline, invitation, member directory, or Family edit
   UI is approved in this decision.

Server remains the authorization authority. The mobile client never decides
membership or roles.

---

# 4. Approved Product Flow

After disclosure continuation (`status === "authenticated"`):

```text
Home
  → Families list
      → Create Family → (success) Family detail
      → Family detail
  → Safety & Limitations (existing)
  → Sign out (existing)
```

Rules:

- Disclosure continues to precede all Family routes via the `(app)` guard.
- Authentication continues to precede disclosure and Family routes.
- Family UI does not replace Home; Home remains available.
- Back navigation from detail returns to the list; from list to Home.
- Back navigation must not bypass disclosure for the current process lifetime.

---

# 5. Mobile Routes

All routes are Expo Router file routes inside the authenticated `(app)` group.

| Surface       | Route                        | Purpose                 |
| ------------- | ---------------------------- | ----------------------- |
| Families list | `/(app)/families`            | Accessible Family list  |
| Create Family | `/(app)/families/create`     | Dedicated create screen |
| Family detail | `/(app)/families/[familyId]` | Minimum Family detail   |

Rationale for a dedicated create screen (not a modal): clearer focus order,
keyboard-safe form behavior, and simpler guard/test surface for the first
implementation.

Deep links / typed navigation into Family routes must still pass authentication
and disclosure guards. Family ids appear only as path segments, never as query
strings carrying secrets or personal data.

---

# 6. Family List Behavior

## 6.1 Request

- `GET {API_BASE}/families`
- Cookie session via Better Auth Expo `getCookie()` (same pattern as
  `GET /auth/me`)
- `credentials: "omit"`
- No bearer/JWT

## 6.2 Presentation fields

For each Family, show:

- `displayName` (primary)
- optional secondary `createdAt` (ISO parsed for local-friendly display)

Do **not** show role. List responses do not include role, and the client must
not invent one.

## 6.3 Ordering

Preserve server order: `createdAt` ascending, then `id` ascending.
Do not re-sort client-side into a different product order.

## 6.4 States

- **Loading:** initial fetch in progress; announce loading.
- **Empty:** `families: []` — authenticated user with no accessible Families.
  Primary action: Create Family.
- **Populated:** list items navigate to detail.
- **Retryable network/timeout error:** generic retry; do not claim Families
  exist or do not exist.
- **Unauthorized (401):** clear local auth/session through the central auth
  boundary and return to sign-in; clear Family in-memory state.

There is no separate “authenticated-but-no-access” API state beyond an empty
list. Empty list is the approved representation.

## 6.5 Refresh and pagination

- **Pull-to-refresh:** approved for the list.
- **Pagination / infinite scroll:** not approved; API has no pagination.
- **In-memory cache:** list results may be held in process memory for the
  current authenticated principal only.
- **No AsyncStorage / SecureStore** for Family domain data.

## 6.6 Privacy

- Do not log Family ids, names, or response bodies in routine logs.
- Do not reveal whether other Families exist outside the caller’s memberships.
- Empty vs error must not become an enumeration channel for other users’
  Families.

---

# 7. Family Creation Behavior

## 7.1 Route and request

- Screen: `/(app)/families/create`
- `POST {API_BASE}/families`
- Body: `{ "displayName": string }` only

## 7.2 Client validation (fail-fast, server authoritative)

Mirror server rules before submit:

- required string
- trim
- non-empty after trim
- max 100 Unicode code points
- no extra fields

Server validation remains authoritative. Map HTTP 400 codes
(`DISPLAY_NAME_REQUIRED`, `DISPLAY_NAME_INVALID`, `DISPLAY_NAME_TOO_LONG`,
`UNKNOWN_FIELD`) to generic, field-safe user messages without echoing raw
payloads.

## 7.3 Submission UX

- Disable submit while in flight (duplicate-submit prevention).
- Show progress on the primary action.
- No optimistic creation: wait for successful response before navigating.
- On success:
  1. update in-memory list (prepend/replace consistently with a subsequent
     list refresh, or insert the created `family` then refresh),
  2. navigate to `/(app)/families/{createdFamilyId}`.
- On retryable network failure: stay on create screen with generic retryable
  error.
- Do not display or persist `membership.role` as durable shell identity. Create
  responses include `membership.role: "OWNER"` for API completeness; the
  minimum UI does not surface role badges because list/detail do not return
  role and roles must not enter session state.

## 7.4 Explicit non-goals for creation

No rename, delete, avatar, description, custom role, invitation, Pregnancy /
Child creation, or onboarding wizard.

---

# 8. Family Detail Behavior

## 8.1 Route and request

- Screen: `/(app)/families/[familyId]`
- `GET {API_BASE}/families/:familyId`
- Same cookie transport as list/create

## 8.2 Presentation fields

Show:

- `displayName` (title)
- optional `createdAt` / `updatedAt` as secondary metadata

Do not show role, members, invitations, or domain feature dashboards.

## 8.3 States

- **Loading**
- **Available:** show minimum fields
- **Unavailable:** identical generic “Family not found” presentation for HTTP
  404 `FAMILY_NOT_FOUND` whether missing or inaccessible
- **Retryable network error**
- **Unauthorized:** central auth sign-out path

## 8.4 Future domain boundaries (documentation only)

Family detail is the future parent boundary for Pregnancy / Child / Timeline
navigation. The first implementation **must not** show non-functional controls,
placeholders, or disabled feature cards for those domains.

---

# 9. Mobile Family API Client Architecture

Implement the smallest client inside `apps/mobile` (for example
`src/family/`), not a new generalized domain SDK package.

## 9.1 Transport

- Reuse Better Auth Expo cookie transport (`getCookie()`)
- Reuse validated API base URL helper
- No custom JWT / bearer tokens
- No Prisma / Nest types in the mobile client
- Map JSON to local DTOs matching `FamilyResponse` / create response shapes

## 9.2 Reliability

- Bounded request timeout (implementation default: 15 seconds)
- `AbortController` cancellation on route exit, sign-out, and principal change
- Ignore stale responses that complete after a newer request for the same
  surface (request generation / sequence token)
- Distinguish:
  - `unauthorized` (401) → auth boundary
  - `family_not_found` (404 `FAMILY_NOT_FOUND`) → generic unavailable UI
  - `validation` (400 with known codes) → safe field errors on create
  - `network` / timeout / abort → retryable error

## 9.3 Logging

- No cookies, tokens, emails, Family payloads, or raw response bodies in logs
- No sensitive debug UI

---

# 10. State Ownership

| Concern                            | Owner                                  |
| ---------------------------------- | -------------------------------------- |
| Membership / authorization         | Server (`FamilyMembership`)            |
| Session authenticity               | Better Auth server + mobile auth shell |
| Family list/detail/create UI state | Mobile process memory only             |
| Disclosure continuation            | Existing in-memory shell flag          |

Rules:

- No offline-first, background sync, or domain-data SecureStore/AsyncStorage
- Clear Family in-memory state on sign-out and principal change
- Refresh list after successful create (and on pull-to-refresh)
- Cancel in-flight Family requests on route exit / principal change
- Reset error state when starting a new fetch or leaving the screen

---

# 11. Navigation and Guards

- Family routes live only under `(app)`.
- `(app)` already requires `authenticated` (disclosure continued).
- Unauthenticated users redirect to sign-in.
- `authenticated-entry` users redirect to `/disclosure` and cannot open Family
  routes.
- Sign-out clears Family state and returns to auth routes.
- Direct navigation to an inaccessible `familyId` shows generic unavailable UI
  after a successful auth/disclosure gate.
- No redirect loops between Home, Families, disclosure, and auth.

---

# 12. Privacy and Security

- Family remains the privacy boundary.
- Mobile never decides authorization.
- Roles do not enter Better Auth sessions or durable mobile identity state.
- No Family data in analytics, crash payloads, notification previews, or URL
  query strings.
- No production mock Family data.
- No screenshot-protection claim.
- Non-enumeration for unavailable Families remains mandatory.
- This experience does not weaken ADR-019 disclosure, verified-email, or
  invitation security semantics.

---

# 13. Accessibility and Presentation Minimums

- Readable dynamic type / text scaling
- Screen-reader labels for list items, create fields, primary actions
- Logical focus order on create form
- Sufficient contrast
- Minimum ~48 dp touch targets
- Loading and error announcements
- Keyboard-safe create form
- Non-color-only errors
- Empty state with a clear create action
- Long `displayName` values wrap without breaking layout
- No complete visual/branding system in this sprint

---

# 14. Testing Strategy (for the implementation sprint)

## 14.1 Family API client

- list success / empty list
- create success
- direct-get success
- validation failure mapping
- `FAMILY_NOT_FOUND`
- unauthorized / session expiry
- retryable network error
- timeout / cancellation
- no sensitive logging
- no bearer/JWT

## 14.2 Navigation

- Home → Families
- empty → create
- create success → detail
- list → detail
- unavailable direct route
- disclosure guard
- authentication guard
- sign-out / principal-change clears Family state
- no redirect loops

## 14.3 State

- process-memory only
- no AsyncStorage/SecureStore Family data
- refresh after creation
- stale-response protection
- user isolation

## 14.4 Accessibility

- list semantics
- form labels
- loading/error announcements
- touch targets
- keyboard behavior

## 14.5 Regression

- registration / sign-in / restore / sign-out
- disclosure gate and Safety & Limitations
- backend Family authorization and OWNER/MEMBER access
- existing Pregnancy / Child / Timeline / invitation PostgreSQL suites

---

# 15. Device / Emulator Smoke (implementation sprint)

When a device or emulator is available, verify:

1. Sign in
2. Complete disclosure
3. Open Families
4. Empty or populated list
5. Create Family
6. Open Family detail
7. Pull-to-refresh list
8. Sign out
9. Cold restart / session restoration still requires disclosure before Families
10. Unavailable Family id shows generic not-found UI

This documentation sprint does not claim device verification.

---

# 16. Implementation Slicing

## 16.1 Exact next implementation sprint

**Sprint 2.10B — Minimum Mobile Family List, Create, and Detail**

In scope:

- mobile Family API client (cookie transport, timeout, abort, DTO mapping)
- Families list (`/(app)/families`)
- Family create (`/(app)/families/create`)
- Family detail (`/(app)/families/[familyId]`)
- Home entry to Families
- navigation/guards within existing authenticated + disclosure shell
- focused client/navigation/state/accessibility tests
- Android/iOS interactive smoke when available

Out of scope for 2.10B:

- invitation UI
- member directory
- role management UI
- Family rename/delete
- Pregnancy / Child / Timeline UI
- Media / Health / AI
- offline sync / local domain persistence
- API/schema/migration changes

Sprint 2.10B is architecturally unblocked by this decision.

---

# 17. Explicit Exclusions and Deferred Decisions

This decision does not implement or approve:

- Family UI code in Sprint 2.10A
- Family rename/edit/delete
- member listing
- invitation UI or invitation email delivery
- role management, ownership transfer, leave/remove
- Family avatar/image/description
- Pregnancy / Child / Timeline UI
- Media / Health / AI
- notifications / analytics / crash-reporting SDK
- local domain-data persistence or offline sync
- push / background refresh
- pagination or search/filter (API does not provide them)
- admin/web Family UI
- production email provider
- API/schema/migration changes
- generalized design system
- pilot/Beta planning

Deferred:

- displaying role when/if a reviewed API exposes role on list/detail
- Family update/`displayName` mutation UX (no update endpoint today)
- Pregnancy/Child entry points on Family detail after those ADRs’ client sprints
- invitation acceptance UX on mobile

---

# 18. Sprint 2.10A Completion Record

Sprint 2.10A documents:

- verified Family create/list/direct-get contracts and ordering
- approved mobile routes and product flow
- list/create/detail presentation rules without inventing fields
- cookie-based Family API client boundary
- process-memory state ownership
- navigation/guard requirements behind disclosure
- privacy, security, and accessibility minimums
- testing and device-smoke expectations
- exact follow-on implementation sprint 2.10B

No application code, dependencies, lockfiles, schema, migrations, or tests are
changed by this sprint.

---

# 19. Sprint 2.10B Completion Record

Sprint 2.10B implements the minimum mobile Family experience in `apps/mobile`
against existing Family API contracts only.

## 19.1 Routes and Home entry

- `/(app)/families` — membership-scoped list, pull-to-refresh, empty state,
  create entry
- `/(app)/families/create` — `displayName` only, client validation mirroring
  server Unicode code-point rules
- `/(app)/families/[familyId]` — direct-get detail; generic unavailable UI for
  `FAMILY_NOT_FOUND`
- Home provides an accessible Families entry; Safety & Limitations and sign-out
  remain available
- Family routes remain inside `(app)` and inherit authentication + disclosure
  continuation guards

## 19.2 Family API client behavior

- Cookie session via Better Auth Expo `getCookie()` + validated
  `EXPO_PUBLIC_LUMORA_API_BASE_URL`
- `credentials: "omit"`; no custom bearer token auth
- Exact DTO mapping at the client boundary; malformed responses rejected
- `AbortController` + 15s bounded timeout
- Distinguishes unauthorized, `FAMILY_NOT_FOUND`, validation, network, server,
  malformed, and aborted results
- Unauthorized results clear process-memory Family state and route through the
  central session sign-out boundary
- No sensitive request/response logging; `familyId` path-encoded; no Family data
  in query strings

## 19.3 Process-memory Family state

- Server remains authoritative; no AsyncStorage/SecureStore/domain cache for
  Family data
- Clears on sign-out and principal change; stale in-flight responses ignored
- Create refreshes list after success (no optimistic insert); direct-get may
  upsert matching list/detail memory

## 19.4 Verification performed

- Mobile lint, type-check, tests, Expo shell verification, and workspace
  verification suite for this sprint
- Android/iOS static bundle/export validation attempted as part of Expo export
  checks where applicable
- Prisma schema/migrations and backend Family API contracts unchanged

## 19.5 Device / emulator smoke

No safe existing Android emulator, iOS simulator, or connected device was
available for interactive smoke in this environment. Interactive smoke is
therefore not claimed. Android and iOS static `expo export` bundle validation
passed without native prebuild or `android/`/`ios/` directories.

## 19.6 Next truthful UI checkpoint

Minimum Pregnancy mobile list/create/detail is implemented in Sprint 2.11B per
`docs/22-minimum-mobile-pregnancy-experience-architecture-decision.md`.
Minimum Child mobile list/create/detail/displayName-edit is implemented in
Sprint 2.12B per
`docs/23-minimum-mobile-child-experience-architecture-decision.md`.
Minimum Timeline mobile list/create/detail is implemented in Sprint 2.13B per
`docs/24-minimum-mobile-timeline-experience-architecture-decision.md`.
