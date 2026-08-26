const { Client } = require('pg');

async function testConnection() {
  const connectionString = process.env.MIGRATION_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
  console.log('Testing PostgreSQL connection to:', connectionString.replace(/:[^:@]+@/, ':****@'));
  
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const res = await client.query('SELECT version();');
    console.log('SUCCESS: Connected to PostgreSQL!');
    console.log('Version:', res.rows[0].version);
    await client.end();
    return true;
  } catch (err) {
    console.log('FAILED: Connection error:', err.message);
    return false;
  }
}

testConnection();
