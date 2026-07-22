export {
  parseTrustedOrigins,
  validateAuthRuntimeConfig,
  type AuthEmailVerificationDeliveryConfig,
  type AuthRuntimeConfig,
} from "./auth-config.js";
export {
  assertCanonicalUserEmailRows,
  CollidingStoredUserEmailError,
  InvalidStoredUserEmailError,
  NoncanonicalStoredUserEmailError,
  preflightCanonicalUserEmails,
} from "./canonical-email-preflight.js";
export {
  canonicalizeEmail,
  InvalidCanonicalEmailError,
} from "./canonical-email.js";
export {
  buildAuthOptions,
  createAuth,
  type LumoraAuth,
} from "./create-auth.js";
export {
  InMemoryVerificationEmailCaptureAdapter,
  RecipientVerificationEmailDeliveryError,
  VERIFICATION_EMAIL_TEMPLATE_ID,
  type VerificationEmailDeliveryInput,
  type VerificationEmailDeliveryPort,
} from "./verification-delivery.js";
export {
  buildVerificationConfirmationUrl,
  composeVerificationEmailDeliveryInput,
  EMAIL_VERIFICATION_EXPIRES_IN_SECONDS,
} from "./verification-message.js";
export {
  confirmAuthenticatedEmailVerification,
  issueAuthenticatedSelfVerification,
  type EmailVerificationAuthApi,
  type EmailVerificationPrincipal,
} from "./verification-service.js";
export {
  InvalidEmailVerificationTokenError,
  prevalidateEmailVerificationToken,
  type PrevalidatedEmailVerificationToken,
} from "./verification-token.js";
