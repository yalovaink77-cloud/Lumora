import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  parseTrustedOrigins,
  validateAuthRuntimeConfig,
} from './auth-config.js';

const validEnv = {
  BETTER_AUTH_SECRET: 'unit-test-secret-value-with-32-chars-minimum',
  BETTER_AUTH_URL: 'http://localhost:3000',
  AUTH_TRUSTED_ORIGINS: 'http://localhost:3000',
  NODE_ENV: 'development',
};

test('validateAuthRuntimeConfig passes with valid configuration', () => {
  const config = validateAuthRuntimeConfig(validEnv, {
    allowPlaceholderSecret: true,
  });

  assert.equal(config.baseUrl, 'http://localhost:3000');
  assert.deepEqual(config.trustedOrigins, ['http://localhost:3000']);
  assert.equal(config.secureCookies, false);
});

test('validateAuthRuntimeConfig fails when BETTER_AUTH_SECRET is missing', () => {
  assert.throws(
    () =>
      validateAuthRuntimeConfig({
        ...validEnv,
        BETTER_AUTH_SECRET: undefined,
      }),
    /BETTER_AUTH_SECRET is required/,
  );
});

test('validateAuthRuntimeConfig fails when BETTER_AUTH_SECRET is too short', () => {
  assert.throws(
    () =>
      validateAuthRuntimeConfig({
        ...validEnv,
        BETTER_AUTH_SECRET: 'too-short',
      }),
    /at least 32 characters/,
  );
});

test('validateAuthRuntimeConfig fails when BETTER_AUTH_URL is malformed', () => {
  assert.throws(
    () =>
      validateAuthRuntimeConfig({
        ...validEnv,
        BETTER_AUTH_URL: 'not-a-url',
      }),
    /valid absolute URL/,
  );
});

test('validateAuthRuntimeConfig error messages do not include secret values', () => {
  const secret = 'unit-test-secret-value-with-32-chars-minimum';

  try {
    validateAuthRuntimeConfig({
      ...validEnv,
      BETTER_AUTH_SECRET: secret,
      BETTER_AUTH_URL: ':::',
    });
    assert.fail('Expected validation to throw');
  } catch (error) {
    assert.match(String(error), /valid absolute URL/);
    assert.doesNotMatch(String(error), new RegExp(secret));
  }
});

test('parseTrustedOrigins rejects empty values', () => {
  assert.throws(() => parseTrustedOrigins(', ,'), /at least one origin/);
});
