/**
 * Canonical MVP medical-safety and AI-limitation disclosure (ADR-019).
 * Framework-neutral source of truth for clients. Informational only.
 */

export const LUMORA_MVP_SAFETY_CONTENT_ID =
  "lumora.safety.mvp.medical-ai.v1" as const;

/**
 * Exact English canonical copy from
 * docs/19-mvp-medical-safety-and-ai-disclaimer-architecture-decision.md §5.
 */
export const LUMORA_MVP_SAFETY_CONTENT_EN = `Lumora helps families organize memories and information. It does not provide medical advice, diagnosis, treatment, or emergency services. Information recorded in Lumora is provided by users and may be incomplete or inaccurate. For health-related decisions, consult a qualified healthcare professional. In an emergency, contact your local emergency services.

Lumora currently has no user-facing artificial intelligence features enabled. If AI features are introduced in the future, their outputs may be incorrect and must not replace professional judgment.`;

export type LumoraMvpSafetyContent = {
  readonly id: typeof LUMORA_MVP_SAFETY_CONTENT_ID;
  readonly language: "en";
  readonly text: typeof LUMORA_MVP_SAFETY_CONTENT_EN;
};

export const LUMORA_MVP_SAFETY_CONTENT: LumoraMvpSafetyContent = {
  id: LUMORA_MVP_SAFETY_CONTENT_ID,
  language: "en",
  text: LUMORA_MVP_SAFETY_CONTENT_EN,
};
