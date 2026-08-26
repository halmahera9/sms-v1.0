const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const psqlPath = 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe';
const envPath = path.join(__dirname, '../.env');
const hex48Regex = /^[0-9a-f]{48}$/;

function validateAndGetPassword(match, roleName) {
  if (!match) {
    throw new Error(`Security Error: Required environment variable for ${roleName} is missing from .env. Fail-closed.`);
  }
  const password = match[1];
  if (!hex48Regex.test(password)) {
    throw new Error(`Security Error: Existing password for ${roleName} does not match the expected 48-character lowercase hexadecimal format. Fail-closed to prevent SQL injection.`);
  }
  return password;
}

function runPsql(db, sqlCommand, adminPassword, useStdin = false) {
  try {
    const args = [
      '-U', 'postgres',
      '-h', 'localhost',
      '-d', db,
      '-t', '-A'
    ];
    const options = {
      env: { ...process.env, PGPASSWORD: adminPassword },
      encoding: 'utf8'
    };
    if (useStdin) {
      options.input = sqlCommand;
    } else {
      args.push('-c', sqlCommand);
    }
    return execFileSync(psqlPath, args, options).trim();
  } catch (err) {
    throw new Error(`psql execution failed: ${err.message}`);
  }
}

function verifyPostProvision(adminPassword) {
  console.log('Running post-provision security verification...');

  // 1. Verify Database Owner
  const dbOwner = runPsql('postgres', `
    SELECT r.rolname FROM pg_catalog.pg_database d
    JOIN pg_catalog.pg_roles r ON d.datdba = r.oid
    WHERE d.datname = 'banyubiru';
  `, adminPassword);
  if (dbOwner !== 'banyubiru_migrator') {
    throw new Error(`Security Verification Failed: Database banyubiru owner is '${dbOwner}', expected 'banyubiru_migrator'.`);
  }
  console.log('- Database owner verified as banyubiru_migrator.');

  // 2. Verify Schema Owner
  const schemaOwner = runPsql('banyubiru', `
    SELECT r.rolname FROM pg_catalog.pg_namespace n
    JOIN pg_catalog.pg_roles r ON n.nspowner = r.oid
    WHERE n.nspname = 'public';
  `, adminPassword);
  if (schemaOwner !== 'banyubiru_migrator') {
    throw new Error(`Security Verification Failed: Schema public owner is '${schemaOwner}', expected 'banyubiru_migrator'.`);
  }
  console.log('- Schema public owner verified as banyubiru_migrator.');

  // 3. Verify Roles Exist and Have Correct Attributes
  const rolesData = runPsql('banyubiru', `
    SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
    FROM pg_catalog.pg_roles
    WHERE rolname IN ('banyubiru_migrator', 'banyubiru_app', 'banyubiru_admin_app', 'banyubiru_readonly')
    ORDER BY rolname;
  `, adminPassword);
  
  const lines = rolesData.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length !== 4) {
    throw new Error(`Security Verification Failed: Expected 4 Banyubiru roles, found ${lines.length}.`);
  }

  const expectedAttrs = {
    'banyubiru_migrator':  { login: 't', super: 'f', createdb: 'f', createrole: 'f', bypassrls: 't' },
    'banyubiru_app':        { login: 't', super: 'f', createdb: 'f', createrole: 'f', bypassrls: 'f' },
    'banyubiru_admin_app':  { login: 't', super: 'f', createdb: 'f', createrole: 'f', bypassrls: 'f' },
    'banyubiru_readonly':   { login: 't', super: 'f', createdb: 'f', createrole: 'f', bypassrls: 'f' }
  };

  for (const line of lines) {
    const parts = line.split('|');
    if (parts.length < 6) {
      throw new Error(`Security Verification Failed: Malformed pg_roles response line: ${line}`);
    }
    const [name, login, superUser, createdb, createrole, bypassrls] = parts;
    const expected = expectedAttrs[name];
    if (!expected) {
      throw new Error(`Security Verification Failed: Unexpected role '${name}' audited.`);
    }
    if (login !== expected.login || superUser !== expected.super || createdb !== expected.createdb || createrole !== expected.createrole || bypassrls !== expected.bypassrls) {
      throw new Error(`Security Verification Failed: Attribute drift detected on role ${name}. Expected: login=${expected.login}, super=${expected.super}, createdb=${expected.createdb}, createrole=${expected.createrole}, bypassrls=${expected.bypassrls}. Got: login=${login}, super=${superUser}, createdb=${createdb}, createrole=${createrole}, bypassrls=${bypassrls}`);
    }
  }
  console.log('- Role attributes and privilege boundaries verified.');

  // 4. Verify No Unexpected Memberships
  const membershipCount = runPsql('banyubiru', `
    SELECT COUNT(*) FROM pg_catalog.pg_auth_members m
    JOIN pg_catalog.pg_roles r1 ON m.roleid = r1.oid
    JOIN pg_catalog.pg_roles r2 ON m.member = r2.oid
    WHERE r1.rolname IN ('banyubiru_migrator', 'banyubiru_app', 'banyubiru_admin_app', 'banyubiru_readonly')
       OR r2.rolname IN ('banyubiru_migrator', 'banyubiru_app', 'banyubiru_admin_app', 'banyubiru_readonly');
  `, adminPassword);
  if (membershipCount !== '0') {
    throw new Error(`Security Verification Failed: Unexpected active role memberships detected (${membershipCount}) for Banyubiru roles.`);
  }
  console.log('- Role isolation (pg_auth_members) verified.');

  // 5. Verify Database PUBLIC Privilege Revocation (Checks datacl where grantee=0/PUBLIC)
  const publicDbPrivsCount = runPsql('banyubiru', `
    SELECT COUNT(*) FROM (
      SELECT (aclexplode(COALESCE(datacl, acldefault('d', datdba)))).*
      FROM pg_catalog.pg_database WHERE datname = 'banyubiru'
    ) acl
    WHERE grantee = 0;
  `, adminPassword);
  if (publicDbPrivsCount !== '0') {
    throw new Error(`Security Verification Failed: PUBLIC still retains database privileges on banyubiru (Count: ${publicDbPrivsCount}).`);
  }
  console.log('- Database PUBLIC privilege revocation verified (no CONNECT, CREATE, or TEMP).');

  const appConnect = runPsql('banyubiru', `SELECT has_database_privilege('banyubiru_app', 'banyubiru', 'CONNECT');`, adminPassword);
  const adminConnect = runPsql('banyubiru', `SELECT has_database_privilege('banyubiru_admin_app', 'banyubiru', 'CONNECT');`, adminPassword);
  const readonlyConnect = runPsql('banyubiru', `SELECT has_database_privilege('banyubiru_readonly', 'banyubiru', 'CONNECT');`, adminPassword);
  
  if (appConnect !== 't' || adminConnect !== 't' || readonlyConnect !== 't') {
    throw new Error(`Security Verification Failed: CONNECT privilege missing for runtime roles. App: ${appConnect}, Admin: ${adminConnect}, Readonly: ${readonlyConnect}`);
  }
  console.log('- Runtime roles CONNECT privileges verified.');

  // 6. Verify Schema PUBLIC Privilege Revocation (Checks nspacl where grantee=0/PUBLIC)
  const publicSchemaPrivsCount = runPsql('banyubiru', `
    SELECT COUNT(*) FROM (
      SELECT (aclexplode(COALESCE(nspacl, acldefault('n', nspowner)))).*
      FROM pg_catalog.pg_namespace WHERE nspname = 'public'
    ) acl
    WHERE grantee = 0;
  `, adminPassword);
  if (publicSchemaPrivsCount !== '0') {
    throw new Error(`Security Verification Failed: PUBLIC still retains schema privileges on public (Count: ${publicSchemaPrivsCount}).`);
  }
  console.log('- Schema public PUBLIC privilege revocation verified (no USAGE or CREATE).');

  const appUsage = runPsql('banyubiru', `SELECT has_schema_privilege('banyubiru_app', 'public', 'USAGE');`, adminPassword);
  const adminUsage = runPsql('banyubiru', `SELECT has_schema_privilege('banyubiru_admin_app', 'public', 'USAGE');`, adminPassword);
  const readonlyUsage = runPsql('banyubiru', `SELECT has_schema_privilege('banyubiru_readonly', 'public', 'USAGE');`, adminPassword);

  if (appUsage !== 't' || adminUsage !== 't' || readonlyUsage !== 't') {
    throw new Error(`Security Verification Failed: USAGE privilege on schema public missing for runtime roles. App: ${appUsage}, Admin: ${adminUsage}, Readonly: ${readonlyUsage}`);
  }
  console.log('- Runtime roles public schema USAGE privileges verified.');

  console.log('VERIFICATION SUCCESS: All post-provision security checks passed.');
}

function main() {
  const adminPassword = process.env.PG_ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('Security Error: Environment variable PG_ADMIN_PASSWORD is not set.');
    process.exit(1);
  }

  // 1. Read existing .env and extract existing passwords to maintain idempotency
  if (!fs.existsSync(envPath)) {
    console.error('Error: .env file not found.');
    process.exit(1);
  }

  let envContent = fs.readFileSync(envPath, 'utf8');

  // Regex to extract passwords
  const appMatch = envContent.match(/DATABASE_URL="postgresql:\/\/banyubiru_app:([^@]+)@localhost/);
  const migratorMatch = envContent.match(/MIGRATION_DATABASE_URL="postgresql:\/\/banyubiru_migrator:([^@]+)@localhost/);
  const adminMatch = envContent.match(/ADMIN_DATABASE_URL="postgresql:\/\/banyubiru_admin_app:([^@]+)@localhost/);
  const readonlyMatch = envContent.match(/READONLY_DATABASE_URL="postgresql:\/\/banyubiru_readonly:([^@]+)@localhost/);

  let appPass, migratorPass, adminPass, readonlyPass;
  try {
    appPass = validateAndGetPassword(appMatch, 'DATABASE_URL (banyubiru_app)');
    migratorPass = validateAndGetPassword(migratorMatch, 'MIGRATION_DATABASE_URL (banyubiru_migrator)');
    adminPass = validateAndGetPassword(adminMatch, 'ADMIN_DATABASE_URL (banyubiru_admin_app)');
    readonlyPass = validateAndGetPassword(readonlyMatch, 'READONLY_DATABASE_URL (banyubiru_readonly)');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  // 2. Connect to postgres DB to verify / create banyubiru database
  console.log('Verifying database banyubiru...');
  const dbExists = runPsql('postgres', "SELECT 1 FROM pg_database WHERE datname='banyubiru';", adminPassword);
  
  if (dbExists !== '1') {
    console.log('Creating database banyubiru...');
    runPsql('postgres', 'CREATE DATABASE banyubiru;', adminPassword);
  }

  // 3. Perform read-only check for unexpected role memberships
  console.log('Auditing role memberships for unexpected inheritance...');
  const membershipCheckSql = `
    SELECT COUNT(*) FROM pg_catalog.pg_auth_members m
    JOIN pg_catalog.pg_roles r1 ON m.roleid = r1.oid
    JOIN pg_catalog.pg_roles r2 ON m.member = r2.oid
    WHERE r1.rolname IN ('banyubiru_migrator', 'banyubiru_app', 'banyubiru_admin_app', 'banyubiru_readonly')
       OR r2.rolname IN ('banyubiru_migrator', 'banyubiru_app', 'banyubiru_admin_app', 'banyubiru_readonly');
  `;
  const membershipCount = runPsql('banyubiru', membershipCheckSql, adminPassword);
  if (membershipCount !== '0') {
    console.error('Security Error: Unexpected active role memberships detected for Banyubiru database roles in pg_auth_members. Fail-closed.');
    process.exit(1);
  }

  // 4. Create / Update database roles with explicit attributes (Idempotent passwords for all roles via STDIN)
  console.log('Provisioning and updating database roles with privilege bounds via secure STDIN channel...');
  const roleSql = `
  DO $$
  BEGIN
    -- 1. banyubiru_migrator (Idempotent)
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'banyubiru_migrator') THEN
      CREATE ROLE banyubiru_migrator WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS PASSWORD '${migratorPass}';
    ELSE
      ALTER ROLE banyubiru_migrator WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS PASSWORD '${migratorPass}';
    END IF;

    -- 2. banyubiru_app (Idempotent)
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'banyubiru_app') THEN
      CREATE ROLE banyubiru_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${appPass}';
    ELSE
      ALTER ROLE banyubiru_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${appPass}';
    END IF;

    -- 3. banyubiru_admin_app (Idempotent)
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'banyubiru_admin_app') THEN
      CREATE ROLE banyubiru_admin_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${adminPass}';
    ELSE
      ALTER ROLE banyubiru_admin_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${adminPass}';
    END IF;

    -- 4. banyubiru_readonly (Idempotent)
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'banyubiru_readonly') THEN
      CREATE ROLE banyubiru_readonly WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${readonlyPass}';
    ELSE
      ALTER ROLE banyubiru_readonly WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${readonlyPass}';
    END IF;
  END
  $$;
  `;
  runPsql('banyubiru', roleSql, adminPassword, true);

  // 5. Establish explicit Database and Schema Ownership to banyubiru_migrator
  console.log('Establishing database and schema ownership boundaries...');
  runPsql('postgres', 'ALTER DATABASE banyubiru OWNER TO banyubiru_migrator;', adminPassword);
  runPsql('banyubiru', 'ALTER SCHEMA public OWNER TO banyubiru_migrator;', adminPassword);

  // 6. Apply Revoke / Grant privilege boundaries, database CONNECT, and schema USAGE
  console.log('Enforcing privilege boundaries and database/schema PUBLIC revocation...');
  const privilegeSql = `
    REVOKE ALL ON DATABASE banyubiru FROM PUBLIC;
    GRANT CONNECT ON DATABASE banyubiru TO banyubiru_app, banyubiru_admin_app, banyubiru_readonly;
    REVOKE ALL ON SCHEMA public FROM PUBLIC;
    GRANT USAGE ON SCHEMA public TO banyubiru_app, banyubiru_admin_app, banyubiru_readonly;
  `;
  runPsql('banyubiru', privilegeSql, adminPassword);

  // 7. Perform Post-Provision Security Verification
  verifyPostProvision(adminPassword);

  // 8. Update .env lines preserving unrelated variables
  console.log('Updating .env configuration...');
  let lines = envContent.split(/\r?\n/);
  lines = lines.map(line => {
    if (line.startsWith('DATABASE_URL=')) {
      return `DATABASE_URL="postgresql://banyubiru_app:${appPass}@localhost:5432/banyubiru?schema=public"`;
    }
    if (line.startsWith('MIGRATION_DATABASE_URL=')) {
      return `MIGRATION_DATABASE_URL="postgresql://banyubiru_migrator:${migratorPass}@localhost:5432/banyubiru?schema=public"`;
    }
    if (line.startsWith('ADMIN_DATABASE_URL=')) {
      return `ADMIN_DATABASE_URL="postgresql://banyubiru_admin_app:${adminPass}@localhost:5432/banyubiru?schema=public"`;
    }
    if (line.startsWith('READONLY_DATABASE_URL=')) {
      return `READONLY_DATABASE_URL="postgresql://banyubiru_readonly:${readonlyPass}@localhost:5432/banyubiru?schema=public"`;
    }
    return line;
  });

  fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
  console.log('SUCCESS: Local secrets updated in .env.');

  // 9. Perform non-destructive authentication test as banyubiru_migrator
  console.log('Testing connectivity as banyubiru_migrator...');
  try {
    const testResult = execFileSync(psqlPath, [
      '-U', 'banyubiru_migrator',
      '-h', 'localhost',
      '-d', 'banyubiru',
      '-t', '-A',
      '-c', 'SELECT 1;'
    ], {
      env: { ...process.env, PGPASSWORD: migratorPass },
      encoding: 'utf8'
    }).trim();

    if (testResult === '1') {
      console.log('VERIFICATION SUCCESS: Connection to database as banyubiru_migrator is successful!');
    } else {
      console.error('VERIFICATION FAILED: Unexpected query result.');
    }
  } catch (err) {
    console.error('VERIFICATION FAILED:', err.message);
  }
}

main();
