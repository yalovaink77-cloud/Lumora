import { Controller, Get } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get()
  async check(): Promise<{
    status: string;
    checks: {
      database: string;
    };
  }> {
    const databaseConnected = await this.databaseService.isConnected();

    return {
      status: databaseConnected ? 'ok' : 'degraded',
      checks: {
        database: databaseConnected ? 'ok' : 'error',
      },
    };
  }
}
