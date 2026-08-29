import 'dotenv/config';
import pg from 'pg';

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.ADMIN_DATABASE_URL,
  });

  console.log('Pool created');

  const result = await pool.query('SELECT 1 AS ok');

  console.log('Query result:', result.rows);

  await pool.end();

  console.log('Pool closed');
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});