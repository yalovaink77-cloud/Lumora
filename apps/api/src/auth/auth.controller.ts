import { Controller, Get, UseGuards } from '@nestjs/common';

import { AuthGuard } from './auth.guard';
import { CurrentPrincipal } from './current-principal.decorator';
import type { AuthenticatedPrincipal } from './auth.types';

@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(AuthGuard)
  getMe(@CurrentPrincipal() principal: AuthenticatedPrincipal): AuthenticatedPrincipal {
    return principal;
  }
}
