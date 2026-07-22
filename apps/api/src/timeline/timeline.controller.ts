import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  TimelineApplicationService,
  TimelineValidationError,
} from "@lumora/timeline";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import type { AuthenticatedPrincipal } from "../auth/auth.types";
import { TIMELINE_APPLICATION_SERVICE } from "./timeline.constants";
import {
  type ChildTimelineEventResponse,
  type PregnancyTimelineEventResponse,
  toChildTimelineEventResponse,
  toPregnancyTimelineEventResponse,
} from "./timeline.response";

const timelineNotFoundResponse = {
  statusCode: 404,
  code: "TIMELINE_NOT_FOUND",
  message: "Timeline resource not found.",
};

function mapTimelineError(error: unknown): never {
  if (error instanceof TimelineValidationError) {
    throw new BadRequestException({
      statusCode: 400,
      code: error.code,
      message: error.message,
    });
  }

  throw error;
}

@Controller("families/:familyId/pregnancies/:pregnancyId/timeline-events")
@UseGuards(AuthGuard)
export class PregnancyTimelineController {
  constructor(
    @Inject(TIMELINE_APPLICATION_SERVICE)
    private readonly timelineService: TimelineApplicationService,
  ) {}

  @Post()
  async createTimelineEvent(
    @Param("familyId") familyId: string,
    @Param("pregnancyId") pregnancyId: string,
    @Body() input: unknown,
    @Query() query: unknown,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PregnancyTimelineEventResponse> {
    try {
      const event = await this.timelineService.createTimelineEvent(
        familyId,
        principal.id,
        {
          type: "PREGNANCY",
          pregnancyId,
        },
        input,
        query,
      );

      if (!event) {
        throw new NotFoundException(timelineNotFoundResponse);
      }

      return toPregnancyTimelineEventResponse(event);
    } catch (error: unknown) {
      return mapTimelineError(error);
    }
  }

  @Get()
  async listTimelineEvents(
    @Param("familyId") familyId: string,
    @Param("pregnancyId") pregnancyId: string,
    @Body() body: unknown,
    @Query() query: unknown,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<{ timelineEvents: PregnancyTimelineEventResponse[] }> {
    try {
      const events = await this.timelineService.listTimelineEvents(
        familyId,
        principal.id,
        {
          type: "PREGNANCY",
          pregnancyId,
        },
        body,
        query,
      );

      if (!events) {
        throw new NotFoundException(timelineNotFoundResponse);
      }

      return {
        timelineEvents: events.map(toPregnancyTimelineEventResponse),
      };
    } catch (error: unknown) {
      return mapTimelineError(error);
    }
  }

  @Get(":timelineEventId")
  async getTimelineEvent(
    @Param("familyId") familyId: string,
    @Param("pregnancyId") pregnancyId: string,
    @Param("timelineEventId") timelineEventId: string,
    @Body() body: unknown,
    @Query() query: unknown,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PregnancyTimelineEventResponse> {
    try {
      const event = await this.timelineService.getTimelineEvent(
        familyId,
        timelineEventId,
        principal.id,
        {
          type: "PREGNANCY",
          pregnancyId,
        },
        body,
        query,
      );

      if (!event) {
        throw new NotFoundException(timelineNotFoundResponse);
      }

      return toPregnancyTimelineEventResponse(event);
    } catch (error: unknown) {
      return mapTimelineError(error);
    }
  }
}

@Controller("families/:familyId/children/:childId/timeline-events")
@UseGuards(AuthGuard)
export class ChildTimelineController {
  constructor(
    @Inject(TIMELINE_APPLICATION_SERVICE)
    private readonly timelineService: TimelineApplicationService,
  ) {}

  @Post()
  async createTimelineEvent(
    @Param("familyId") familyId: string,
    @Param("childId") childId: string,
    @Body() input: unknown,
    @Query() query: unknown,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<ChildTimelineEventResponse> {
    try {
      const event = await this.timelineService.createTimelineEvent(
        familyId,
        principal.id,
        {
          type: "CHILD",
          childId,
        },
        input,
        query,
      );

      if (!event) {
        throw new NotFoundException(timelineNotFoundResponse);
      }

      return toChildTimelineEventResponse(event);
    } catch (error: unknown) {
      return mapTimelineError(error);
    }
  }

  @Get()
  async listTimelineEvents(
    @Param("familyId") familyId: string,
    @Param("childId") childId: string,
    @Body() body: unknown,
    @Query() query: unknown,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<{ timelineEvents: ChildTimelineEventResponse[] }> {
    try {
      const events = await this.timelineService.listTimelineEvents(
        familyId,
        principal.id,
        {
          type: "CHILD",
          childId,
        },
        body,
        query,
      );

      if (!events) {
        throw new NotFoundException(timelineNotFoundResponse);
      }

      return {
        timelineEvents: events.map(toChildTimelineEventResponse),
      };
    } catch (error: unknown) {
      return mapTimelineError(error);
    }
  }

  @Get(":timelineEventId")
  async getTimelineEvent(
    @Param("familyId") familyId: string,
    @Param("childId") childId: string,
    @Param("timelineEventId") timelineEventId: string,
    @Body() body: unknown,
    @Query() query: unknown,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<ChildTimelineEventResponse> {
    try {
      const event = await this.timelineService.getTimelineEvent(
        familyId,
        timelineEventId,
        principal.id,
        {
          type: "CHILD",
          childId,
        },
        body,
        query,
      );

      if (!event) {
        throw new NotFoundException(timelineNotFoundResponse);
      }

      return toChildTimelineEventResponse(event);
    } catch (error: unknown) {
      return mapTimelineError(error);
    }
  }
}
