# Verified Email Ownership Architecture Decision

Version: 1.1

Status: Approved — Implemented and PostgreSQL-Verified

Phase: MVP Authentication Assurance Foundation

Decision date: 2026-07-22

---

# 1. Purpose

Lumora's approved Family invitation flow requires more than an authenticated
email string. Invitation acceptance must know that the authenticated User
controlled the exact email address targeted by the invitation.

The current Better Auth foundation stores `emailVerified`, but Lumora does not
issue verification messages, consume verification links as an approved product
flow, or expose verification assurance through its neutral principal.

This decision defines the smallest trustworthy verified-email architecture that:

- uses the installed Better Auth foundation,
- proves control of one canonical account email,
- keeps authentication separate from Family authorization,
- preserves non-enumeration,
- avoids a parallel token system,
- and unblocks a separate verified-email implementation sprint.

This sprint is documentation-only. It does not change authentication
configuration, delivery infrastructure, dependencies, environment variables,
schema, migrations, endpoints, principals, or tests.

---

# 2. Verified Current Behavior

The repository currently uses:

- `better-auth@1.6.23`,
- email/password authentication,
- server-managed database sessions,
- the Prisma adapter through `@lumora/database`,
- and NestJS guards and principal mapping in `apps/api`.

Current behavior is:

- registration validates email with Better Auth's installed Zod email validator,
- Better Auth lowercases the complete accepted email before storage,
- `User.email` has an exact unique index,
- `User.emailVerified` exists and defaults to `false`,
- registration creates a usable session for an unverified User,
- unverified Users may sign in,
- guarded application routes do not require email verification,
- no verification-delivery callback is configured,
- `GET /auth/me` and the neutral principal contain `id`, `email`, and `name`,
- the principal omits `emailVerified`,
- session resolution reads trusted server-side User state,
- no cookie-cached User state is configured,
- and Family authorization reads persisted FamilyMembership.

Better Auth 1.6.23 provides:

- an `emailVerification.sendVerificationEmail` provider-neutral callback,
- `sendOnSignUp`,
- `sendOnSignIn`,
- `autoSignInAfterVerification`,
- configurable verification expiry,
- `POST /api/auth/send-verification-email`,
- `GET /api/auth/verify-email`,
- and persisted `User.emailVerified`.

Its built-in link token:

- is an HS256 signed JWT,
- contains the lowercased email in its signed payload,
- defaults to one-hour expiry,
- is not encrypted,
- is not stored in the `Verification` table,
- has no per-issuance database consumption record,
- allows concurrently issued links to coexist until expiry,
- and returns idempotent success after the User is already verified.

The installed implementation does not provide a custom token generator for this
flow. The existing `Verification` table is used by other Better Auth workflows;
the built-in email-verification link does not use it.

---

# 3. Decision Summary

Lumora will use Better Auth 1.6.23's supported signed-link email-verification
primitive.

Lumora will:

- adopt Better Auth's existing non-merging email canonicalization,
- send verification on new email/password registration,
- allow unverified sessions and existing private features,
- require authenticated explicit confirmation through a Lumora POST facade,
- require the authenticated canonical email to match the signed token subject
  before Better Auth may mutate verification state,
- block Better Auth's raw verification and public resend routes from external
  access,
- require verified email only for separately approved security-sensitive
  actions, beginning with Family invitation acceptance,
- keep automatic sign-in after verification disabled,
- expose trusted `emailVerified` through Lumora's neutral principal,
- use a replaceable verification-email delivery port,
- and require a real delivery adapter before production startup.

The token is semantically single-use: only the first valid consumption may
transition `emailVerified` from false to true. Replay cannot create a session,
change identity, or create additional authorization.

No custom verification-token table, custom JWT implementation, email OTP, or
second authentication system is approved.

The authenticated facade uses maintained JOSE verification inside
`@lumora/auth` only to validate and compare Better Auth's signed token subject
before calling Better Auth's supported verification operation. This contained
adapter is required because the installed raw verification route does not bind
consumption to the authenticated User.

---

# 4. Meaning of Verified Email

For Lumora, `emailVerified = true` means:

- Lumora issued a time-limited verification link for one canonical account
  email,
- a party able to receive content at that delivery destination possessed and
  submitted the valid signed token,
- that party explicitly confirmed while authenticated as the User holding the
  same canonical account email,
- Better Auth validated the token and exact canonical email binding,
- and trusted server-side persistence recorded the assurance for that User.

Verified email is an authentication assurance only.

It does not prove:

- legal identity,
- a person's name,
- age,
- parenthood,
- guardianship,
- caregiving,
- custody,
- biological relationship,
- Family relationship,
- medical authority,
- ownership of another person,
- or permission to access a Family.

Family authorization remains based exclusively on persisted FamilyMembership
and the approved Family role policy.

---

# 5. Canonical Email Contract

Lumora adopts the installed Better Auth 1.6.23 email contract to avoid merging
addresses that the current authentication system treats as distinct.

The exact canonicalization algorithm is:

1. require a string,
2. require the original input to pass the installed Better Auth/Zod practical
   email syntax validation,
3. lowercase the complete address with JavaScript's locale-independent
   `String.prototype.toLowerCase()`,
4. return that lowercase value,
5. and perform no other transformation.

The following rules are binding:

- leading or trailing whitespace is rejected, not trimmed,
- internal whitespace is rejected by email syntax validation,
- raw Unicode local parts are not supported,
- raw internationalized domain names are not converted,
- an ASCII IDNA A-label is accepted only if it independently passes the
  installed email validator,
- Unicode NFC or NFKC normalization is not applied,
- local-part case is lowercased because that is current Better Auth behavior,
- domain case is lowercased,
- Gmail dot removal is prohibited,
- plus-address removal is prohibited,
- provider-specific alias merging is prohibited,
- comments, display-name forms, and multiple-address input are prohibited,
- and no mailbox-equivalence inference is permitted.

The canonicalizer owns syntax validation and lowercasing as one operation. A
caller must not lowercase an input that has not first passed the same syntax
validation.

This contract is shared by:

- account registration,
- sign-in lookup,
- verification token issuance,
- verification token consumption,
- persisted `User.email`,
- the neutral principal,
- Family invitation targeting,
- and invitation acceptance comparison.

`@lumora/auth` owns the canonicalizer implementation. `apps/api` may adapt it to
the infrastructure-neutral email-identity port owned by `@lumora/family`.
`@lumora/family` must not import Better Auth types or internal code.

---

# 6. Existing Account Compatibility

No automatic email rewrite is approved.

Before verified-email implementation is deployed, a read-only preflight must
confirm that every existing User:

- has an email accepted by the approved canonicalizer,
- has `email === canonicalize(email)`,
- and does not collide with another User after canonicalization.

Rows created through the current Better Auth path are expected to satisfy these
rules because the same validator and lowercasing behavior are already active.

If preflight finds any nonconforming or colliding row:

- deployment stops,
- no record is silently rewritten,
- no two Users are merged,
- and a separate data-remediation decision is required.

The current PostgreSQL exact unique index remains valid because all approved
email writes use the canonical lowercase form. Direct User email writes outside
the authentication boundary remain prohibited.

---

# 7. Verification Delivery Boundary

Better Auth remains the verification issuer.

`@lumora/auth` will compose Better Auth's `sendVerificationEmail` callback with a
provider-neutral `VerificationEmailDeliveryPort`.

The port accepts only:

- recipient canonical email,
- the fixed Lumora confirmation URL with token in its fragment,
- token expiry,
- and a message-template identifier or equivalent non-sensitive template input.

The port must not receive:

- Family identifiers,
- invitation identifiers or secrets,
- roles,
- Pregnancy data,
- Child data,
- Timeline content,
- Health data,
- Media,
- session tokens,
- passwords,
- or arbitrary application-domain message content.

The message contains only:

- a statement that email verification was requested for Lumora,
- the verification link,
- the expiry,
- and neutral guidance to ignore an unrequested message.

It must not claim that an account, Family, invitation, relationship, or
membership exists.

---

# 8. Delivery Environments and Provider Status

No commercial email provider is selected by this decision.

Production provider selection is a deployment decision, not an architecture or
implementation blocker, because the delivery port is replaceable.

Environment rules are:

- production startup must fail when no production-capable delivery adapter is
  configured,
- production startup must fail when no trusted HTTPS confirmation-page URL is
  configured,
- production must reject development, test, console, file, and in-memory
  adapters,
- test may use an injected in-memory capture adapter,
- development may use an explicitly selected local capture adapter,
- local capture must not print recipient emails or tokens to ordinary logs,
- no development fallback may activate implicitly,
- and environment validation must make the selected delivery mode explicit.

A future production adapter must use organization-owned credentials, environment
or secret-manager configuration, least privilege, rotation, and documented
continuity ownership.

Choosing SMTP, SES, Postmark, Resend, SendGrid, or another provider remains
deferred. No provider SDK belongs in the architecture until deployment selects
one.

---

# 9. Delivery Failure Behavior

Verification issuance and resend responses must not reveal whether delivery was
attempted or whether an account exists.

Resend is authenticated and has no caller-supplied email, so it performs no
public account lookup. Its accepted response remains the same whether the
caller's email is already verified, delivery succeeds, or delivery fails.

The delivery callback records only aggregate operational failure. It does not
expose provider detail to registration or resend responses.

This minimum architecture does not introduce a queue or retry worker.

Consequences:

- a transient provider failure may require the User to request resend later,
- aggregate monitoring must alert operators without recipient or token data,
- and a known global delivery outage may produce one generic service-unavailable
  response for all authenticated resend requests.

No response may vary according to target account existence, verification state,
or provider treatment of one recipient.

---

# 10. Verification Token Primitive

Lumora uses Better Auth's supported `createEmailVerificationToken` and
`verifyEmail` behavior.

The token:

- is a signed HS256 JWT,
- is a bearer credential,
- is application-opaque and must never be decoded or interpreted by clients,
- is not confidential because its payload is signed rather than encrypted,
- contains only the canonical email and Better Auth-required temporal claims,
- contains no Family or invitation data,
- and expires 15 minutes after issuance.

Cryptographic strength derives from the Better Auth production secret.

The production secret must:

- be generated from at least 256 bits of cryptographically secure randomness,
- remain environment-managed,
- never be committed,
- never use a placeholder,
- and never enter logs or telemetry.

The existing minimum-length validation alone is not proof of entropy. Future
implementation documentation must require CSPRNG-generated production material.

Better Auth performs authoritative signature comparison through its maintained
JOSE implementation. The authenticated facade performs the minimum duplicate
verification required to bind the signed subject to the principal, using
maintained JOSE primitives and the same fixed algorithm and secret. Lumora must
not implement cryptographic comparison itself or treat facade validation as the
authoritative state mutation.

---

# 11. Token Persistence and Single-Use Semantics

Built-in email-verification tokens are stateless and are not persisted.

Therefore:

- there is no raw-token persistence,
- there is no digest persistence,
- the existing `Verification` table is not used,
- and no verification-token schema migration is required.

Digest-only persistence is not compatible with the selected built-in primitive.
Adding a parallel database token would duplicate Better Auth verification
behavior and is not justified for this minimum assurance.

Single-use is defined as one state transition:

- the first valid token for an unverified canonical email may set
  `emailVerified = true`,
- later replay returns idempotent success,
- replay does not create a session,
- replay does not change email,
- replay does not create Family access,
- and replay does not change any authorization.

This semantic single-use behavior is sufficient because verification is a
monotonic boolean assurance and `autoSignInAfterVerification` is disabled.

---

# 12. Issuance, Coexistence, and Invalidation

Registration issues one verification link when the new User remains unverified.

Resend may issue another link.

Multiple unexpired links for the same canonical email may coexist because the
supported Better Auth primitive is stateless.

Rules:

- every link has its own 15-minute expiry,
- consuming any valid link verifies the User,
- all remaining links become harmless idempotent replays,
- no issuance extends another token's expiry,
- no token can verify a different canonical email,
- and no resend response reveals whether a link was generated.

No token-revocation list is approved.

Global invalidation occurs through Better Auth secret rotation, which also has
broader authentication effects and must follow an operational rotation plan.
Secret rotation is not a normal resend mechanism.

---

# 13. Token Transport and URL Leakage Safeguards

Verification links must use HTTPS in production.

The delivery callback receives Better Auth's token and constructs one fixed
trusted client confirmation URL:

`https://<trusted-client>/verify-email#token=<token>`

The fragment is not transmitted in the HTTP request, access logs, or referrer.
The confirmation page:

- requires an authenticated Lumora session,
- keeps the token only in memory,
- never writes it to local storage, session storage, cookies, history state, or
  analytics,
- requires an explicit User confirmation action,
- submits the token in a POST body,
- clears the fragment immediately,
- and displays only neutral success or failure.

The application endpoint is:

`POST /auth/email-verification/confirm`

It accepts exactly:

```json
{
  "token": "..."
}
```

It requires an authenticated principal. Unknown fields, missing token, and
malformed JSON are rejected before token processing. The existing API request
body limit remains the outer size boundary.

The email link must not include:

- caller-supplied callback URLs,
- Family identifiers,
- invitation secrets,
- account IDs,
- analytics parameters,
- marketing parameters,
- or third-party redirect destinations.

The confirmation page and endpoint must:

- avoid a callback redirect,
- use `Cache-Control: no-store`,
- use `Referrer-Policy: no-referrer`,
- avoid third-party resources,
- and present only neutral success or failure.

Infrastructure requirements:

- reverse-proxy and application access logs must not record confirmation request
  bodies,
- error reporting must redact the token,
- tracing must not record the fragment or POST body,
- browser analytics must not run on the verification response,
- and support tooling must never request the link from a User.

The API must externally block:

- `GET /api/auth/verify-email`,
- `POST /api/auth/send-verification-email`.

Those raw Better Auth routes remain available only as programmatic operations
inside the authentication boundary.

The authenticated confirmation adapter:

1. validates the JWT with maintained JOSE primitives, the Better Auth secret,
   and the exact HS256 algorithm,
2. enforces expiry and strict signed-payload shape,
3. canonicalizes the signed email,
4. compares it with the trusted authenticated principal's canonical email,
5. rejects mismatch before any state mutation,
6. calls Better Auth's supported `verifyEmail` operation with the same token,
7. and lets Better Auth perform its own validation and persisted state update.

The adapter performs no token issuance, persistence, or custom cryptography.
Double validation is deliberate: the first pass enforces Lumora's authenticated
subject binding, while Better Auth remains authoritative for verification state
mutation.

This facade is required because the raw Better Auth GET route:

- mutates state without authentication,
- accepts a callback URL,
- and can be followed automatically by email-security link scanners.

The fragment, explicit confirmation, authenticated email match, and POST
mutation prevent a scanner from verifying a pre-registered account merely by
opening the email link.

---

# 14. Verification Consumption Responses

The Lumora confirmation endpoint returns:

- HTTP 401 for a missing or invalid authenticated session,
- HTTP 400 `INVALID_EMAIL_VERIFICATION_REQUEST` for malformed request shape,
- HTTP 400 `EMAIL_VERIFICATION_INVALID` for every unavailable token outcome,
- HTTP 200 for successful verification,
- and HTTP 200 for a valid matching replay after the principal is already
  verified.

`EMAIL_VERIFICATION_INVALID` covers:

- invalid signature,
- expired token,
- malformed signed payload,
- unsupported algorithm,
- target-email mismatch,
- missing signed User,
- changed account email,
- and any Better Auth verification rejection after facade validation.

Its message is always:

```text
This email verification link is invalid or expired.
```

Failure responses must not echo:

- token,
- email,
- User ID,
- verification status,
- account existence,
- or internal token claims.

The body contains no client-supplied email. The authenticated principal and
signed canonical email are the two independently derived targets, and they must
match. A token issued before an email change cannot verify the new email.

---

# 15. Registration Behavior

The implementation configures:

- `emailVerification.sendVerificationEmail`,
- `emailVerification.sendOnSignUp = true`,
- `emailVerification.sendOnSignIn = false`,
- `emailVerification.autoSignInAfterVerification = false`,
- `emailVerification.expiresIn = 900`,
- and `emailAndPassword.requireEmailVerification = false`.

Registration behavior is:

1. Better Auth validates and canonicalizes the email,
2. Better Auth creates the User with `emailVerified = false`,
3. Better Auth issues the verification token,
4. the delivery port submits the neutral message,
5. Better Auth creates the normal unverified session,
6. and the registration response remains independent of verification delivery
   detail.

The verification token is never returned in the registration response.

---

# 16. Unverified Sign-In and Feature Access

Unverified Users may:

- sign in,
- maintain server-managed sessions,
- create and access Families through valid membership,
- use the currently approved Pregnancy operations,
- use the currently approved Child operations,
- use the currently approved Timeline operations,
- create a Family invitation when their persisted Family role is OWNER,
- view their own verification state through `GET /auth/me`,
- and request verification resend.

Unverified Users may not:

- accept a Family invitation,
- claim verified-email assurance,
- or use a future operation that separately requires verified email.

Email verification is not a global authorization gate.

This least-privilege policy avoids retroactively locking existing Users out of
their private data while requiring stronger assurance at the point where a new
Family privacy boundary would be entered.

---

# 17. Resend Behavior

The application endpoint is:

`POST /auth/email-verification/request`

It requires an authenticated principal and accepts either no body or exactly an
empty JSON object:

```json
{}
```

Email, callback URL, User ID, and unknown fields are rejected.

The endpoint derives the target solely from the trusted principal and invokes
Better Auth's programmatic issuance operation inside the authentication
boundary.

The response is always HTTP 202:

```json
{
  "status": "accepted"
}
```

It remains identical when:

- the account is already verified,
- an unverified account receives a new link,
- or recipient-specific delivery fails.

An unauthenticated request returns HTTP 401 before any email lookup. Because the
request contains no email, the endpoint cannot enumerate arbitrary accounts.

Repeated resend does not alter `emailVerified`, revoke sessions, or extend
previous tokens.

No automatic resend occurs during sign-in.

---

# 18. Existing and Already Verified Users

Existing Users remain unchanged at deployment:

- `emailVerified = false` remains false,
- existing sessions remain valid,
- existing Family access remains valid,
- no bulk verification email is sent,
- and verification is required only before a gated action.

An existing User may request a verification link through resend.

Already verified Users:

- remain verified,
- are not sent another link by authenticated self-resend,
- receive the same accepted resend response,
- and may continue using existing sessions.

No migration marks existing Users verified based on account age, password
possession, Family ownership, email string, prior sign-in, or operator judgment.

## Unverified email squatting boundary

An attacker may register an email they do not control and temporarily reserve
the unique account email. The approved flow does not let that attacker verify
the account because confirmation requires both:

- an authenticated session for that exact account,
- and possession of the token delivered to the account email.

The mailbox owner alone also cannot verify or take over the attacker's account
without its credentials. This prevents unauthorized verification but leaves a
denial-of-registration and recovery problem.

Automatic unverified-account expiry, account recovery, ownership disputes, and
support-assisted reassignment remain deferred. Operators must never set
`emailVerified = true` manually to resolve a dispute.

This availability risk does not block the minimum verification implementation,
but public launch is blocked until unverified reservation and account-recovery
policy are separately approved.

---

# 19. Email Change Behavior

Email change remains disabled and excluded from the next implementation sprint.

No direct database or generic profile update may change `User.email`.

Any future email-change implementation must be separately reviewed and must:

- canonicalize and uniqueness-check the new email,
- keep the old verified email authoritative until the new destination is
  verified,
- prove control of the new destination,
- update email and verified assurance atomically,
- prevent an old verification token from verifying the new email,
- refresh or revoke all affected sessions,
- preserve non-enumeration for duplicate target emails,
- and define recovery if the old destination is unavailable.

An email change must never copy `emailVerified = true` to an unverified new
address.

---

# 20. Session and Stale-State Behavior

Verification is written to `User.emailVerified`.

The neutral principal is resolved from Better Auth's trusted server-side session
and User state on every guarded request.

Because Lumora does not enable Better Auth cookie-cached User state:

- an existing session sees `emailVerified = true` on its next request after
  successful verification,
- no new session is required,
- no verification token creates a session,
- and a session belonging to another User is not upgraded or changed.

The principal captured at the beginning of one request remains immutable for
that request. Verification completed concurrently becomes visible on the next
request.

Future cookie or secondary session caching may not be enabled until it defines
verification and email-change invalidation. Security-sensitive gates must never
trust stale client-side claims.

---

# 21. Neutral Authenticated Principal

The application-facing principal is exactly:

```ts
type AuthenticatedPrincipal = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
};
```

Semantics:

- `id` is the stable authenticated Lumora User identifier,
- `email` is the persisted canonical email,
- `emailVerified` is trusted server-side assurance for that exact email,
- and `name` remains the current minimum self-display field.

The principal:

- is owned by `apps/api`,
- is mapped from Better Auth server output,
- is not a Better Auth type,
- contains no session token,
- contains no Family identifiers,
- contains no Family roles,
- contains no permissions,
- and contains no Family-domain data.

`GET /auth/me` may return these four self-identity fields to the authenticated
User.

Client-provided email, User ID, or verification flags are never trusted.

---

# 22. Invitation Acceptance Gate

Sprint 2.8B trusts the neutral principal after this architecture is
implemented and PostgreSQL-verified.

Invitation acceptance requires all of:

- authenticated principal,
- `principal.emailVerified === true`,
- `principal.email` equal to the persisted invitation
  `targetEmailNormalized`,
- valid opaque Family invitation secret,
- unexpired and available invitation,
- and the atomic Family transaction approved in
  `docs/17-family-roles-and-membership-entry-architecture-decision.md`.

Evaluation order remains:

1. authentication,
2. target-independent invitation body validation,
3. principal verified-email gate,
4. invitation lookup and same-User replay,
5. invitation email binding, expiry, Family scope, and consumption.

An unverified principal receives `VERIFIED_EMAIL_REQUIRED` before invitation
lookup.

Unknown, mismatched, invalid, expired, consumed-by-another-User, or unavailable
invitations retain the identical `INVITATION_NOT_FOUND` response.

The Family application receives only the neutral principal and its own
invitation input. It does not call Better Auth or inspect verification tokens.

---

# 23. Privacy and Non-Enumeration

Verification issuance must not disclose:

- whether an email is registered,
- whether an account is verified,
- whether delivery occurred,
- whether a Family exists,
- whether an invitation exists,
- or whether the target has Family access.

Unauthenticated callers cannot query current verification status.

Verification messages contain no:

- Family data,
- membership data,
- role,
- invitation information,
- Pregnancy data,
- Child data,
- Timeline content,
- Health data,
- or Media.

Routine logs, traces, analytics, sessions, and error reports must exclude:

- email addresses,
- verification tokens,
- verification URLs,
- issuance request bodies,
- delivery payloads,
- provider response bodies,
- and Family invitation data.

Permitted audit and operational metadata is limited to:

- aggregate issuance count,
- aggregate delivery success/failure count,
- aggregate verification success/failure count,
- coarse route and status category,
- and non-sensitive timestamps.

No recipient, token, User, Family, invitation, session, IP-address retention, or
message payload is approved as an application audit record here.

---

# 24. Error Precedence

## Issuance and resend

The server evaluates:

1. authentication,
2. strict empty-body validation,
3. rate limit,
4. production delivery configuration availability,
5. principal's current server-side verification state,
6. internal Better Auth issuance when needed,
7. one accepted response.

Invalid body shape may return a generic HTTP 400 because it does not reveal
account state.

The response body does not vary by current verification state or recipient
delivery result. Registration-triggered issuance remains part of the separately
validated sign-up operation and accepts no independent target lookup.

## Verification consumption

The server evaluates:

1. authentication,
2. strict body validation,
3. facade cryptographic signature, algorithm, and expiry validation,
4. strict signed-payload and canonical email validation,
5. exact equality with the trusted principal email,
6. Better Auth verification,
7. false-to-true update or same-principal idempotent replay.

Every unavailable outcome after request-shape validation maps to the same
`EMAIL_VERIFICATION_INVALID` response.

## Invitation acceptance

Invitation error precedence remains defined by the Family roles and membership
entry ADR. Verification failure occurs before invitation lookup and cannot
reveal invitation state.

---

# 25. Abuse and Rate-Limit Boundary

Production Better Auth rate limiting must remain enabled, and the API must apply
the approved limits to its authenticated verification facade.

Minimum limits are:

- authenticated resend: at most 3 requests per 60 seconds per User and per IP,
- authenticated confirmation: at most 10 requests per 60 seconds per User and
  per IP,
- and existing sign-up/sign-in limits remain in force.

Development and test may use deterministic isolated limit configuration but may
not silently define production behavior.

Rate-limit responses must:

- avoid email or account state,
- avoid confirming whether delivery occurred,
- and never echo request bodies.

Provider-level abuse controls may supplement but must not replace application
limits.

Per-account and distributed rate limiting, CAPTCHA, advanced bot mitigation, and
public-launch abuse operations remain future review items. Public launch is
blocked until rate-limit storage and deployment topology are reviewed.

---

# 26. Persistence and Migration Decision

The existing schema supports this decision:

- `User.email` stores canonical email,
- `User.emailVerified` stores current assurance,
- User email uniqueness already exists,
- Session joins to User state,
- and Better Auth manages verification.

No Prisma schema change or migration is required.

The existing `Verification` model is not authoritative for email verification.
It remains available for Better Auth workflows that use it, but no
email-verification row is expected.

`User.emailVerified` is the sole persisted authority.

No verification timestamp is approved because:

- Better Auth's supported minimum state is boolean,
- invitation acceptance needs current assurance rather than historical proof
  time,
- and adding a timestamp would require custom lifecycle synchronization.

Future policy that needs verification age must be separately approved.

---

# 27. Deployment and Rollback

Deployment is forward-only in behavior but schema-neutral.

Required order:

1. preflight existing canonical emails,
2. configure and verify the environment-specific delivery adapter,
3. configure Better Auth verification behavior,
4. expose the neutral principal assurance,
5. deploy API safeguards and rate limits,
6. verify with disposable PostgreSQL and the environment-isolated delivery
   adapter,
7. then enable security-sensitive consumers.

Production must not deploy steps 3 through 7 without a real delivery adapter.

Rollback may disable issuance and gated consumers, but must not reset
`emailVerified` from true to false. A successfully established assurance remains
valid for the unchanged canonical email.

Secret rotation invalidates outstanding links and sessions according to Better
Auth behavior and requires a separate operational plan.

---

# 28. Ownership Boundaries

## Better Auth

Better Auth owns:

- token creation and authoritative validation,
- internal verification operation behavior,
- persisted verification-state update,
- and session/User resolution.

## `@lumora/auth`

The auth package owns:

- Better Auth configuration,
- canonical email implementation,
- provider-neutral delivery port,
- verification message composition,
- delivery environment validation,
- maintained-JOSE signed-subject validation adapter,
- programmatic Better Auth issuance and verification composition,
- and auth-specific tests.

## `apps/api`

The API owns:

- middleware composition,
- external blocking of the raw Better Auth verification and resend routes,
- authenticated resend and confirmation endpoints,
- neutral principal mapping,
- response headers and redaction,
- route-level rate-limit configuration,
- and application-facing auth responses.

## `@lumora/database`

The database package remains sole owner of:

- Prisma Client,
- User, Session, Account, and Verification persistence,
- and migration verification.

No schema change is approved.

## `@lumora/family`

The Family package owns:

- the neutral email-identity port it consumes,
- invitation target persistence and comparison,
- and invitation authorization and atomicity.

It must not import Better Auth, decode verification tokens, send verification
email, or set `emailVerified`.

---

# 29. Required Future Tests

The implementation sprint must test:

- installed Better Auth version remains `1.6.23`,
- canonicalization of mixed-case valid addresses,
- rejection rather than trimming of surrounding whitespace,
- rejection of raw Unicode local parts and domains,
- permitted ASCII syntax,
- no NFC or compatibility normalization,
- no Gmail dot or plus transformation,
- duplicate prevention across case variants,
- canonical preflight behavior,
- registration persists `emailVerified = false`,
- registration creates an unverified session,
- registration issues verification,
- provider-neutral delivery composition,
- fixed message content without domain data,
- 15-minute token expiry,
- successful false-to-true verification,
- invalid signature,
- malformed token,
- expired token,
- deleted or changed-email target,
- idempotent replay,
- concurrent link consumption,
- concurrent valid links,
- no token-created session,
- same-session next-request refresh,
- different-session isolation,
- verification while another User's session is active is rejected before any
  User is verified,
- unauthenticated confirmation is rejected before token processing,
- exact authenticated-principal and signed-email matching,
- explicit POST confirmation required,
- email-security scanner GET requests cannot mutate verification state,
- raw Better Auth verification and resend routes are externally unavailable,
- tampering with the signed target email produces invalid-token behavior,
- unverified sign-in,
- unverified access to existing private features,
- unverified invitation-acceptance rejection,
- verified matching invitation acceptance,
- verified mismatched invitation rejection,
- resend has no caller-supplied target email,
- already-verified resend returns the same accepted response,
- unauthenticated callers cannot probe arbitrary account verification,
- resend behavior,
- no automatic resend on sign-in,
- delivery failure non-enumeration,
- production startup failure without real transport,
- production rejection of development/test adapters,
- deterministic test capture,
- rate limits,
- HTTPS production requirement,
- no caller-controlled verification redirect,
- fragment token never reaches the confirmation-page request,
- no token, fragment, email, or body leakage in logs and errors,
- `Cache-Control: no-store`,
- `Referrer-Policy: no-referrer`,
- principal exact shape and trusted mapping,
- no Family roles or permissions in sessions or principal,
- no schema migration,
- and regression of current authentication and Family-contained operations.

Disposable PostgreSQL verification must:

- apply committed migrations unchanged,
- register an unverified User,
- capture a verification message through the test adapter,
- consume the real Better Auth token,
- observe `User.emailVerified = true`,
- observe the refreshed neutral principal,
- verify replay safety,
- exercise the invitation gate contract without implementing invitations,
- and remove all test infrastructure and captured secrets.

Captured test tokens must remain process-local and must not be written to
committed fixtures, snapshots, terminal logs, or persistent files.

---

# 30. Implementation Scope — Sprint 2.8A.2

Sprint 2.8A.2 may implement only:

- the canonical email helper and parity tests,
- provider-neutral verification-delivery port,
- explicit test and development capture adapters,
- production transport fail-closed validation,
- trusted HTTPS confirmation-page URL validation,
- Better Auth email-verification configuration,
- fixed neutral verification message,
- verification URL safeguards,
- maintained-JOSE signed-subject adapter,
- authenticated resend and explicit confirmation endpoints,
- external blocking of raw Better Auth verification and resend routes,
- verification rate-limit configuration,
- neutral principal `emailVerified` field,
- `GET /auth/me` self-assurance response,
- targeted unit, architecture, and PostgreSQL integration tests,
- and truthful implementation documentation.

It must not implement:

- a production commercial provider,
- Family roles or invitations,
- password reset,
- email change,
- custom verification tokens,
- schema changes,
- or any item in section 31.

Sprint 2.8A.2 is architecturally unblocked.

Sprint 2.8B is unblocked by the implemented, PostgreSQL-verified, documented,
and committed Sprint 2.8A.2 prerequisite.

---

# 31. Explicit Exclusions and Deferred Decisions

This decision does not implement or approve:

- code changes during Sprint 2.8A.1,
- dependency changes during Sprint 2.8A.1,
- environment changes during Sprint 2.8A.1,
- schema or migration changes,
- a custom token store,
- digest persistence for built-in verification JWTs,
- email OTP,
- magic-link authentication,
- token-based automatic sign-in,
- global verified-email authorization,
- forced verification of existing Users,
- bulk verification email,
- account merging,
- provider-specific email alias normalization,
- Unicode email support,
- named production email provider,
- provider SDK,
- delivery queue or retry worker,
- password reset,
- email change implementation,
- MFA,
- phone verification,
- social-login verification assumptions,
- legal identity proof,
- age proof,
- guardianship or relationship proof,
- Family roles in sessions,
- Family roles or invitations,
- notification infrastructure,
- audit-log persistence,
- public-launch abuse operations,
- and unrelated authentication redesign.

Password reset may reuse the delivery port only after its own separately approved
security flow. It is not part of verified-email implementation.

---

# 32. Security Invariants

The following are non-negotiable:

- one authentication system,
- one Prisma Client owner,
- one canonical email contract,
- verified assurance bound to one exact canonical email,
- authenticated explicit confirmation before verification state mutation,
- exact principal-email and signed-token-email equality,
- no externally accessible state-changing Better Auth verification GET,
- verification state from trusted server-side persistence,
- no client-supplied assurance,
- no Family authorization in authentication,
- no Family roles in sessions,
- no domain data in verification messages,
- no token-based automatic sign-in,
- no custom verification cryptography,
- no token or email logging,
- no production startup without real delivery,
- and no Family invitation acceptance without verified canonical email equality.

---

# 33. Sprint 2.8A.1 Completion Gate

Sprint 2.8A.1 is complete when:

- this ADR is approved and committed,
- the reading order includes it,
- Authentication and technology-stack deferrals are narrowed,
- the Family invitation canonicalization and blocker text are aligned,
- targeted documentation formatting passes,
- `git diff --check` passes,
- only documentation changed,
- and the working tree is clean.

---

# 34. Future Review Triggers

Review this decision when:

- Better Auth changes email-verification token behavior,
- Better Auth is upgraded,
- email change is implemented,
- cookie-cached User state is proposed,
- Unicode or internationalized email support is proposed,
- password reset delivery is implemented,
- a production provider is selected,
- distributed rate limiting is required,
- public launch approaches,
- verification age becomes relevant,
- account recovery is designed,
- or regulatory and privacy obligations change.

---

# 35. References

- `docs/START-HERE.md`
- `docs/02-product-principles.md`
- `docs/06-security-and-medical-safety.md`
- `docs/09-repository-layout.md`
- `docs/10-technology-stack.md`
- `docs/11-founder-independence-and-long-term-continuity.md`
- `docs/12-authentication-architecture-decision.md`
- `docs/13-family-domain-architecture-decision.md`
- `docs/17-family-roles-and-membership-entry-architecture-decision.md`
- `docs/99-deferred-decisions.md`
- `packages/auth/package.json`
- `packages/auth/src/create-auth.ts`
- `packages/auth/src/auth-config.ts`
- `apps/api/src/auth/auth.runtime.ts`
- `apps/api/src/auth/auth.guard.ts`
- `apps/api/src/auth/auth.types.ts`
- `packages/database/prisma/schema.prisma`

---

# 36. Sprint 2.8A.2 Implementation Record

Sprint 2.8A.2 implements:

- Better Auth 1.6.23 issuance and authoritative verification,
- 15-minute HS256 verification tokens with authenticated JOSE subject binding,
- canonical email validation and the read-only existing-email preflight,
- provider-neutral delivery with explicit development/test capture,
  loopback-and-secret-protected test inspection, and production fail-closed
  behavior,
- fragment-only confirmation links,
- authenticated request and explicit POST confirmation facades,
- external blocking of Better Auth's raw verification and public resend routes,
- per-User and per-IP facade rate limits,
- and the exact four-field neutral principal.

`pnpm test:auth:postgres` verifies the real false-to-true
`User.emailVerified` transition, fresh principal state, replay safety,
wrong-session rejection, raw-route blocking, unchanged migrations, and all
existing Family, Pregnancy, Child, and Timeline PostgreSQL runtime suites.

No Prisma schema or migration changed. No production delivery provider, Family
role, or Family invitation was implemented.
