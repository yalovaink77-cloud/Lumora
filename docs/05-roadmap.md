# Lumora Roadmap

## 1. Recovery Phase

**Goal:** Re-establish a reliable documented understanding of Lumora before any product rebuilding.

**Deliverables:**

- Product vision and principles
- Core domain model
- MVP scope
- High-level roadmap

**Exit Criteria:**

- The documentation defines a coherent product direction.
- Open assumptions and unknowns are explicitly identified.
- Product and architectural decisions have a documented source of truth.

## 2. Foundation Phase

**Goal:** Establish the product foundation required to support the documented domains safely and coherently.

**Deliverables:**

- Confirmed product decisions for the initial user experience
- Defined family, user, child, pregnancy, timeline, media, health, and permission boundaries
- Privacy and medical-safety requirements for the initial scope

**Exit Criteria:**

- Domain boundaries and ownership are understood.
- Privacy, permissions, and medical-safety expectations are documented.
- The MVP scope remains focused and unambiguous.

## 3. MVP Phase

**Goal:** Deliver a usable, private experience for organizing essential pregnancy or child information in a family context.

**Deliverables:**

- The capabilities defined in `04-mvp-scope.md`
- Clear user-facing boundaries for health information and AI, with the minimum
  MVP disclosure meaning approved in
  `docs/19-mvp-medical-safety-and-ai-disclaimer-architecture-decision.md`
- A coherent initial family experience

**Exit Criteria:**

- The MVP success criteria are met.
- Core use is understandable without unnecessary complexity.
- The product stays within its documented MVP boundaries.
- The approved medical-safety and AI-limitation disclosure is presented on the
  two approved authenticated surfaces in `apps/mobile` (Sprint 2.9B.3;
  architecture in
  `docs/20-minimum-authenticated-mobile-shell-architecture-decision.md`).
- The minimum mobile Family list/create/detail experience is implemented in
  `apps/mobile` (Sprint 2.10B) per
  `docs/21-minimum-mobile-family-experience-architecture-decision.md`.
- The minimum mobile Pregnancy list/create/detail experience is implemented in
  `apps/mobile` (Sprint 2.11B) per
  `docs/22-minimum-mobile-pregnancy-experience-architecture-decision.md`.
- The minimum mobile Child list/create/detail/displayName-edit experience is
  implemented in `apps/mobile` (Sprint 2.12B) per
  `docs/23-minimum-mobile-child-experience-architecture-decision.md`.
- The minimum mobile Timeline list/create/detail experience is architecturally
  approved (Sprint 2.13A) in
  `docs/24-minimum-mobile-timeline-experience-architecture-decision.md`, with
  client implementation planned as Sprint 2.13B.

## 4. Beta Phase

**Goal:** Validate real-world usability, trust, privacy, and product value with a limited audience.

**Deliverables:**

- Structured feedback and learning from early users
- Documented product decisions based on validated needs
- Prioritized improvements to the MVP experience

**Exit Criteria:**

- Core user needs and usability issues are understood.
- High-priority privacy and safety concerns are resolved.
- The product has sufficient evidence to prepare for broader release.

## 5. Production Phase

**Goal:** Offer Lumora as a stable, trustworthy product while maintaining its documented principles.

**Deliverables:**

- A production-ready version of the validated MVP
- Operational product documentation
- A documented plan for future phases

**Exit Criteria:**

- The product meets its defined quality, privacy, and safety expectations.
- Ongoing decisions continue to be documented before implementation.
- Future expansion is based on validated user value rather than assumed features.
