import { Module } from "@nestjs/common";
import { ChildApplicationService } from "@lumora/child";
import { PrismaChildRepository } from "@lumora/database";

import { AuthModule } from "../auth/auth.module";
import { CHILD_APPLICATION_SERVICE } from "./child.constants";
import { ChildController } from "./child.controller";

@Module({
  imports: [AuthModule],
  controllers: [ChildController],
  providers: [
    {
      provide: CHILD_APPLICATION_SERVICE,
      useFactory: () =>
        new ChildApplicationService(new PrismaChildRepository()),
    },
  ],
})
export class ChildModule {}
