import { Module } from "@nestjs/common";
import { FamilyApplicationService } from "@lumora/family";
import { PrismaFamilyRepository } from "@lumora/database";

import { AuthModule } from "../auth/auth.module";
import { FAMILY_APPLICATION_SERVICE } from "./family.constants";
import { FamilyController } from "./family.controller";

@Module({
  imports: [AuthModule],
  controllers: [FamilyController],
  providers: [
    {
      provide: FAMILY_APPLICATION_SERVICE,
      useFactory: () =>
        new FamilyApplicationService(new PrismaFamilyRepository()),
    },
  ],
})
export class FamilyModule {}
