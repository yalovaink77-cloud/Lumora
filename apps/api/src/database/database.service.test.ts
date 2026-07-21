import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { DatabaseService } from './database.service';

const validDatabaseUrl =
  'postgresql://lumora:lumora@127.0.0.1:5432/lumora?schema=public';

afterEach(async () => {
  const service = new DatabaseService();
  await service.onModuleDestroy();
});

test('DatabaseService onModuleInit does not throw when database server is unavailable', () => {
  process.env.DATABASE_URL = validDatabaseUrl;

  const service = new DatabaseService();

  assert.doesNotThrow(() => {
    service.onModuleInit();
  });
});

test('DatabaseService isConnected returns false when database server is unavailable', async () => {
  process.env.DATABASE_URL = validDatabaseUrl;

  const service = new DatabaseService();
  service.onModuleInit();

  assert.equal(await service.isConnected(), false);
});

test('DatabaseService onModuleInit throws when DATABASE_URL is missing', () => {
  delete process.env.DATABASE_URL;

  const service = new DatabaseService();

  assert.throws(
    () => {
      service.onModuleInit();
    },
    /DATABASE_URL is required/,
  );
});
