import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  PregnancyApplicationService,
  PregnancyValidationError,
} from "@lumora/pregnancy";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import type { AuthenticatedPrincipal } from "../auth/auth.types";
import { PREGNANCY_APPLICATION_SERVICE } from "./pregnancy.constants";
import {
  type PregnancyResponse,
  toPregnancyResponse,
} from "./pregnancy.response";

const familyNotFoundResponse = {
  statusCode: 404,
  code: "FAMILY_NOT_FOUND",
  message: "Family not found.",
};

const pregnancyNotFoundResponse = {
  statusCode: 404,
  code: "PREGNANCY_NOT_FOUND",
  message: "Pregnancy not found.",
};

@Controller("families/:familyId/pregnancies")
@UseGuards(AuthGuard)
export class PregnancyController {
  constructor(
    @Inject(PREGNANCY_APPLICATION_SERVICE)
    private readonly pregnancyService: PregnancyApplicationService,
  ) {}

  @Post()
  async createPregnancy(
    @Param("familyId") familyId: string,
    @Body() input: unknown,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PregnancyResponse> {
    try {
      const pregnancy = await this.pregnancyService.createPregnancy(
        familyId,
        principal.id,
        input,
      );

      if (!pregnancy) {
        throw new NotFoundException(familyNotFoundResponse);
      }

      return toPregnancyResponse(pregnancy);
    } catch (error: unknown) {
      if (error instanceof PregnancyValidationError) {
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
  async listPregnancies(
    @Param("familyId") familyId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<{ pregnancies: PregnancyResponse[] }> {
    const pregnancies = await this.pregnancyService.listPregnancies(
      familyId,
      principal.id,
    );

    if (!pregnancies) {
      throw new NotFoundException(familyNotFoundResponse);
    }

    return {
      pregnancies: pregnancies.map(toPregnancyResponse),
    };
  }

  @Get(":pregnancyId")
  async getPregnancy(
    @Param("familyId") familyId: string,
    @Param("pregnancyId") pregnancyId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PregnancyResponse> {
    const pregnancy = await this.pregnancyService.getPregnancy(
      familyId,
      pregnancyId,
      principal.id,
    );

    if (!pregnancy) {
      throw new NotFoundException(pregnancyNotFoundResponse);
    }

    return toPregnancyResponse(pregnancy);
  }
}
