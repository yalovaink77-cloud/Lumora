import { PrismaClient } from '@prisma/client';

type PrismaGlobal = typeof globalThis & {
  __lumoraPrismaClient?: PrismaClient | undefined;
};

const globalForPrisma = globalThis as PrismaGlobal;

function createClient(): PrismaClient {
  return new PrismaClient();
}

export function assertDatabaseConfigured(): void {
  const databaseUrl = process.env.DATABASE_URL;

  if (typeof databaseUrl !== 'string' || databaseUrl.trim().length === 0) {
    throw new Error('DATABASE_URL is required but was not provided.');
  }
}

export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.__lumoraPrismaClient) {
    globalForPrisma.__lumoraPrismaClient = createClient();
  }

  return globalForPrisma.__lumoraPrismaClient;
}

export async function connectPrismaClient(): Promise<void> {
  await getPrismaClient().$connect();
}

export async function disconnectPrismaClient(): Promise<void> {
  const client = globalForPrisma.__lumoraPrismaClient;

  if (client) {
    await client.$disconnect();
    globalForPrisma.__lumoraPrismaClient = undefined;
  }
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await getPrismaClient().$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export { PrismaClient };
