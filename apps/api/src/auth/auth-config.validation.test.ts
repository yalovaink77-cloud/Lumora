import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import {
  parseTrustedOrigins,
  validateAuthRuntimeConfig,
} from '@lumora/auth';

const validEnv = {
  BETTER_AUTH_SECRET: 'unit-test-secret-value-with-32-chars-minimum',
  BETTER_AUTH_URL: 'http://localhost:3000',
  AUTH_TRUSTED_ORIGINS: 'http://localhost:3000',
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://lumora:lumora@127.0.0.1:5432/lumora?schema=public',
};

beforeEach(() => {
  process.env.BETTER_AUTH_SECRET = validEnv.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_URL = validEnv.BETTER_AUTH_URL;
  process.env.AUTH_TRUSTED_ORIGINS = validEnv.AUTH_TRUSTED_ORIGINS;
  process.env.NODE_ENV = validEnv.NODE_ENV;
  process.env.DATABASE_URL = validEnv.DATABASE_URL;
});

afterEach(() => {
  delete process.env.BETTER_AUTH_SECRET;
  delete process.env.BETTER_AUTH_URL;
  delete process.env.AUTH_TRUSTED_ORIGINS;
});

test('validateAuthRuntimeConfig passes with valid configuration', () => {
  assert.doesNotThrow(() => validateAuthRuntimeConfig(process.env));
});

test('validateAuthRuntimeConfig fails when BETTER_AUTH_SECRET is missing', () => {
  delete process.env.BETTER_AUTH_SECRET;

  assert.throws(
    () => validateAuthRuntimeConfig(process.env),
    /BETTER_AUTH_SECRET is required/,
  );
});

test('validateAuthRuntimeConfig fails when BETTER_AUTH_SECRET is too short', () => {
  process.env.BETTER_AUTH_SECRET = 'short-secret';

  assert.throws(
    () => validateAuthRuntimeConfig(process.env),
    /at least 32 characters/,
  );
});

test('validateAuthRuntimeConfig fails when BETTER_AUTH_URL is malformed', () => {
  process.env.BETTER_AUTH_URL = 'not-a-valid-url';

  assert.throws(
    () => validateAuthRuntimeConfig(process.env),
    /valid absolute URL/,
  );
});

test('validateAuthRuntimeConfig errors do not echo secret values', () => {
  const secret = 'unit-test-secret-value-with-32-chars-minimum';
  process.env.BETTER_AUTH_SECRET = secret;
  process.env.BETTER_AUTH_URL = ':::';

  try {
    validateAuthRuntimeConfig(process.env);
    assert.fail('Expected validation to throw');
  } catch (error) {
    assert.match(String(error), /valid absolute URL/);
    assert.doesNotMatch(String(error), new RegExp(secret));
  }
});

test('parseTrustedOrigins parses comma-separated origins', () => {
  assert.deepEqual(parseTrustedOrigins('http://localhost:3000,http://127.0.0.1:3000'), [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);
});
