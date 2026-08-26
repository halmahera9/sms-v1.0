const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function generateSecurePassword() {
  // Generate 24 random bytes (192 bits of entropy), encoded in hex
  return crypto.randomBytes(24).toString('hex');
}

function rotateSecrets() {
  const envPath = path.join(__dirname, '../.env');
  if (!fs.existsSync(envPath)) {
    console.error('Error: .env file not found.');
    process.exit(1);
  }

  const appPass = generateSecurePassword();
  const migratorPass = generateSecurePassword();
  const adminPass = generateSecurePassword();
  const readonlyPass = generateSecurePassword();

  const newEnvContent = `# PostgreSQL Database URLs for Banyubiru Development Instance
# Security Note: This file is excluded from git version control via .gitignore

# Primary Application Connection URL (Role: banyubiru_app - DML Subject to RLS)
DATABASE_URL="postgresql://banyubiru_app:${appPass}@localhost:5432/banyubiru?schema=public"

# Database Migration Connection URL (Role: banyubiru_migrator - DDL Owner & Schema Admin)
MIGRATION_DATABASE_URL="postgresql://banyubiru_migrator:${migratorPass}@localhost:5432/banyubiru?schema=public"

# Platform Admin Connection URL (Role: banyubiru_admin_app - Isolated Admin Pool)
ADMIN_DATABASE_URL="postgresql://banyubiru_admin_app:${adminPass}@localhost:5432/banyubiru?schema=public"

# Analytics & Reporting Connection URL (Role: banyubiru_readonly - Read Only DML)
READONLY_DATABASE_URL="postgresql://banyubiru_readonly:${readonlyPass}@localhost:5432/banyubiru?schema=public"
`;

  fs.writeFileSync(envPath, newEnvContent, 'utf8');
  console.log('SUCCESS: All 4 database role passwords have been rotated securely in .env.');
}

rotateSecrets();
