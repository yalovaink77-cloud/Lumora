import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthHandlerMiddleware } from './auth-handler.middleware';
import { AuthService } from './auth.service';
import { EmailVerificationController } from './email-verification.controller';
import { EmailVerificationRateLimiter } from './email-verification-rate-limiter';

@Module({
  controllers: [AuthController, EmailVerificationController],
  providers: [
    AuthService,
    AuthGuard,
    AuthHandlerMiddleware,
    EmailVerificationRateLimiter,
  ],
  exports: [AuthService, AuthGuard],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthHandlerMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}
