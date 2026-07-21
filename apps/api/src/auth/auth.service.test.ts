import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AuthService } from './auth.service';

const validEnv = {
  BETTER_AUTH_SECRET: 'unit-test-secret-value-with-32-chars-minimum',
  BETTER_AUTH_URL: 'http://localhost:3000',
  AUTH_TRUSTED_ORIGINS: 'http://localhost:3000',
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://lumora:lumora@127.0.0.1:5432/lumora?schema=public',
};

test('AuthService onModuleInit does not throw when PostgreSQL is unavailable', async () => {
  process.env.BETTER_AUTH_SECRET = validEnv.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_URL = validEnv.BETTER_AUTH_URL;
  process.env.AUTH_TRUSTED_ORIGINS = validEnv.AUTH_TRUSTED_ORIGINS;
  process.env.NODE_ENV = validEnv.NODE_ENV;
  process.env.DATABASE_URL = validEnv.DATABASE_URL;

  const service = new AuthService();

  await assert.doesNotReject(async () => {
    await service.onModuleInit();
  });
});

test('AuthService onModuleInit throws when BETTER_AUTH_SECRET is missing', async () => {
  delete process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_URL = validEnv.BETTER_AUTH_URL;
  process.env.AUTH_TRUSTED_ORIGINS = validEnv.AUTH_TRUSTED_ORIGINS;

  const service = new AuthService();

  await assert.rejects(
    () => service.onModuleInit(),
    /BETTER_AUTH_SECRET is required/,
  );
});
