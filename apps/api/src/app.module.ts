import { Module, type Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { HttpBodyModule } from './http/http-body.module';
import { TestHttpModule } from './test-http/test-http.module';

const optionalTestHttpModule: Type[] =
  process.env.LUMORA_ENABLE_TEST_HTTP_ROUTES === 'true' ? [TestHttpModule] : [];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    AuthModule,
    HttpBodyModule,
    ...optionalTestHttpModule,
    HealthModule,
  ],
})
export class AppModule {}
