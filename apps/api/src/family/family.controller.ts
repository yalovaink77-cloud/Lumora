import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  FamilyApplicationService,
  FamilyInvitationCreationValidationError,
  FamilyValidationError,
} from "@lumora/family";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import type { AuthenticatedPrincipal } from "../auth/auth.types";
import { FAMILY_APPLICATION_SERVICE } from "./family.constants";
import {
  type CreatedFamilyInvitationResponse,
  type CreatedFamilyResponse,
  type FamilyResponse,
  toCreatedFamilyInvitationResponse,
  toCreatedFamilyResponse,
  toFamilyResponse,
} from "./family.response";

@Controller("families")
@UseGuards(AuthGuard)
export class FamilyController {
  constructor(
    @Inject(FAMILY_APPLICATION_SERVICE)
    private readonly familyService: FamilyApplicationService,
  ) {}

  @Post()
  async createFamily(
    @Body() input: unknown,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<CreatedFamilyResponse> {
    try {
      const created = await this.familyService.createFamily(
        principal.id,
        input,
      );
      return toCreatedFamilyResponse(created);
    } catch (error: unknown) {
      if (error instanceof FamilyValidationError) {
        throw new BadRequestException({
          statusCode: 400,
          code: error.code,
          message: error.message,
        });
      }

      throw error;
    }
  }

  @Post(":familyId/invitations")
  async createMemberInvitation(
    @Param("familyId") familyId: string,
    @Body() input: unknown,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<CreatedFamilyInvitationResponse> {
    try {
      const result = await this.familyService.createMemberInvitation(
        principal.id,
        familyId,
        input,
      );

      if (result.status === "FAMILY_NOT_FOUND") {
        throw new NotFoundException({
          statusCode: 404,
          code: "FAMILY_NOT_FOUND",
          message: "Family not found.",
        });
      }

      if (result.status === "INVITATION_ALREADY_PENDING") {
        throw new ConflictException({
          statusCode: 409,
          code: "INVITATION_ALREADY_PENDING",
          message: "A pending invitation already exists.",
        });
      }

      return toCreatedFamilyInvitationResponse(result);
    } catch (error: unknown) {
      if (error instanceof FamilyInvitationCreationValidationError) {
        throw new BadRequestException({
          statusCode: 400,
          code: error.code,
          message: error.message,
        });
      }

      throw error;
    }
  }

  @Get()
  async listFamilies(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<{ families: FamilyResponse[] }> {
    const families = await this.familyService.listFamilies(principal.id);

    return {
      families: families.map(toFamilyResponse),
    };
  }

  @Get(":familyId")
  async getFamily(
    @Param("familyId") familyId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FamilyResponse> {
    const family = await this.familyService.getFamily(familyId, principal.id);

    if (!family) {
      throw new NotFoundException({
        statusCode: 404,
        code: "FAMILY_NOT_FOUND",
        message: "Family not found.",
      });
    }

    return toFamilyResponse(family);
  }
}
