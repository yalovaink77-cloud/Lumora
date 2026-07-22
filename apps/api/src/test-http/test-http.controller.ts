import { timingSafeEqual } from 'node:crypto';

import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  NotFoundException,
  Post,
  Req,
} from '@nestjs/common';
import type { VerificationEmailDeliveryInput } from '@lumora/auth';
import type { Request } from 'express';

import { AuthService } from '../auth/auth.service';

function assertCaptureAccess(request: Request, suppliedSecret: string | undefined): void {
  const expectedSecret = process.env.LUMORA_TEST_HTTP_SECRET;
  const remoteAddress = request.socket.remoteAddress;
  const isLoopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(
    remoteAddress ?? '',
  );

  if (
    process.env.NODE_ENV !== 'test' ||
    !isLoopback ||
    typeof expectedSecret !== 'string' ||
    expectedSecret.length < 32 ||
    typeof suppliedSecret !== 'string'
  ) {
    throw new NotFoundException();
  }

  const expected = Buffer.from(expectedSecret);
  const supplied = Buffer.from(suppliedSecret);

  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    throw new NotFoundException();
  }
}

@Controller('__test')
export class TestHttpController {
  constructor(private readonly authService: AuthService) {}

  @Post('echo-json')
  @HttpCode(201)
  echoJson(@Body() body: Record<string, unknown>): { received: Record<string, unknown> } {
    return {
      received: body,
    };
  }

  @Get('email-verification-deliveries')
  @Header('Cache-Control', 'no-store')
  getEmailVerificationDeliveries(
    @Req() request: Request,
    @Headers('x-lumora-test-secret') suppliedSecret: string | undefined,
  ): {
    deliveries: readonly VerificationEmailDeliveryInput[];
  } {
    assertCaptureAccess(request, suppliedSecret);

    return {
      deliveries: this.authService.getCapturedVerificationEmails(),
    };
  }

  @Delete('email-verification-deliveries')
  @HttpCode(204)
  clearEmailVerificationDeliveries(
    @Req() request: Request,
    @Headers('x-lumora-test-secret') suppliedSecret: string | undefined,
  ): void {
    assertCaptureAccess(request, suppliedSecret);
    this.authService.clearCapturedVerificationEmails();
  }
}
