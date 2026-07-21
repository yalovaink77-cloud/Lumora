import { Module } from "@nestjs/common";
import { PrismaPregnancyRepository } from "@lumora/database";
import { PregnancyApplicationService } from "@lumora/pregnancy";

import { AuthModule } from "../auth/auth.module";
import { PREGNANCY_APPLICATION_SERVICE } from "./pregnancy.constants";
import { PregnancyController } from "./pregnancy.controller";

@Module({
  imports: [AuthModule],
  controllers: [PregnancyController],
  providers: [
    {
      provide: PREGNANCY_APPLICATION_SERVICE,
      useFactory: () =>
        new PregnancyApplicationService(new PrismaPregnancyRepository()),
    },
  ],
})
export class PregnancyModule {}
