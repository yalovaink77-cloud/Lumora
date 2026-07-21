import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  assertDatabaseConfigured,
  checkDatabaseConnection,
  disconnectPrismaClient,
} from '@lumora/database';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  onModuleInit(): void {
    assertDatabaseConfigured();
  }

  async onModuleDestroy(): Promise<void> {
    await disconnectPrismaClient();
  }

  async isConnected(): Promise<boolean> {
    return checkDatabaseConnection();
  }
}
