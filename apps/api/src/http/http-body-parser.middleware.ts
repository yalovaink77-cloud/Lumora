import { Injectable, NestMiddleware } from '@nestjs/common';
import { json, urlencoded, type NextFunction, type Request, type Response } from 'express';

import { BETTER_AUTH_BASE_PATH } from '../auth/auth.constants';

const jsonBodyParser = json();
const urlencodedBodyParser = urlencoded({ extended: true });

@Injectable()
export class HttpBodyParserMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    if (request.path.startsWith(BETTER_AUTH_BASE_PATH)) {
      next();
      return;
    }

    jsonBodyParser(request, response, (jsonError?: unknown) => {
      if (jsonError instanceof Error) {
        next(jsonError);
        return;
      }

      urlencodedBodyParser(request, response, next);
    });
  }
}
