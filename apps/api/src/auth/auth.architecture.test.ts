import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { getPrismaClient } from '@lumora/database';

test('Better Auth uses the shared Prisma Client singleton', () => {
  const databaseSource = readFileSync(
    join(process.cwd(), '../../packages/auth/src/create-auth.ts'),
    'utf8',
  );

  assert.match(databaseSource, /getPrismaClient\(\)/);
  assert.doesNotMatch(databaseSource, /new PrismaClient\(/);
  assert.equal(typeof getPrismaClient, 'function');
});

test('domain package does not import Better Auth', () => {
  const domainSource = readFileSync(
    join(process.cwd(), '../../packages/domain/src/index.ts'),
    'utf8',
  );

  assert.doesNotMatch(domainSource, /better-auth/);
});
