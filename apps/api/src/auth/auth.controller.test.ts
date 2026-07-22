import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AuthController } from './auth.controller';
import type { AuthenticatedPrincipal } from './auth.types';

test('AuthController returns only the neutral authenticated principal', () => {
  const controller = new AuthController();
  const principal: AuthenticatedPrincipal = {
    id: 'user-1',
    email: 'user@example.com',
    emailVerified: false,
    name: 'Test User',
  };

  assert.deepEqual(controller.getMe(principal), {
    id: 'user-1',
    email: 'user@example.com',
    emailVerified: false,
    name: 'Test User',
  });
});
