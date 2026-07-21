import { Module } from '@nestjs/common';

import { TestHttpController } from './test-http.controller';

@Module({
  controllers: [TestHttpController],
})
export class TestHttpModule {}
