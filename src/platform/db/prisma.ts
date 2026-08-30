import 'server-only';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const prismaClientSingleton = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('SECURITY ERROR: DATABASE_URL environment variable is missing.');
  }
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
};

const adminPrismaClientSingleton = () => {
  const connectionString = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('SECURITY ERROR: ADMIN_DATABASE_URL environment variable is missing.');
  }
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
};

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: ReturnType<typeof prismaClientSingleton> | undefined;
  // eslint-disable-next-line no-var
  var adminPrismaGlobal: ReturnType<typeof adminPrismaClientSingleton> | undefined;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();
export const adminPrisma = globalThis.adminPrismaGlobal ?? adminPrismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
  globalThis.adminPrismaGlobal = adminPrisma;
}
