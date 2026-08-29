import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  console.log('STEP 1: Creating pool...');

  const pool = new pg.Pool({
    connectionString: process.env.ADMIN_DATABASE_URL,
  });

  console.log('STEP 2: Creating Prisma...');

  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  });

  console.log('STEP 3: Running database query...');

  const tenants = await prisma.tenant.findMany({
    take: 1,
  });

  console.log('STEP 4: Query success');
  console.log('Tenants:', tenants);

  console.log('STEP 5: Closing...');

  await prisma.$disconnect();
  await pool.end();

  console.log('DONE');
}

main().catch((error) => {
  console.error('ERROR:', error);
  process.exit(1);
});