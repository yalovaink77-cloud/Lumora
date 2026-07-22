import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ChildApplicationService, ChildValidationError } from "@lumora/child";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import type { AuthenticatedPrincipal } from "../auth/auth.types";
import { CHILD_APPLICATION_SERVICE } from "./child.constants";
import { type ChildResponse, toChildResponse } from "./child.response";

const familyNotFoundResponse = {
  statusCode: 404,
  code: "FAMILY_NOT_FOUND",
  message: "Family not found.",
};

const childNotFoundResponse = {
  statusCode: 404,
  code: "CHILD_NOT_FOUND",
  message: "Child not found.",
};

@Controller("families/:familyId/children")
@UseGuards(AuthGuard)
export class ChildController {
  constructor(
    @Inject(CHILD_APPLICATION_SERVICE)
    private readonly childService: ChildApplicationService,
  ) {}

  @Post()
  async createChild(
    @Param("familyId") familyId: string,
    @Body() input: unknown,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<ChildResponse> {
    try {
      const child = await this.childService.createChild(
        familyId,
        principal.id,
        input,
      );

      if (!child) {
        throw new NotFoundException(familyNotFoundResponse);
      }

      return toChildResponse(child);
    } catch (error: unknown) {
      if (error instanceof ChildValidationError) {
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
  async listChildren(
    @Param("familyId") familyId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<{ children: ChildResponse[] }> {
    const children = await this.childService.listChildren(
      familyId,
      principal.id,
    );

    if (!children) {
      throw new NotFoundException(familyNotFoundResponse);
    }

    return {
      children: children.map(toChildResponse),
    };
  }

  @Get(":childId")
  async getChild(
    @Param("familyId") familyId: string,
    @Param("childId") childId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<ChildResponse> {
    const child = await this.childService.getChild(
      familyId,
      childId,
      principal.id,
    );

    if (!child) {
      throw new NotFoundException(childNotFoundResponse);
    }

    return toChildResponse(child);
  }

  @Patch(":childId")
  async updateChildDisplayName(
    @Param("familyId") familyId: string,
    @Param("childId") childId: string,
    @Body() input: unknown,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<ChildResponse> {
    try {
      const child = await this.childService.updateChildDisplayName(
        familyId,
        childId,
        principal.id,
        input,
      );

      if (!child) {
        throw new NotFoundException(childNotFoundResponse);
      }

      return toChildResponse(child);
    } catch (error: unknown) {
      if (error instanceof ChildValidationError) {
        throw new BadRequestException({
          statusCode: 400,
          code: error.code,
          message: error.message,
        });
      }

      throw error;
    }
  }
}
