# Minimum Authenticated Mobile Shell Architecture Decision

Version: 1.0

Status: Approved — Sprint 2.9B.3 Disclosure Presentation Implemented

Phase: MVP Client Foundation

Decision date: 2026-07-22

---

# 1. Purpose

Sprint 2.9A approved the MVP medical-safety and AI-limitation disclosure in
`docs/19-mvp-medical-safety-and-ai-disclaimer-architecture-decision.md`.
Presentation is blocked because no authenticated user-facing client exists.

This decision defines the smallest production-directed authenticated mobile
shell in `apps/mobile` capable of:

- registration,
- sign-in,
- trusted session restoration,
- sign-out,
- first authenticated entry,
- displaying the approved medical/AI safety disclosure,
- permanently exposing Safety & Limitations,
- providing a minimal authenticated application Home,
- and connecting safely to the existing API.

Sprint 2.9B.0 is documentation-only. It does not implement the mobile client,
install dependencies, change lockfiles, alter API code, schema, migrations,
endpoints, or tests.

---

# 2. Verified Repository State

## 2.1 Primary client

- `docs/09-repository-layout.md` designates `apps/mobile` as the primary client
  and first production client.
- `docs/10-technology-stack.md` already approves React Native with Expo for
  iOS and Android; web support is optional.
- `apps/mobile` currently contains only workspace scaffolding
  (`package.json`, `tsconfig.json`) with no `src`, Expo config, screens, or
  navigation.
- `apps/admin` is an empty stub and is not an MVP client.
- `apps/api` is a NestJS API composition layer, not a user-facing client.

## 2.2 Workspace and toolchain

- Package manager: `pnpm@10.16.1` (root `packageManager`).
- Node engines: `>=24`.
- Workspaces: `apps/*`, `packages/*`.
- Root TypeScript is present; packages commonly pin TypeScript `~5.9.3`.
- `apps/mobile` currently extends `tsconfig.base.json` with NodeNext settings
  unsuitable as the final Expo app TypeScript configuration; Expo-compatible
  TypeScript settings must replace or supersede this for the client
  implementation.

## 2.3 Authentication and sessions

- Better Auth `1.6.23` is installed through `@lumora/auth`.
- Sessions are server-managed database sessions.
- Transport verified by PostgreSQL suites is the Better Auth HTTP-only session
  cookie (`better-auth.session_token`), not a custom JWT foundation.
- Cookie attributes are configured as `httpOnly`, `sameSite: "lax"`, and
  `secure` in production.
- Neutral application principal is exactly
  `{ id, email, emailVerified, name }`.
- Family roles and permissions must not enter authentication or client session
  identity state.
- `AUTH_TRUSTED_ORIGINS` currently validates only `http:` and `https:` origins.
- No NestJS CORS module is configured in `apps/api`; Better Auth origin checks
  use `trustedOrigins`.
- Raw Better Auth email-verification routes remain externally blocked; Lumora
  facades own verification request/confirm.

## 2.4 Better Auth mobile evidence

- `@better-auth/expo@1.6.23` exists on the npm registry and declares a peer
  dependency on `better-auth@^1.6.23`, matching the installed auth version.
- Official Better Auth Expo integration for this line requires:
  - server plugin `@better-auth/expo` (`expo()`),
  - client plugin `@better-auth/expo/client` (`expoClient`),
  - `expo-secure-store` for secure cookie/session storage on native,
  - app scheme entries in `trustedOrigins` (for example `lumora://`),
  - and development-only `exp://` trust patterns when using Expo Go.
- `@better-auth/expo` is **not** currently installed in the workspace.
- Expo SDK 55 documents Node support including `^24.3.0`, which is compatible
  with the repository `engines.node >= 24` constraint.

## 2.5 Disclosure state

- ADR-019 defines canonical content id `lumora.safety.mvp.medical-ai.v1`.
- No acknowledgment persistence is approved.
- No current application displays the disclosure.

---

# 3. Decision Summary

`apps/mobile` is the MVP primary user-facing client.

The minimum authenticated shell uses:

- React Native,
- Expo,
- TypeScript,
- Expo Router for minimum route groups,
- Better Auth’s supported Expo client/server integration with SecureStore-backed
  cookie transport,
- `@lumora/shared` as the framework-neutral home for the canonical safety copy,
- and a non-persistent, deterministic first-entry disclosure rule based only on
  in-memory process state.

No custom bearer-token authentication system is approved. Session authority
remains on the server through Better Auth.

---

# 4. Mobile Runtime and Toolchain

## 4.1 Runtime

- **Application:** `apps/mobile` (`@lumora/mobile`)
- **UI runtime:** React Native
- **Framework:** Expo
- **Language:** TypeScript

`apps/mobile` is a composition/presentation layer. It must not own Family,
Pregnancy, Child, Timeline, or authorization business rules. Those remain in
domain packages and the API.

## 4.2 Supported targets for the first implementation

Included:

- Android (emulator and physical device),
- iOS (simulator and physical device).

Excluded from the minimum shell:

- Expo web / React Native Web as a required MVP surface,
- admin web client,
- app-store release configuration beyond what Expo needs for local/dev builds.

## 4.3 Expo Go versus development builds

- First implementation may use **Expo Go** while dependencies remain within Expo
  Go-compatible modules (`expo-secure-store` is acceptable).
- A custom **development client / prebuild** is deferred until a required native
  capability cannot run in Expo Go.
- Production release signing, store listing, and EAS production profiles are
  deferred.

## 4.4 SDK and dependency selection rule

At implementation time:

1. Install Expo using the current Expo-supported SDK that is compatible with
   `@better-auth/expo@1.6.23` and `better-auth@1.6.23`.
2. Prefer Expo’s own version alignment commands for React Native, React, and
   Expo modules rather than inventing mixed versions.
3. Pin `@better-auth/expo` to **1.6.23** to match the installed Better Auth
   major/minor/patch line unless a later reviewed auth upgrade changes both
   together.
4. Do not introduce a second authentication library.

Exact Expo SDK patch numbers are selected during the implementation sprint from
then-current Expo and `@better-auth/expo` compatibility evidence, not frozen
here as guessed patch pins.

## 4.5 Workspace integration

- Remain inside the existing pnpm workspace.
- Keep `@lumora/mobile` as the Expo app package.
- Allow `@lumora/mobile` to depend on `@lumora/shared` for the safety constants.
- Do not move NestJS, Prisma, or domain write logic into the mobile app.
- Metro must remain able to resolve workspace packages. Prefer Expo’s default
  monorepo-aware Metro configuration from `expo/metro-config`.
- If pnpm isolation prevents native module resolution, the implementation sprint
  may apply the smallest Expo/pnpm-documented adjustment (for example Expo
  autolinking experiments or a documented linker setting) without redesigning
  the monorepo.

## 4.6 TypeScript configuration

- Replace the current NodeNext mobile tsconfig with an Expo-compatible
  TypeScript configuration for the app.
- Root/package TypeScript versions may differ when Expo requires it; document
  the selected mobile TypeScript version in the implementation record.
- Keep strict typechecking enabled for application source.

## 4.7 Environment and configuration ownership

- Mobile owns client env values such as `EXPO_PUBLIC_LUMORA_API_BASE_URL`.
- API continues to own `BETTER_AUTH_*`, `AUTH_TRUSTED_ORIGINS`, database, and
  delivery configuration.
- No production secrets belong in the mobile bundle.
- Fail closed when the API base URL is missing, malformed, or uses a non-HTTPS
  scheme outside approved local development hosts.

## 4.8 Node and pnpm compatibility

- Node `>=24` remains the repository engine constraint and is compatible with
  Expo SDK 55’s documented Node 24 support.
- pnpm workspace remains the package manager.
- Implementation must not switch the repository to npm/yarn workspaces.

## 4.9 Native prebuild

- Not required for the minimum Expo Go-compatible shell.
- Deferred until a later reviewed native dependency forces it.

---

# 5. Navigation and Screen Boundaries

## 5.1 Navigator

Use **Expo Router** as the minimum file-based navigator. It is the smallest
maintainable Expo-native routing approach for auth groups and deep-link scheme
alignment.

## 5.2 Route groups

Unauthenticated group `(auth)`:

- Registration
- Sign-in

Authenticated entry:

- First authenticated entry safety disclosure

Authenticated group `(app)`:

- Minimal Home
- Safety & Limitations

Sign-out is an action available from Home (and may also be available from the
disclosure screen). It is not a standalone product feature screen.

## 5.3 Guards and states

Required client states:

- **bootstrapping** — session restoration in progress,
- **unauthenticated**,
- **authenticated-entry** — session valid; disclosure step not yet completed
  for this process lifetime,
- **authenticated** — disclosure step completed for this process lifetime,
- **error/unknown** — session probe failed for a non-auth reason; show a generic
  retryable error, not Family data.

Rules:

- Unauthenticated users may access only registration and sign-in.
- Authenticated users who have not completed the in-memory disclosure step may
  not enter Home.
- Safety & Limitations is reachable from Home after the disclosure step, and
  may also be opened from the disclosure screen without creating a Family.
- Deep links into Family, Pregnancy, Child, Timeline, invitation, or future
  feature routes are out of scope and must not be registered by this shell.
- Back navigation must not bypass auth guards into Home before the disclosure
  step for the current process lifetime.
- After sign-out, navigation returns to the unauthenticated group and clears
  in-memory disclosure-step state.

## 5.4 Explicit screen exclusions

Do not design or register screens for:

- Family create/list,
- invitations,
- email-verification request/confirm UI,
- Pregnancy, Child, Timeline,
- Media, Health, AI,
- profile/settings beyond sign-out,
- or admin tooling.

---

# 6. Authentication Client

## 6.1 Approved client stack

- `better-auth/react` `createAuthClient`
- `@better-auth/expo/client` `expoClient`
- `expo-secure-store` as SecureStore backing

Base URL points at the Lumora API origin that serves Better Auth under
`/api/auth`.

## 6.2 Required operations

The shell must support:

1. **Registration** — Better Auth email/password sign-up through the existing
   API auth routes.
2. **Sign-in** — Better Auth email/password sign-in.
3. **Current principal retrieval** — `GET /auth/me` after session establishment,
   mapping only `{ id, email, emailVerified, name }`.
4. **Session restoration** — on cold start, restore cookie-backed session via
   the Expo auth client and confirm with `GET /auth/me` or an equivalent Better
   Auth session probe that yields the same neutral principal.
5. **Sign-out** — Better Auth sign-out plus local secure-store cookie/session
   cleanup and navigation to unauthenticated routes.

## 6.3 `emailVerified`

- The principal field is retained and may be displayed later.
- The minimum shell does **not** expose email-verification request or confirm
  screens.
- Unverified users may use the shell, matching current API policy that
  verification is not a global gate for private-feature access.
- Invitation acceptance and other verified-email-gated flows remain out of this
  shell.

## 6.4 Unauthorized and expired sessions

- HTTP 401 from guarded API routes clears local auth client session state and
  returns the user to sign-in.
- Generic user-facing copy must not reveal whether an email exists.
- No Family role inference from auth failures.

## 6.5 Identity boundary

Client session/identity state may hold only authentication-adjacent data needed
for the shell (session presence and the neutral principal). It must never store:

- Family ids as authorization claims,
- OWNER/MEMBER roles,
- invitation secrets,
- Pregnancy/Child/Timeline payloads.

---

# 7. Session Transport and Storage

## 7.1 Server authority

The API continues to use Better Auth cookie-backed database sessions. The
mobile client must not invent a parallel JWT/bearer access-token system.

## 7.2 Native cookie handling

React Native does not provide browser cookie jars equivalent to web.
Therefore:

- use Better Auth’s Expo client plugin with `expo-secure-store`,
- persist only the Better Auth session cookie material the plugin requires,
- attach cookies to auth and API requests as required by the Expo integration
  (`Cookie` header; avoid conflicting credential modes),
- and treat SecureStore as the only approved durable client store for session
  cookies.

## 7.3 Storage prohibitions

Never store in AsyncStorage, plain files, logs, analytics, or crash reports:

- raw session tokens/cookies,
- passwords,
- Better Auth secrets,
- invitation secrets,
- verification tokens.

AsyncStorage may not be used as a session store.

## 7.4 Locally persistable data

Allowed durable client persistence for this shell:

- Better Auth Expo SecureStore cookie/session cache managed by the auth client.

Allowed in-memory only:

- disclosure-step completion for the current process lifetime,
- transient form state,
- transient loading/error UI state.

## 7.5 Lifecycle

- **Logout:** call server sign-out, clear SecureStore auth material, clear
  in-memory disclosure-step state, navigate to `(auth)`.
- **Stale session:** any unauthorized session probe clears local auth state.
- **App restart (process death):** restore session from SecureStore + server
  validation; disclosure-step in-memory state is reset, so the disclosure is
  shown again before Home.
- **Background/foreground without process death:** do not re-force the
  disclosure solely because the app resumed; a foreground session revalidation
  may still sign the user out if the server session is invalid.
- **CSRF/origin:** rely on Better Auth trusted-origin checks; mobile must send
  the origins/scheme configuration the Expo integration requires.
- **Production HTTPS:** API base URL must be HTTPS in production builds.

## 7.6 Required future API configuration changes

Documented for a later implementation sprint; not implemented here:

1. Add dependency `@better-auth/expo@1.6.23` to the auth/API composition path.
2. Register the Better Auth server plugin `expo()` alongside existing plugins.
3. Extend trusted-origin parsing/validation to allow the approved mobile app
   scheme (`lumora://` / `lumora://*`) in addition to `http:` / `https:`.
4. In development only, allow the minimum Expo Go `exp://` trusted-origin
   patterns required by Better Auth’s Expo guide; never enable broad `exp://`
   trust in production.
5. Ensure `AUTH_TRUSTED_ORIGINS` deployment values include the production app
   scheme.
6. Preserve existing cookie session semantics; do not switch to custom JWTs.

These are additive authentication-composition changes, not a redesign of
identity, principal shape, or Family authorization.

---

# 8. First Authenticated Entry Disclosure Rule

This section resolves ADR-019’s non-persistent presentation requirement for the
mobile shell.

## 8.1 Deterministic non-persistent rule

Because no read/seen acknowledgment may be stored, the client **must not**
claim “shown once ever.”

Approved rule:

1. When the client transitions from **unauthenticated or bootstrapping** into a
   **server-validated authenticated** state, enter `authenticated-entry`.
2. While in `authenticated-entry`, show the ADR-019 disclosure before Home.
3. When the user chooses an informational continue action (no checkbox, no
   legal acceptance), set an **in-memory process flag** that the disclosure
   step is complete for this process lifetime and enter `authenticated`.
4. Reset that in-memory flag on sign-out and on process death.
5. Therefore the disclosure appears on:
   - every fresh sign-in,
   - every fresh registration that yields an authenticated session,
   - and every cold-start session restoration into an authenticated state.
6. The disclosure does **not** reappear merely because the user navigates
   between Home and Safety & Limitations during the same process lifetime.

## 8.2 Invariants

- OWNER and MEMBER behavior is identical; the shell has no Family role state.
- Informational only; no checkbox; no acceptance API; no viewing telemetry.
- Canonical meaning and content id from ADR-019 are required.
- Full disclosure text must be readable/scrollable before continue.

---

# 9. Safety & Limitations Content Ownership

- Stable authenticated route in the `(app)` group.
- Permanently reachable from Home.
- No Family creation or FamilyMembership lookup.
- Content identifier: `lumora.safety.mvp.medical-ai.v1`.
- Canonical English meaning: ADR-019 section 5.
- Presentation owned by `apps/mobile`.
- Canonical constants live in **`@lumora/shared`** so future clients share one
  framework-neutral source of truth.
- No REST, CMS, or database-backed content.
- No analytics or viewing telemetry.
- No persistent global banner.

---

# 10. Minimum Home Shell

Home must:

- confirm the user is authenticated (for example show the principal email/name
  without implying verification UX),
- navigate to Safety & Limitations,
- provide sign-out,
- and state clearly that Family/Pregnancy/Child/Timeline features are not part
  of this shell.

Home must not:

- fetch or display Family-contained domain data,
- become a dashboard information architecture,
- preview invitations,
- or pretend unimplemented features exist as interactive product surfaces.

---

# 11. API Connectivity

## 11.1 Base URL

- Configure via environment (`EXPO_PUBLIC_LUMORA_API_BASE_URL` or equivalent).
- Validate absolute URL, http/https only.
- Local development may use:
  - Android emulator loopback alias to host (`10.0.2.2`) when the API runs on
    the developer machine,
  - iOS simulator `http://localhost` / `127.0.0.1`,
  - LAN IP for physical devices on the same network.
- Production builds require HTTPS and must fail closed otherwise.
- No hard-coded production credentials or endpoints.
- No mock API in production builds.

## 11.2 Errors and logging

- Timeouts and network failures use generic user-facing messages.
- Do not log cookies, passwords, tokens, principal emails in routine logs, or
  raw auth response bodies.
- Development-only debug logging must be compile-time or explicit env gated and
  disabled in production.

## 11.3 Backend coupling

- Auth routes remain under `/api/auth`.
- Application principal remains `GET /auth/me`.
- Future Family routes are out of this shell’s required calls.

---

# 12. Privacy and Security

- No Family, Pregnancy, Child, Timeline, invitation, or role data is persisted
  by this shell.
- No authentication secrets in logs.
- No session cookies/tokens in ordinary React state dumps, analytics, or
  breadcrumbs.
- Safety-disclosure viewing is not tracked.
- No third-party analytics SDK in the minimum shell.
- Crash/error reporting SDKs are deferred; if added later, they must redact
  auth material and personal data under a separate decision.
- No screenshot-prevention claim is made by this decision.
- Generic authentication/network errors where enumeration risk exists.
- The disclosure cannot waive privacy, continuity, or acquisition safeguards
  from existing ADRs.

---

# 13. Accessibility and Content Presentation

Minimum requirements:

- readable dynamic type / text scaling,
- screen-reader labels for auth fields, primary actions, and disclosure
  continue,
- logical focus order on authentication forms,
- sufficient contrast for text and controls,
- scrollable disclosure content that does not truncate required statements,
- keyboard-safe authentication forms,
- no color-only meaning,
- loading and error announcements,
- and no visually hidden canonical safety meaning.

A full design system is deferred.

---

# 14. Testing and Verification Strategy

## 14.1 Pure / unit

- API base-URL validation and fail-closed rules,
- principal mapping rejects unexpected role/permission fields,
- disclosure constants export content id and required statements,
- in-memory disclosure-step state transitions.

## 14.2 Component / navigation

- unauthenticated guards,
- authenticated-entry gate blocks Home,
- continue enables Home,
- Safety & Limitations reachable from Home without Family APIs,
- sign-out returns to auth routes and clears disclosure-step state.

## 14.3 API-contract integration

- registration,
- sign-in,
- `GET /auth/me`,
- session restoration,
- expired/invalid session → sign-in,
- sign-out,
- cookie/session transport through the Expo auth client against a running API
  with the Expo server plugin and scheme trusted origins enabled.

## 14.4 Device / simulator smoke

- Android emulator startup,
- iOS simulator startup,
- production HTTPS fail-closed check in release configuration,
- accessibility basics for disclosure readability,
- secret/log leakage checks,
- existing backend regression suites remain green after the documented API
  Expo transport unlock.

---

# 15. Implementation Slicing

Approved sequence:

1. **Sprint 2.9B.1 — Expo mobile workspace foundation and Better Auth Expo
   transport unlock** _(implemented; see §15.2)_
2. **Sprint 2.9B.2 — Authenticated session shell** _(implemented; see §15.3)_
3. **Sprint 2.9B.3 — ADR-019 disclosure surfaces on the shell** _(implemented;
   see §15.4)_

## 15.1 Exact next implementation sprint

Sprint 2.9B (authenticated Expo shell + ADR-019 disclosure presentation) is
complete through §15.4. The minimum mobile Family list/create/detail experience
is implemented in Sprint 2.10B per
`docs/21-minimum-mobile-family-experience-architecture-decision.md`. The
minimum mobile Pregnancy experience architecture is documented in
`docs/22-minimum-mobile-pregnancy-experience-architecture-decision.md`
(implementation: Sprint 2.11B).

## 15.2 Sprint 2.9B.1 Implementation Record

Sprint 2.9B.1 implements:

- Expo SDK `~57.0.8` / React Native `0.86.0` / React `19.2.3` workspace app in
  `apps/mobile`,
- TypeScript `~5.9.3` for the mobile package (Expo’s optional `~6.0.3`
  recommendation is intentionally not adopted to avoid a mobile-only TypeScript
  6 jump while the monorepo root remains on a separate TypeScript line),
- Metro monorepo configuration and Expo config with scheme `lumora`,
- temporary technical bootstrap root (replaced later by the Sprint 2.9B.2 shell),
- validated `EXPO_PUBLIC_LUMORA_API_BASE_URL`,
- Better Auth Expo client transport composition with SecureStore-compatible
  sync storage and Lumora storage prefix,
- `@better-auth/expo@1.6.23` server plugin in `@lumora/auth`,
- trusted-origin support for `lumora://` / `lumora://*` and development-only
  `exp://` / `exp://**`,
- and automated foundation/config/origin/auth-composition tests.

Verification completed in-repo:

- `pnpm` install/lockfile, lint, typecheck, test, build
- mobile foundation script (`expo config`, Metro load, no `android/`/`ios/`)
- `@lumora/auth` trusted-origin + Expo plugin tests
- API unit + integration auth suites
- disposable PostgreSQL Authentication, Family (incl. invitation entry),
  Pregnancy, Child, and Timeline suites
- Prisma validate/generate (no schema/migration changes)

Verification gap intentionally deferred:

- Android emulator and iOS simulator interactive smoke starts were not executed
  in this environment (`expo install --check` reports only the intentional
  TypeScript pin difference above).

## 15.3 Sprint 2.9B.2 Implementation Record

Sprint 2.9B.2 implements:

- Expo Router entry (`expo-router/entry`) with `(auth)` and `(app)` groups,
- registration and sign-in screens using Better Auth email/password,
- SecureStore-backed session restore via `useSession` plus `GET /auth/me`,
- authenticated Home showing only the neutral principal and a clear
  non-Family-shell statement,
- sign-out with Better Auth sign-out and Lumora SecureStore cookie/session
  cleanup,
- client shell states `bootstrapping` / `unauthenticated` / `authenticated` /
  `error` with route-group guards,
- Expo Router dependencies aligned to SDK 57 (`expo-router`, screens, safe
  area, gesture handler, reanimated, splash screen; `react-dom` peer for
  Expo tooling only — Expo web remains non-required).

ADR-019 disclosure presentation and Safety & Limitations remain deferred to
Sprint 2.9B.3 (authenticated users may enter Home in this sprint).

Verification completed in-repo:

- mobile unit/architecture tests, typecheck, lint, Expo shell verification
  script
- workspace lint/typecheck/test/build as applicable
- no schema/migration changes
- no generated `android/` or `ios/` directories

Verification gap intentionally deferred:

- Android emulator and iOS simulator interactive smoke against a running API
  were not executed in this environment.

## 15.4 Sprint 2.9B.3 Implementation Record

Sprint 2.9B.3 implements:

- `@lumora/shared` export of `lumora.safety.mvp.medical-ai.v1` and the exact
  ADR-019 English canonical copy,
- shell status `authenticated-entry` gated by an in-memory continuation flag,
- `/disclosure` first-entry surface with full scrollable copy, informational
  Continue, and sign-out escape,
- `/(app)/safety` permanently reachable Safety & Limitations route from Home,
- route guards blocking Home/Safety until continuation, resetting on sign-out
  and principal change,
- and content/navigation/privacy/accessibility regression tests.

Verification completed in-repo:

- shared + mobile lint/typecheck/test/build
- workspace lint/typecheck/test/build as applicable
- Expo config / Metro / shell route verification
- `expo export` Android and iOS JS bundles (no prebuild / no native projects)
- no schema/migration changes
- no generated `android/` or `ios/` directories

Verification gap intentionally deferred:

- Android emulator and iOS simulator interactive smoke against a running API
  were not executed in this environment.

---

# 16. Explicit Exclusions and Deferred Decisions

This decision does not implement or approve:

- mobile dependency installation in Sprint 2.9B.0,
- Expo project files in Sprint 2.9B.0,
- navigation/screens implementation in Sprint 2.9B.0,
- authentication client implementation in Sprint 2.9B.0,
- disclaimer UI implementation in Sprint 2.9B.0,
- Family, invitation, email-verification, Pregnancy, Child, or Timeline UI,
- Media, Health, AI,
- notifications, push, offline sync,
- analytics or crash-reporting SDK,
- localization,
- deep-link invitation acceptance,
- production email delivery,
- app-store configuration,
- branding/complete design system,
- admin client,
- required Expo web client,
- custom JWT/bearer auth,
- persistent disclosure acknowledgment,
- and schema/migration changes.

Deferred:

- development-client/prebuild unless forced by native modules,
- EAS production pipelines,
- social login on mobile,
- email-verification mobile UI,
- Family feature navigation,
- and any redesign of Better Auth cookie semantics beyond the Expo plugin.

---

# 17. Sprint 2.9B.0 Completion Record

Sprint 2.9B.0 documents:

- verified client/auth/toolchain state,
- Expo/React Native mobile shell architecture,
- navigation and screen boundaries,
- Better Auth Expo session transport requirements,
- non-persistent first-entry disclosure rule,
- Safety & Limitations content ownership,
- API connectivity and required future API unlocks,
- privacy, security, and accessibility minimums,
- testing strategy,
- and the exact next implementation sprint (2.9B.1).

No application code, dependencies, lockfiles, schema, or tests are changed by
this sprint.

---

# 18. Future Review Triggers

Review this decision when:

- Sprint 2.9B.1 begins,
- Expo SDK or `@better-auth/expo` compatibility forces an auth upgrade,
- SecureStore/Expo Go limits force a development client,
- cookie/session transport proves incompatible with production mobile
  networking,
- a web client is proposed as a second MVP surface,
- email-verification mobile UI is proposed,
- Family feature navigation is proposed,
- or privacy, continuity, or acquisition obligations change.

---

# 19. References

- `docs/START-HERE.md`
- `docs/01-product-vision.md`
- `docs/02-product-principles.md`
- `docs/04-mvp-scope.md`
- `docs/05-roadmap.md`
- `docs/06-security-and-medical-safety.md`
- `docs/09-repository-layout.md`
- `docs/10-technology-stack.md`
- `docs/11-founder-independence-and-long-term-continuity.md`
- `docs/12-authentication-architecture-decision.md`
- `docs/18-verified-email-ownership-architecture-decision.md`
- `docs/19-mvp-medical-safety-and-ai-disclaimer-architecture-decision.md`
- `docs/99-deferred-decisions.md`
