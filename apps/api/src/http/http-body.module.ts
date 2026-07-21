import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import { HttpBodyParserMiddleware } from './http-body-parser.middleware';

@Module({})
export class HttpBodyModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpBodyParserMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}
