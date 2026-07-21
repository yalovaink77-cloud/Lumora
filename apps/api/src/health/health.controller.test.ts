import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Test } from '@nestjs/testing';

import { HealthController } from './health.controller';

test('HealthController returns ok status', async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
  }).compile();

  const controller = moduleRef.get(HealthController);

  assert.deepEqual(controller.check(), { status: 'ok' });
});
