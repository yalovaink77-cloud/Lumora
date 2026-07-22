export const BETTER_AUTH_BASE_PATH = '/api/auth';

export const BLOCKED_BETTER_AUTH_ROUTES = [
  { method: 'GET', path: `${BETTER_AUTH_BASE_PATH}/verify-email` },
  { method: 'POST', path: `${BETTER_AUTH_BASE_PATH}/send-verification-email` },
] as const;

export const invalidEmailVerificationRequestResponse = {
  statusCode: 400,
  code: 'INVALID_EMAIL_VERIFICATION_REQUEST',
  message: 'Invalid email verification request.',
} as const;

export const invalidEmailVerificationResponse = {
  statusCode: 400,
  code: 'EMAIL_VERIFICATION_INVALID',
  message: 'This email verification link is invalid or expired.',
} as const;

export const emailVerificationRateLimitedResponse = {
  statusCode: 429,
  code: 'EMAIL_VERIFICATION_RATE_LIMITED',
  message: 'Too many requests.',
} as const;
