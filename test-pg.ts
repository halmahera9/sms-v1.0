import 'dotenv/config';
import pg from 'pg';

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.ADMIN_DATABASE_URL,
  });

  console.log('Pool created');

  await pool.end();

  console.log('Pool closed');
}

main().catch(console.error);