# MVP Medical Safety and AI Disclaimer Architecture Decision

Version: 1.0

Status: Approved — Documentation Complete (Presentation Not Implemented)

Phase: MVP Medical Safety Disclosure Foundation

Decision date: 2026-07-22

---

# 1. Purpose

Lumora's MVP requires medical safety and AI disclaimers
(`docs/04-mvp-scope.md`). The product must communicate medical and AI
limitations clearly before the MVP success criteria are met.

This decision defines the minimum user-facing medical-safety and AI-limitation
disclosure for the **current** Lumora product:

- Family, Pregnancy, Child, and Timeline information may be stored,
- Pregnancy, Child, and Timeline content is user-provided,
- no Health domain is implemented,
- no user-facing AI feature is implemented,
- and Lumora must not imply that current data is medically reviewed, clinically
  verified, or interpreted by AI.

Sprint 2.9A is documentation-only. It does not implement UI, API packages,
persistence, schema, migrations, acknowledgment records, analytics, or tests.

---

# 2. Verified Current Behavior

The repository currently verifies and documents that:

- authentication and verified-email ownership are implemented,
- Family create/list/get and OWNER/MEMBER invitation entry are implemented,
- Pregnancy create/list/direct-get are implemented,
- Child create/list/direct-get and approved `displayName` mutation are
  implemented,
- Timeline create/list/direct-get for Pregnancy and Child subjects are
  implemented,
- authorization for Family-contained data uses persisted FamilyMembership and
  the approved OWNER/MEMBER matrix,
- no Health domain package, persistence, or API is implemented,
- no user-facing AI feature, AI interpretation endpoint, or AI product surface
  is implemented,
- `packages/ai` is a reserved layout placeholder without a user-facing product
  capability,
- `apps/api` is a NestJS API composition layer, not a user-facing client,
- `apps/mobile` is the documented primary client but currently contains only
  package scaffolding (`package.json`, `tsconfig.json`) with no screens,
  navigation, or authenticated application experience,
- and `apps/admin` is an empty administrative stub and is not required for MVP.

Therefore, **no current application surface displays a user-facing medical or
AI disclosure**. Backend-only content would not satisfy the MVP user-facing
requirement.

---

# 3. Decision Summary

Lumora adopts one product-owned, English canonical safety disclosure for every
authenticated user.

The disclosure:

- is informational, not contractual acceptance,
- is identical for OWNER and MEMBER,
- does not vary by Family role,
- makes no relationship, guardianship, custody, or legal-authority assumptions,
- must appear during first authenticated application entry before normal
  Family-contained use,
- must remain permanently accessible from a stable “Safety & Limitations”
  location,
- requires no acknowledgment, consent checkbox, or persisted read state,
- requires no database field, table, or migration,
- and does not authorize Health features, AI processing, AI training, or
  unrelated commercial use of Family data.

Canonical meaning is owned by this repository. Presentation is deferred to a
follow-on client implementation sprint after a capable user-facing client
exists.

---

# 4. Audience

The disclosure applies to every authenticated Lumora user.

OWNER and MEMBER receive the same safety disclosure. Role does not change the
content, timing, or accessibility requirements.

The disclosure must not assume or assert:

- mother, father, guardian, caregiver, or relative status,
- custody or legal authority,
- biological relationship,
- or medical decision-making authority for another person.

Unauthenticated public marketing copy is outside this decision. MVP surfaces
approved here are authenticated application surfaces only.

---

# 5. Canonical English Copy

The following English text is the authoritative minimum MVP meaning.

Editorial adjustments in future presentation work are allowed only when they
preserve every required statement and do not strengthen Lumora’s claims:

```text
Lumora helps families organize memories and information. It does not provide
medical advice, diagnosis, treatment, or emergency services. Information
recorded in Lumora is provided by users and may be incomplete or inaccurate.
For health-related decisions, consult a qualified healthcare professional. In
an emergency, contact your local emergency services.

Lumora currently has no user-facing artificial intelligence features enabled.
If AI features are introduced in the future, their outputs may be incorrect and
must not replace professional judgment.
```

Required statements that must never be omitted or softened:

1. Lumora organizes memories and information.
2. Lumora does not provide medical advice.
3. Lumora does not diagnose.
4. Lumora does not provide treatment.
5. Lumora is not an emergency service.
6. Stored information is user-provided.
7. Stored information may be incomplete or inaccurate.
8. Health decisions require a qualified healthcare professional.
9. Emergencies require local emergency services.
10. No user-facing AI feature is currently enabled.
11. Future AI output may be incorrect.
12. AI must not replace professional judgment.

Stable content identifier for clients and future localization:

`lumora.safety.mvp.medical-ai.v1`

---

# 6. Approved Surfaces

Exactly two minimum user-facing surfaces are approved.

## 6.1 First authenticated application entry

- Display the disclosure clearly during the user’s first authenticated entry
  into the application experience.
- The disclosure must be readable before the user proceeds into normal
  Family-contained use.
- It must not be hidden inside Terms of Service or Privacy Policy.
- It must not use preselected consent controls.
- It is informational, not contractual acceptance.

“First authenticated entry” means the first time an authenticated session
enters the primary application experience that can lead to Family-contained
use. Exact visual design is deferred to the client implementation sprint.

## 6.2 Permanently accessible Safety & Limitations surface

- The same current disclosure must remain accessible from a stable user-facing
  “Safety & Limitations” location.
- It must be reachable after onboarding without creating a new Family or
  entering sensitive Family data.
- Exact visual design and navigation implementation are deferred to the
  client/UI implementation sprint.

## 6.3 Explicit surface non-goals

This decision does **not** approve:

- a persistent banner across all current screens,
- embedding the disclosure only inside Terms of Service or Privacy Policy,
- role-specific or Family-specific variants,
- or any surface that requires FamilyMembership lookup to view the disclosure.

---

# 7. Acknowledgment and Persistence

No acknowledgment or acceptance workflow is approved.

Specifically:

- no checkbox, consent, acceptance, signature, or legal agreement is required,
- no “I understand” record is required,
- no read/seen state is persisted,
- no disclaimer-version acceptance history is stored,
- no User, Session, FamilyMembership, Pregnancy, Child, or Timeline field is
  added,
- no database table or migration is required,
- and re-disclosure or version-transition behavior is deferred until a future
  regulated or materially changed feature requires a separate reviewed
  decision.

Ordinary editorial corrections that preserve the required safety meaning do not
create user consent history.

---

# 8. Current Domain Meaning

## Pregnancy

Pregnancy records are user-entered organizational records within a Family. They
are not clinical pregnancy records, medical charts, or professionally verified
clinical documentation.

## Child

Child records are user-entered Family records. They are not legal identity
documents, medical records, or proof of guardianship, custody, or parentage.

## Timeline

Timeline events are unverified user-authored historical statements. They are
not clinically attested events.

## Current field interpretation

Values such as `title`, `displayName`, `occurredAt`, and other currently
approved fields must not be interpreted as medical facts, diagnoses, risk
scores, developmental conclusions, or lifecycle clinical states.

## Current APIs

Current APIs do not diagnose, score risk, recommend treatment, triage
emergencies, or infer development or lifecycle conclusions.

## Privacy obligations

This disclosure does not weaken existing privacy, authorization, Family-boundary,
child-data protection, or continuity obligations.

---

# 9. AI Boundary

- No user-facing AI capability exists in the current MVP.
- The disclosure must not imply that AI is currently processing or interpreting
  Family, Pregnancy, Child, or Timeline data.
- The disclosure is not advance consent for future AI processing.
- The disclosure does not authorize training on Family, Pregnancy, Child, or
  Timeline data.
- Any future AI feature requires a separate architecture, privacy,
  medical-safety, consent, and implementation decision.
- Future contextual AI warnings cannot be satisfied solely by this general
  disclosure.

The reserved `packages/ai` layout location does not create a product claim that
AI is enabled.

---

# 10. Health Boundary

- No Health domain or clinical workflow is approved by this decision.
- The disclosure must not be used to justify adding symptoms, diagnoses,
  treatment plans, clinical scoring, medical recommendations, or emergency
  triage.
- Any future Health feature requires a separate architecture and medical-safety
  decision.
- Future contextual Health warnings cannot be satisfied solely by this general
  disclosure.

---

# 11. Emergency Language

- Use the phrase “local emergency services.”
- Do not infer a country or emergency telephone number.
- Do not claim Lumora monitors emergency conditions.
- Do not add crisis detection, triage, escalation, or notification behavior.
- Do not use browser or location inference to select emergency numbers.

---

# 12. Language and Localization

- Canonical MVP copy is defined in English in section 5.
- The architecture must allow future localization without changing the safety
  meaning.
- Turkish and other translations are not implemented in Sprint 2.9A.
- A translation must not omit or soften any required safety statement.
- Locale detection, fallback rules, translation storage, and
  content-management systems remain deferred.
- Localization implementation is outside Sprint 2.9A and outside the smallest
  follow-on presentation sprint unless separately decided.

---

# 13. Versioning and Ownership

- The disclosure is product-owned safety content, not user data.
- It has one stable content identifier: `lumora.safety.mvp.medical-ai.v1`.
- This repository remains the source of truth for the canonical MVP meaning.
- Changing or weakening the required safety meaning requires an explicit
  reviewed documentation decision.
- Ordinary editorial corrections that preserve meaning do not create user
  consent history and do not require a new content identifier unless the
  product owner chooses to bump the identifier for client cache clarity.
- No database-backed content-management system is required.

---

# 14. Privacy and Security

Accessing the disclosure:

- must not expose Family existence or Family data,
- requires no FamilyMembership lookup,
- must not include Pregnancy, Child, Timeline, email, role, or invitation
  information in the content,
- must not be tracked as a read/seen analytics event under this decision,
- must not place disclosure request/response bodies into sensitive logging,
- must remain accessible without weakening authenticated Family routes,
- and must not become an authentication or authorization source.

Family authorization remains membership-scoped domain authorization. The
disclosure is not a permission claim.

---

# 15. Continuity and Acquisition Safeguards

This decision preserves:

- Founder Independence and Long-Term Continuity
  (`docs/11-founder-independence-and-long-term-continuity.md`),
- controlled shutdown principles,
- acquisition privacy safeguards,
- user ownership and stewardship of Family data,
- and medical-safety / privacy duties that cannot be waived by disclosure text.

Specifically:

- the disclosure cannot waive or reduce Lumora’s privacy and security duties,
- Family data does not become an unrestricted commercial asset because the
  disclosure exists,
- and the disclosure is not consent for unrelated processing, AI training,
  sale, advertising use, or acquisition-driven weakening of privacy or medical
  safety.

---

# 16. Implementation Boundary

## 16.1 Current client reality

The repository does **not** currently contain a user-facing client capable of
satisfying the approved surfaces.

- `apps/mobile` is the approved primary client location
  (`docs/09-repository-layout.md`) but has no authenticated UI.
- `apps/api` cannot truthfully make the disclosure “user-facing.”
- `apps/admin` is out of MVP scope and empty.

Therefore Sprint 2.9A does not claim that the disclaimer is already presented
to users.

## 16.2 Canonical content location for future implementation

When presentation is implemented:

1. This ADR remains the authoritative meaning and required-statement source.
2. The canonical English copy and content identifier
   `lumora.safety.mvp.medical-ai.v1` may be exported from the existing
   framework-neutral `@lumora/shared` package as product-owned constants.
3. No new frontend framework, CMS, or NestJS module is required solely to store
   the copy.
4. No REST endpoint is required for the MVP static disclosure. Clients should
   consume the shared constant (or an equivalent build-time import) rather than
   inventing a Family-scoped or authenticated disclosure API.
5. Presentation ownership belongs to the primary user-facing client
   (`apps/mobile` unless a later reviewed decision designates another primary
   client).
6. The API must not become the sole “user-facing” home of the disclosure.

## 16.3 Verification expectations for the follow-on implementation sprint

The follow-on presentation sprint must verify at least:

- first authenticated entry shows the current disclosure before normal
  Family-contained use,
- the Safety & Limitations surface remains reachable without creating a Family
  or opening Pregnancy, Child, or Timeline data,
- OWNER and MEMBER see the same meaning,
- no acknowledgment persistence exists,
- no FamilyMembership lookup is required to view the disclosure,
- and the presented text preserves every required statement in section 5.

## 16.4 Smallest follow-on implementation sprint

**Sprint 2.9B — Present MVP Medical Safety and AI Disclosure** may implement
only:

- exporting the approved canonical English copy and content identifier from
  `@lumora/shared` (or confirming an equivalent framework-neutral export),
- presenting the two approved surfaces in the primary user-facing client,
- and proportionate presentation tests that prove the surfaces and statement
  preservation without introducing acknowledgment persistence.

Sprint 2.9B must not implement Health, AI features, consent history, Terms of
Service, Privacy Policy, localization systems, CMS, audit logs, or any excluded
item in section 18.

## 16.5 Implementation gate

Sprint 2.9A (this decision) is complete when this document and required
cross-references are committed.

Sprint 2.9B presentation implementation is **blocked** until the repository
contains a primary user-facing authenticated client experience capable of:

1. first authenticated application entry, and
2. a permanently accessible Safety & Limitations location reachable without
   Family creation or sensitive Family-domain navigation.

The single smallest unresolved dependency is:

**a minimal authenticated shell in `apps/mobile` (or another reviewed primary
client) that can host the two approved disclosure surfaces.**

That shell may be introduced by Sprint 2.9B itself if scoped only to the
minimum authenticated navigation needed for the two surfaces, or by an earlier
client foundation sprint. Either path must remain documentation-first and must
not invent Health, AI, or Family-domain expansion.

---

# 17. Relationship to Existing Policy Documents

- `docs/06-security-and-medical-safety.md` remains the product-level policy for
  privacy, medical safety, and AI safety intent.
- This ADR supplies the minimum MVP user-facing disclosure meaning, surfaces,
  non-persistence rules, and implementation gate.
- Domain ADRs for Pregnancy, Child, and Timeline remain authoritative for those
  domains; this ADR clarifies that their current records are user-provided and
  non-clinical for disclosure purposes.
- Authentication and Family ADRs remain authoritative for identity and
  authorization; this disclosure is not an authz source.

---

# 18. Explicit Exclusions and Deferred Decisions

This decision does not implement or approve:

- disclaimer UI in Sprint 2.9A,
- frontend application work in Sprint 2.9A,
- API endpoint for the disclosure,
- shared-package code changes in Sprint 2.9A,
- database persistence,
- disclaimer acknowledgment or consent history,
- analytics or read tracking,
- Terms of Service,
- Privacy Policy,
- Health domain,
- medical advice, diagnosis, or treatment,
- emergency triage, crisis detection, or notifications,
- AI features or AI processing/training consent,
- Media,
- export,
- audit-log system,
- production email delivery,
- Family membership expansion,
- Pregnancy-to-Child linkage,
- pilot/Beta program,
- localization implementation,
- content-management system,
- persistent global banner,
- country-specific emergency numbers,
- and re-disclosure/version-transition workflows.

Deferred until separately reviewed:

- translation storage and locale selection,
- version-transition re-display rules for material safety changes,
- contextual Health or AI warnings for future features,
- and any legal contract surfaces beyond this informational disclosure.

---

# 19. Sprint 2.9A Completion Record

Sprint 2.9A documents:

- the canonical MVP medical-safety and AI-limitation meaning,
- audience and identical OWNER/MEMBER treatment,
- exactly two approved surfaces,
- no-acknowledgment and no-persistence rules,
- Pregnancy, Child, Timeline, Health, and AI boundaries,
- emergency and localization constraints,
- privacy, continuity, and acquisition safeguards,
- verified absence of a capable user-facing client,
- and the blocked follow-on presentation gate for Sprint 2.9B.

No code, schema, migration, package, endpoint, or UI is introduced by this
sprint.

---

# 20. Future Review Triggers

Review this decision when:

- a primary user-facing client becomes capable of authenticated entry,
- Sprint 2.9B presentation begins,
- any user-facing AI feature is proposed,
- any Health feature is proposed,
- emergency, crisis, or triage behavior is proposed,
- localization of the disclosure is proposed,
- material safety meaning changes are proposed,
- legal acceptance or acknowledgment persistence is proposed,
- or continuity, acquisition, privacy, or regulatory obligations change.

---

# 21. References

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
- `docs/17-family-roles-and-membership-entry-architecture-decision.md`
- `docs/18-verified-email-ownership-architecture-decision.md`
- `docs/99-deferred-decisions.md`
