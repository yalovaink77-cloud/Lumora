import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DatabaseService } from '../database/database.service';
import { HealthController } from './health.controller';

test('HealthController returns ok when database is connected', async () => {
  const databaseService = {
    isConnected: async () => true,
  } as Pick<DatabaseService, 'isConnected'>;

  const controller = new HealthController(databaseService as DatabaseService);

  assert.deepEqual(await controller.check(), {
    status: 'ok',
    checks: {
      database: 'ok',
    },
  });
});

test('HealthController returns degraded when database is unavailable', async () => {
  const databaseService = {
    isConnected: async () => false,
  } as Pick<DatabaseService, 'isConnected'>;

  const controller = new HealthController(databaseService as DatabaseService);

  assert.deepEqual(await controller.check(), {
    status: 'degraded',
    checks: {
      database: 'error',
    },
  });
});
