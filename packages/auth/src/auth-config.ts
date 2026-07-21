export type AuthRuntimeConfig = {
  secret: string;
  baseUrl: string;
  trustedOrigins: string[];
  secureCookies: boolean;
};

const PLACEHOLDER_SECRETS = new Set([
  'change-me',
  'changeme',
  'your-secret-here',
  'replace-me',
  'test-secret',
  'development-secret',
]);

export function parseTrustedOrigins(rawValue: string | undefined): string[] {
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    throw new Error('AUTH_TRUSTED_ORIGINS is required but was not provided.');
  }

  const origins = rawValue
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    throw new Error('AUTH_TRUSTED_ORIGINS must include at least one origin.');
  }

  for (const origin of origins) {
    let parsed: URL;

    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`AUTH_TRUSTED_ORIGINS contains an invalid origin: ${origin}`);
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`AUTH_TRUSTED_ORIGINS origin must use http or https: ${origin}`);
    }
  }

  return origins;
}

export function validateAuthRuntimeConfig(
  env: NodeJS.ProcessEnv,
  options?: { allowPlaceholderSecret?: boolean },
): AuthRuntimeConfig {
  const secret = env.BETTER_AUTH_SECRET;

  if (typeof secret !== 'string' || secret.trim().length === 0) {
    throw new Error('BETTER_AUTH_SECRET is required but was not provided.');
  }

  if (secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must be at least 32 characters.');
  }

  if (!options?.allowPlaceholderSecret && PLACEHOLDER_SECRETS.has(secret.trim().toLowerCase())) {
    throw new Error('BETTER_AUTH_SECRET must not use a placeholder value.');
  }

  const baseUrlValue = env.BETTER_AUTH_URL;

  if (typeof baseUrlValue !== 'string' || baseUrlValue.trim().length === 0) {
    throw new Error('BETTER_AUTH_URL is required but was not provided.');
  }

  let baseUrl: URL;

  try {
    baseUrl = new URL(baseUrlValue);
  } catch {
    throw new Error('BETTER_AUTH_URL must be a valid absolute URL.');
  }

  if (!['http:', 'https:'].includes(baseUrl.protocol)) {
    throw new Error('BETTER_AUTH_URL must use http or https.');
  }

  const trustedOrigins = parseTrustedOrigins(env.AUTH_TRUSTED_ORIGINS);
  const nodeEnv = env.NODE_ENV ?? 'development';
  const secureCookies = nodeEnv === 'production';

  if (secureCookies) {
    const hasLocalhostOrigin = trustedOrigins.some((origin) => {
      const parsed = new URL(origin);
      return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    });

    if (hasLocalhostOrigin) {
      throw new Error(
        'AUTH_TRUSTED_ORIGINS must not include localhost origins in production.',
      );
    }

    if (baseUrl.hostname === 'localhost' || baseUrl.hostname === '127.0.0.1') {
      throw new Error('BETTER_AUTH_URL must not use localhost in production.');
    }
  }

  return {
    secret,
    baseUrl: baseUrl.toString().replace(/\/$/, ''),
    trustedOrigins,
    secureCookies,
  };
}
