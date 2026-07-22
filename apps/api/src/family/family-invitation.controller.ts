import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  FamilyApplicationService,
  FamilyInvitationAcceptanceValidationError,
  VerifiedEmailRequiredError,
} from "@lumora/family";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedPrincipal } from "../auth/auth.types";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import { FAMILY_APPLICATION_SERVICE } from "./family.constants";
import {
  type AcceptedFamilyInvitationResponse,
  toAcceptedFamilyInvitationResponse,
} from "./family.response";

@Controller("family-invitations")
@UseGuards(AuthGuard)
export class FamilyInvitationController {
  constructor(
    @Inject(FAMILY_APPLICATION_SERVICE)
    private readonly familyService: FamilyApplicationService,
  ) {}

  @Post("accept")
  @HttpCode(200)
  async acceptMemberInvitation(
    @Body() input: unknown,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AcceptedFamilyInvitationResponse> {
    try {
      const result = await this.familyService.acceptMemberInvitation(
        {
          id: principal.id,
          email: principal.email,
          emailVerified: principal.emailVerified,
        },
        input,
      );

      if (result.status === "INVITATION_NOT_FOUND") {
        throw new NotFoundException({
          statusCode: 404,
          code: "INVITATION_NOT_FOUND",
          message: "Invitation not found.",
        });
      }

      return toAcceptedFamilyInvitationResponse(result);
    } catch (error: unknown) {
      if (error instanceof FamilyInvitationAcceptanceValidationError) {
        throw new BadRequestException({
          statusCode: 400,
          code: error.code,
          message: error.message,
        });
      }

      if (error instanceof VerifiedEmailRequiredError) {
        throw new ForbiddenException({
          statusCode: 403,
          code: error.code,
          message: error.message,
        });
      }

      throw error;
    }
  }
}
