import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { AUTH_PRINCIPAL_KEY } from './auth.types';

function createExecutionContext(request: {
  headers: Record<string, string | string[] | undefined>;
  [AUTH_PRINCIPAL_KEY]?: unknown;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
  } as ExecutionContext;
}

test('AuthGuard rejects missing session', async () => {
  const authService = {
    getAuth: async () => ({
      api: {
        getSession: async () => null,
      },
    }),
  } as unknown as AuthService;

  const guard = new AuthGuard(authService);
  const request = { headers: {} };

  await assert.rejects(
    () => guard.canActivate(createExecutionContext(request)),
    UnauthorizedException,
  );
});

test('AuthGuard rejects invalid session', async () => {
  const authService = {
    getAuth: async () => ({
      api: {
        getSession: async () => ({ session: { id: 'session-1' }, user: null }),
      },
    }),
  } as unknown as AuthService;

  const guard = new AuthGuard(authService);

  await assert.rejects(
    () => guard.canActivate(createExecutionContext({ headers: {} })),
    UnauthorizedException,
  );
});

test('AuthGuard attaches a neutral principal for valid session', async () => {
  const authService = {
    getAuth: async () => ({
      api: {
        getSession: async () => ({
          user: {
            id: 'user-1',
            email: 'user@example.com',
            emailVerified: true,
            name: 'Test User',
          },
        }),
      },
    }),
  } as unknown as AuthService;

  const guard = new AuthGuard(authService);
  const request: {
    headers: Record<string, string | string[] | undefined>;
    [AUTH_PRINCIPAL_KEY]?: {
      id: string;
      email: string;
      emailVerified: boolean;
      name: string;
    };
  } = { headers: { cookie: 'session=opaque-value' } };

  assert.equal(await guard.canActivate(createExecutionContext(request)), true);
  assert.deepEqual(request[AUTH_PRINCIPAL_KEY], {
    id: 'user-1',
    email: 'user@example.com',
    emailVerified: true,
    name: 'Test User',
  });
  assert.equal('token' in (request[AUTH_PRINCIPAL_KEY] ?? {}), false);
  assert.equal('session' in (request[AUTH_PRINCIPAL_KEY] ?? {}), false);
});
