import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AUTH_PRINCIPAL_KEY, type AuthenticatedPrincipal } from './auth.types';

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal => {
    const request = context.switchToHttp().getRequest<{
      [AUTH_PRINCIPAL_KEY]?: AuthenticatedPrincipal;
    }>();

    const principal = request[AUTH_PRINCIPAL_KEY];

    if (!principal) {
      throw new Error('Authenticated principal is not available on the request.');
    }

    return principal;
  },
);
