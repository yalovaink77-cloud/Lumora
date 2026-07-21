import { Body, Controller, HttpCode, Post } from '@nestjs/common';

@Controller('__test')
export class TestHttpController {
  @Post('echo-json')
  @HttpCode(201)
  echoJson(@Body() body: Record<string, unknown>): { received: Record<string, unknown> } {
    return {
      received: body,
    };
  }
}
