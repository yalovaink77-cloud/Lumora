import { Module } from "@nestjs/common";
import { PrismaTimelineRepository } from "@lumora/database";
import { TimelineApplicationService } from "@lumora/timeline";

import { AuthModule } from "../auth/auth.module";
import { TIMELINE_APPLICATION_SERVICE } from "./timeline.constants";
import {
  ChildTimelineController,
  PregnancyTimelineController,
} from "./timeline.controller";

@Module({
  imports: [AuthModule],
  controllers: [PregnancyTimelineController, ChildTimelineController],
  providers: [
    {
      provide: TIMELINE_APPLICATION_SERVICE,
      useFactory: () =>
        new TimelineApplicationService(new PrismaTimelineRepository()),
    },
  ],
})
export class TimelineModule {}
