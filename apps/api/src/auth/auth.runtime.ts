import type { LumoraAuth } from '@lumora/auth';

import type { AuthenticatedPrincipal } from './auth.types';

export function toAuthenticatedPrincipal(user: {
  id: string;
  email: string;
  name: string;
}): AuthenticatedPrincipal {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}

export function createAuthRuntimeModule() {
  return import('@lumora/auth');
}

export function createBetterAuthNodeModule() {
  return import('better-auth/node');
}

export type { LumoraAuth };
