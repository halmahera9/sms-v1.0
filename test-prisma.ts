import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.ADMIN_DATABASE_URL,
  });

  console.log('Pool OK');

  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  });

  console.log('Prisma OK');

  await prisma.$disconnect();
  await pool.end();

  console.log('Closed OK');
}

main().catch(console.error);