const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

// 1. Generate 24 random bytes (192 bits of entropy), encoded in hex
const newPassword = crypto.randomBytes(24).toString('hex');

// 2. Read and update .env securely
const envPath = path.join(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env file not found.');
  process.exit(1);
}

let envContent = fs.readFileSync(envPath, 'utf8');

// Regex to match MIGRATION_DATABASE_URL
const urlRegex = /MIGRATION_DATABASE_URL="postgresql:\/\/([^:]+):([^@]+)@([^"]+)"/;
const match = envContent.match(urlRegex);

if (!match) {
  console.error('Error: MIGRATION_DATABASE_URL not found in .env.');
  process.exit(1);
}

const username = match[1];
const hostAndDb = match[3];

// Construct new URL
const newUrl = `MIGRATION_DATABASE_URL="postgresql://${username}:${newPassword}@${hostAndDb}"`;
envContent = envContent.replace(urlRegex, newUrl);
fs.writeFileSync(envPath, envContent, 'utf8');
console.log('SUCCESS: MIGRATION_DATABASE_URL updated securely in .env with a new random credential.');

// 3. Inform the user how to apply this to the database, or attempt to do it automatically if PG_ADMIN_PASSWORD is set
const adminPassword = process.env.PG_ADMIN_PASSWORD;
if (adminPassword) {
  console.log('Attempting to apply password rotation to PostgreSQL database...');
  const client = new Client({
    connectionString: `postgresql://postgres:${adminPassword}@localhost:5432/postgres`
  });

  client.connect()
    .then(() => client.query(`ALTER ROLE ${username} WITH PASSWORD '${newPassword}';`))
    .then(() => {
      console.log(`DATABASE SUCCESS: Role ${username} password rotated in PostgreSQL.`);
      client.end();
      testConnectivity();
    })
    .catch((err) => {
      console.error('DATABASE ERROR: Failed to apply rotation to PostgreSQL:', err.message);
      client.end();
    });
} else {
  console.log('\n--- MANUAL ACTION REQUIRED ---');
  console.log('Please execute the following SQL command in your psql administrative console (as postgres user) to apply the new password:');
  console.log(`ALTER ROLE ${username} WITH PASSWORD '<new_password_from_env>';`);
  console.log('-------------------------------\n');
}

// 4. Verification function (non-destructive SELECT 1)
function testConnectivity() {
  const testClient = new Client({
    connectionString: `postgresql://${username}:${newPassword}@localhost:5432/banyubiru`
  });

  testClient.connect()
    .then(() => testClient.query('SELECT 1;'))
    .then(() => {
      console.log('VERIFICATION SUCCESS: Connection to banyubiru database as banyubiru_migrator is successful!');
      testClient.end();
    })
    .catch((err) => {
      console.error('VERIFICATION FAILED:', err.message);
      testClient.end();
    });
}
