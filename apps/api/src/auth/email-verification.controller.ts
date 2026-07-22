import {
  BadRequestException,
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";

import {
  invalidEmailVerificationRequestResponse,
  invalidEmailVerificationResponse,
} from "./auth.constants";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { CurrentPrincipal } from "./current-principal.decorator";
import { EmailVerificationRateLimiter } from "./email-verification-rate-limiter";
import {
  assertEmptyEmailVerificationRequestBody,
  InvalidEmailVerificationRequestError,
  parseEmailVerificationConfirmationBody,
} from "./email-verification.validation";
import type { AuthenticatedPrincipal } from "./auth.types";

function requestIp(request: Request): string {
  return request.ip || request.socket.remoteAddress || "unknown";
}

@Controller("auth/email-verification")
@UseGuards(AuthGuard)
export class EmailVerificationController {
  constructor(
    private readonly authService: AuthService,
    private readonly rateLimiter: EmailVerificationRateLimiter,
  ) {}

  @Post("request")
  @HttpCode(202)
  async requestVerification(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<{ status: "accepted" }> {
    try {
      assertEmptyEmailVerificationRequestBody(body);
    } catch (error) {
      if (error instanceof InvalidEmailVerificationRequestError) {
        throw new BadRequestException(invalidEmailVerificationRequestResponse);
      }
      throw error;
    }

    this.rateLimiter.assertAllowed("request", principal.id, requestIp(request));

    return this.authService.requestEmailVerification(principal);
  }

  @Post("confirm")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @Header("Referrer-Policy", "no-referrer")
  async confirmVerification(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<{ status: "verified" }> {
    let token: string;

    try {
      token = parseEmailVerificationConfirmationBody(body).token;
    } catch (error) {
      if (error instanceof InvalidEmailVerificationRequestError) {
        throw new BadRequestException(invalidEmailVerificationRequestResponse);
      }
      throw error;
    }

    this.rateLimiter.assertAllowed("confirm", principal.id, requestIp(request));

    try {
      return await this.authService.confirmEmailVerification(principal, token);
    } catch {
      throw new BadRequestException(invalidEmailVerificationResponse);
    }
  }
}
