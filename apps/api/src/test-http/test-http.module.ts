import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { TestHttpController } from './test-http.controller';

@Module({
  imports: [AuthModule],
  controllers: [TestHttpController],
})
export class TestHttpModule {}
