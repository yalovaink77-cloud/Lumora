import { Module, type Type } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { FamilyModule } from "./family/family.module";
import { HealthModule } from "./health/health.module";
import { HttpBodyModule } from "./http/http-body.module";
import { PregnancyModule } from "./pregnancy/pregnancy.module";
import { areTestHttpRoutesEnabled } from "./test-http/test-http.config";
import { TestHttpModule } from "./test-http/test-http.module";

const optionalTestHttpModule: Type[] = areTestHttpRoutesEnabled()
  ? [TestHttpModule]
  : [];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),
    DatabaseModule,
    AuthModule,
    HttpBodyModule,
    FamilyModule,
    PregnancyModule,
    ...optionalTestHttpModule,
    HealthModule,
  ],
})
export class AppModule {}
