# Lumora MVP Scope

## 1. MVP Goal

Deliver a small, usable, private product that allows a mother to organize the essential story of a pregnancy or child within a family context. The MVP validates the recovered product direction without expanding beyond documented domains.

## 2. Included Features

- User registration and authentication
- Create and manage a family
- Create a pregnancy profile
- Create a child profile
- Record timeline events
- View timeline chronologically
- Basic family member roles
- Privacy-aware access control
- Medical safety and AI disclaimers (canonical meaning in
  `docs/19-mvp-medical-safety-and-ai-disclaimer-architecture-decision.md`;
  presented on the authenticated mobile shell per
  `docs/20-minimum-authenticated-mobile-shell-architecture-decision.md`)
- Minimum mobile Family list/create/detail experience implemented in
  `apps/mobile` per
  `docs/21-minimum-mobile-family-experience-architecture-decision.md`
  (Sprint 2.10B)
- Minimum mobile Pregnancy list/create/detail experience implemented in
  `apps/mobile` per
  `docs/22-minimum-mobile-pregnancy-experience-architecture-decision.md`
  (Sprint 2.11B)
- Minimum mobile Child list/create/detail/displayName-edit experience
  implemented in `apps/mobile` per
  `docs/23-minimum-mobile-child-experience-architecture-decision.md`
  (Sprint 2.12B)

## 3. Excluded Features

- AI-generated medical advice, diagnosis, or treatment guidance
- Advanced health experiences
- Rich media management
- Complex family collaboration and role customization
- Non-essential personalization, automation, analytics, or social capabilities
- Any capability not established in the recovery documentation

## 4. MVP Success Criteria

- A mother can begin using Lumora without unnecessary complexity.
- A pregnancy or child can be represented clearly within a family context.
- Meaningful entries can be recorded and viewed chronologically.
- Private information is visible only within its intended family boundary.
- The product communicates its medical and AI limitations clearly through the
  approved disclosure surfaces in
  `docs/19-mvp-medical-safety-and-ai-disclaimer-architecture-decision.md`.
- The MVP is coherent, usable, and limited to its documented scope.

## 5. Future Phases (Phase 2, Phase 3)

### Phase 2

- Expand family participation and permission controls.
- Introduce carefully scoped media and health experiences.
- Improve continuity between pregnancy and child stages.

### Phase 3

- Evaluate assistant-based experiences under the principle that AI is not a doctor.
- Expand the family-centered ecosystem only through documented and validated needs.
- Consider additional capabilities after privacy, safety, and user value are demonstrated.
