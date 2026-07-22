# Security and Medical Safety

This document defines product-level policies for privacy, safety, and trust. It states intent and boundaries only — not implementation, legal advice, or technical design.

The minimum MVP user-facing medical-safety and AI-limitation disclosure —
including canonical English meaning, approved surfaces, non-persistence rules,
and the client presentation gate — is defined in
`docs/19-mvp-medical-safety-and-ai-disclaimer-architecture-decision.md`.

---

## 1. Privacy Principles

- Privacy is a foundational product responsibility, not an optional feature.
- Collect only what is necessary to deliver documented value.
- Make the purpose of any data use understandable to the user.
- Treat family and child information as private by default.
- Give the mother meaningful control over her own experience and data.

## 2. Child Data Protection

- Child-related information receives the highest level of care and caution.
- A child's data exists to serve the child's interests and continuity, not external exploitation.
- Access to child information is limited to appropriate family roles.
- Sensitivity is preserved as the child grows and their needs evolve.
- Avoid unnecessary exposure, sharing, or retention of child information.

## 3. Medical Safety Boundaries

- Health information supports awareness, not diagnosis or treatment.
- Lumora must not create false confidence about medical conditions.
- The product must never discourage users from seeking professional medical care.
- Health-related guidance favors caution and clear limitations.
- Uncertain or high-risk situations should direct users toward qualified professionals.
- For the current MVP, the approved user-facing disclosure states that Lumora
  does not provide medical advice, diagnosis, treatment, or emergency services,
  and that recorded information is user-provided and may be incomplete or
  inaccurate. See
  `docs/19-mvp-medical-safety-and-ai-disclaimer-architecture-decision.md`.

## 4. AI Safety Rules

- AI acts as an assistant, never as a doctor.
- AI must not diagnose, prescribe, or present medical certainty.
- AI communicates its limitations and the boundaries of its role.
- AI defers to qualified healthcare professionals for medical decisions.
- AI behavior must remain consistent with all privacy and safety principles.
- AI must never fabricate medical facts or present uncertain information as established medical knowledge.
- The current MVP has no user-facing AI features enabled. The approved
  disclosure must not imply current AI processing and is not consent for future
  AI training or processing. See
  `docs/19-mvp-medical-safety-and-ai-disclaimer-architecture-decision.md`.

## 5. Data Security

- Sensitive information is protected as a core product commitment.
- Data is safeguarded in a manner proportional to its sensitivity.
- Health and child data warrant stronger protection than general data.
- Security expectations apply throughout the lifecycle of the data.
- Unnecessary data is not retained.

## 6. Access Control

- Access is governed by family roles and documented permissions.
- Visibility is limited to the family boundary that owns the data.
- The most sensitive domains carry the strictest access expectations.
- Access reflects an intentional role, never an implicit assumption.
- The mother retains agency over her experience within these boundaries.

## 7. Compliance Principles

- Lumora aims to respect the intent behind privacy and safety expectations.
- Product decisions favor user protection when trade-offs arise.
- Data practices are documented and reviewable.
- Compliance is treated as an ongoing responsibility, not a one-time step.
- Where obligations are unclear, the product errs toward caution and user trust.
