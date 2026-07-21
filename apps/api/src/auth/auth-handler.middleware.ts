import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { AuthService } from './auth.service';
import { createBetterAuthNodeModule } from './auth.runtime';
import { BETTER_AUTH_BASE_PATH } from './auth.constants';

@Injectable()
export class AuthHandlerMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {}

  async use(request: Request, response: Response, next: NextFunction): Promise<void> {
    if (!request.path.startsWith(BETTER_AUTH_BASE_PATH)) {
      next();
      return;
    }

    try {
      const auth = await this.authService.getAuth();
      const { toNodeHandler } = await createBetterAuthNodeModule();
      const handler = toNodeHandler(auth);
      await handler(request, response);
    } catch (error: unknown) {
      if (!response.headersSent) {
        next(error);
      }

      return;
    }

    if (!response.headersSent) {
      next();
    }
  }
}
