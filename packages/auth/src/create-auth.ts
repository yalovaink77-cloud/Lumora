import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { getPrismaClient } from '@lumora/database';

import type { AuthRuntimeConfig } from './auth-config.js';

export function createAuth(config: AuthRuntimeConfig) {
  return betterAuth({
    appName: 'Lumora',
    secret: config.secret,
    baseURL: config.baseUrl,
    trustedOrigins: config.trustedOrigins,
    basePath: '/api/auth',
    database: prismaAdapter(getPrismaClient(), {
      provider: 'postgresql',
    }),
    emailAndPassword: {
      enabled: true,
    },
    telemetry: {
      enabled: false,
    },
    advanced: {
      useSecureCookies: config.secureCookies,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.secureCookies,
      },
    },
  });
}

export type LumoraAuth = ReturnType<typeof createAuth>;
