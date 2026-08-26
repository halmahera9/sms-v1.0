const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const psqlPath = 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe';
const envPath = path.join(__dirname, '../.env');

function runQuery(db, sql, connectionUrl) {
  try {
    const args = [
      '-d', connectionUrl,
      '-t', '-A',
      '-c', sql
    ];
    return execFileSync(psqlPath, args, { encoding: 'utf8' }).trim();
  } catch (err) {
    throw new Error(`Query failed: ${err.message}`);
  }
}

function main() {
  if (!fs.existsSync(envPath)) {
    console.error('Error: .env file not found.');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/MIGRATION_DATABASE_URL="([^"]+)"/);
  if (!match) {
    console.error('Error: MIGRATION_DATABASE_URL not found in .env.');
    process.exit(1);
  }

  const connectionUrl = match[1].split('?')[0];
  let verdict = 'PASS';
  const failures = [];

  console.log('--- PHASE 4F-6 POST-MIGRATION PHYSICAL DATABASE AUDIT ---\n');

  try {
    // 1. Migration History
    console.log('Checking migration history...');
    const migrationApplied = runQuery('banyubiru', `
      SELECT applied_steps_count FROM _prisma_migrations 
      WHERE migration_name = '00000000000000_initial_schema_and_security';
    `, connectionUrl);
    if (migrationApplied !== '1') {
      verdict = 'FAIL';
      failures.push('Migration 00000000000000_initial_schema_and_security is not registered as applied.');
    } else {
      console.log('  [OK] Migration registered as applied.');
    }

    // 2. Expected 17 Domain Tables + _prisma_migrations
    console.log('Checking physical tables count...');
    const tablesList = runQuery('banyubiru', `
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' ORDER BY table_name;
    `, connectionUrl);
    const tables = tablesList.split(/\r?\n/).map(t => t.trim()).filter(Boolean);
    if (tables.length !== 18) { // 17 domain tables + 1 prisma system table
      verdict = 'FAIL';
      failures.push(`Expected 18 tables in schema public, found ${tables.length}: ${tables.join(', ')}`);
    } else {
      console.log('  [OK] Expected 17 domain tables + 1 prisma system table exist.');
    }

    // 3. Enums Count
    console.log('Checking native enums...');
    const enumsList = runQuery('banyubiru', `
      SELECT t.typname FROM pg_catalog.pg_type t 
      JOIN pg_catalog.pg_namespace n ON t.typnamespace = n.oid 
      WHERE n.nspname = 'public' AND t.typtype = 'e';
    `, connectionUrl);
    const enums = enumsList.split(/\r?\n/).map(e => e.trim()).filter(Boolean);
    if (enums.length !== 17) {
      verdict = 'FAIL';
      failures.push(`Expected 17 native enum types, found ${enums.length}: ${enums.join(', ')}`);
    } else {
      console.log('  [OK] Expected 17 native PostgreSQL enums exist.');
    }

    // 4. Foreign Keys count
    console.log('Checking foreign keys...');
    const fkList = runQuery('banyubiru', `
      SELECT conname FROM pg_catalog.pg_constraint WHERE contype = 'f';
    `, connectionUrl);
    const fks = fkList.split(/\r?\n/).map(f => f.trim()).filter(Boolean);
    if (fks.length !== 35) { // 23 composite + 12 tenant-root FKs
      verdict = 'FAIL';
      failures.push(`Expected 35 foreign keys, found ${fks.length}.`);
    } else {
      console.log('  [OK] Expected 35 foreign keys verified.');
    }

    // 5. Indexes count
    console.log('Checking indexes...');
    const indexList = runQuery('banyubiru', `
      SELECT indexname FROM pg_catalog.pg_indexes WHERE schemaname = 'public';
    `, connectionUrl);
    const indexes = indexList.split(/\r?\n/).map(i => i.trim()).filter(Boolean);
    // 18 table primary keys + 21 unique indexes + 14 compound performance indexes = 53 indexes
    if (indexes.length !== 53) {
      verdict = 'FAIL';
      failures.push(`Expected 53 indexes, found ${indexes.length}.`);
    } else {
      console.log('  [OK] Expected 53 indexes verified.');
    }

    // 6. Audit trigger immutability
    console.log('Checking audit immutability trigger...');
    const triggerExists = runQuery('banyubiru', `
      SELECT COUNT(*) FROM pg_catalog.pg_trigger 
      WHERE tgname = 'audit_events_immutability_trigger';
    `, connectionUrl);
    if (triggerExists !== '1') {
      verdict = 'FAIL';
      failures.push('Immutability trigger audit_events_immutability_trigger does not exist.');
    } else {
      console.log('  [OK] Immutability trigger exists.');
    }

    // 7. Context Function Security
    console.log('Checking set_tenant_context() security settings...');
    const funcData = runQuery('banyubiru', `
      SELECT prosecdef, proconfig FROM pg_catalog.pg_proc 
      JOIN pg_catalog.pg_namespace n ON pronamespace = n.oid 
      WHERE nspname = 'public' AND proname = 'set_tenant_context';
    `, connectionUrl);
    
    if (!funcData) {
      verdict = 'FAIL';
      failures.push('Function set_tenant_context does not exist.');
    } else {
      const [secdef, config] = funcData.split('|');
      if (secdef !== 't') {
        verdict = 'FAIL';
        failures.push('set_tenant_context is not SECURITY DEFINER.');
      }
      if (!config.includes('search_path=pg_catalog, public')) {
        verdict = 'FAIL';
        failures.push(`set_tenant_context search_path is not restricted. Got: ${config}`);
      }
      const publicExecute = runQuery('banyubiru', `
        SELECT has_function_privilege('public', 'set_tenant_context(UUID, UUID)', 'EXECUTE');
      `, connectionUrl);
      if (publicExecute !== 'f') {
        verdict = 'FAIL';
        failures.push('PUBLIC role still has EXECUTE privilege on set_tenant_context.');
      }
      console.log('  [OK] set_tenant_context() security settings and PUBLIC execution revocation verified.');
    }

    // 8. Row Level Security status on tables
    console.log('Checking Row Level Security (RLS) policies...');
    const rlsTables = runQuery('banyubiru', `
      SELECT COUNT(*) FROM pg_catalog.pg_tables 
      WHERE schemaname = 'public' AND rowsecurity = true;
    `, connectionUrl);
    if (rlsTables !== '17') {
      verdict = 'FAIL';
      failures.push(`Expected RLS enabled on 17 tables, found ${rlsTables}.`);
    } else {
      const policiesCount = runQuery('banyubiru', `
        SELECT COUNT(*) FROM pg_catalog.pg_policies WHERE schemaname = 'public';
      `, connectionUrl);
      // 17 app policies + 17 admin policies = 34 policies
      if (policiesCount !== '34') {
        verdict = 'FAIL';
        failures.push(`Expected 34 policies, found ${policiesCount}.`);
      } else {
        console.log('  [OK] RLS enabled on all 17 tables with 34 policies verified.');
      }
    }

    // 9. Schema public privileges
    console.log('Checking public schema privileges...');
    const publicSchemaPrivs = runQuery('banyubiru', `
      SELECT COUNT(*) FROM (
        SELECT (aclexplode(COALESCE(nspacl, acldefault('n', nspowner)))).*
        FROM pg_catalog.pg_namespace WHERE nspname = 'public'
      ) acl
      WHERE grantee = 0;
    `, connectionUrl);
    if (publicSchemaPrivs !== '0') {
      verdict = 'FAIL';
      failures.push(`PUBLIC retains privileges on schema public (Count: ${publicSchemaPrivs}).`);
    } else {
      const appUsage = runQuery('banyubiru', `SELECT has_schema_privilege('banyubiru_app', 'public', 'USAGE');`, connectionUrl);
      const adminUsage = runQuery('banyubiru', `SELECT has_schema_privilege('banyubiru_admin_app', 'public', 'USAGE');`, connectionUrl);
      const readonlyUsage = runQuery('banyubiru', `SELECT has_schema_privilege('banyubiru_readonly', 'public', 'USAGE');`, connectionUrl);
      if (appUsage !== 't' || adminUsage !== 't' || readonlyUsage !== 't') {
        verdict = 'FAIL';
        failures.push('Runtime roles missing USAGE privilege on schema public.');
      } else {
        console.log('  [OK] Schema public privileges verified.');
      }
    }

    // 10. Database banyubiru privileges
    console.log('Checking database connection privileges...');
    const publicDbPrivs = runQuery('banyubiru', `
      SELECT COUNT(*) FROM (
        SELECT (aclexplode(COALESCE(datacl, acldefault('d', datdba)))).*
        FROM pg_catalog.pg_database WHERE datname = 'banyubiru'
      ) acl
      WHERE grantee = 0;
    `, connectionUrl);
    if (publicDbPrivs !== '0') {
      verdict = 'FAIL';
      failures.push(`PUBLIC retains privileges on database banyubiru (Count: ${publicDbPrivs}).`);
    } else {
      const appConnect = runQuery('banyubiru', `SELECT has_database_privilege('banyubiru_app', 'banyubiru', 'CONNECT');`, connectionUrl);
      const adminConnect = runQuery('banyubiru', `SELECT has_database_privilege('banyubiru_admin_app', 'banyubiru', 'CONNECT');`, connectionUrl);
      const readonlyConnect = runQuery('banyubiru', `SELECT has_database_privilege('banyubiru_readonly', 'banyubiru', 'CONNECT');`, connectionUrl);
      if (appConnect !== 't' || adminConnect !== 't' || readonlyConnect !== 't') {
        verdict = 'FAIL';
        failures.push('Runtime roles missing CONNECT privilege on database.');
      } else {
        console.log('  [OK] Database privileges verified.');
      }
    }

    // 11. Role Attributes
    console.log('Checking role attributes...');
    const rolesData = runQuery('banyubiru', `
      SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
      FROM pg_catalog.pg_roles
      WHERE rolname IN ('banyubiru_migrator', 'banyubiru_app', 'banyubiru_admin_app', 'banyubiru_readonly')
      ORDER BY rolname;
    `, connectionUrl);
    const roleLines = rolesData.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (roleLines.length !== 4) {
      verdict = 'FAIL';
      failures.push(`Expected 4 roles, found ${roleLines.length}.`);
    } else {
      const expectedAttrs = {
        'banyubiru_migrator':  'banyubiru_migrator|t|f|f|f|t',
        'banyubiru_app':        'banyubiru_app|t|f|f|f|f',
        'banyubiru_admin_app':  'banyubiru_admin_app|t|f|f|f|f',
        'banyubiru_readonly':   'banyubiru_readonly|t|f|f|f|f'
      };
      for (const line of roleLines) {
        const [name] = line.split('|');
        if (line !== expectedAttrs[name]) {
          verdict = 'FAIL';
          failures.push(`Role attribute drift on ${name}. Got: ${line}`);
        }
      }
      console.log('  [OK] Role attributes verified.');
    }

    // 12. Ownership
    console.log('Checking database and schema ownership...');
    const dbOwner = runQuery('postgres', `
      SELECT r.rolname FROM pg_catalog.pg_database d
      JOIN pg_catalog.pg_roles r ON d.datdba = r.oid
      WHERE d.datname = 'banyubiru';
    `, connectionUrl);
    const schemaOwner = runQuery('banyubiru', `
      SELECT r.rolname FROM pg_catalog.pg_namespace n
      JOIN pg_catalog.pg_roles r ON n.nspowner = r.oid
      WHERE n.nspname = 'public';
    `, connectionUrl);
    if (dbOwner !== 'banyubiru_migrator' || schemaOwner !== 'banyubiru_migrator') {
      verdict = 'FAIL';
      failures.push(`Ownership drift. DB Owner: ${dbOwner}, Schema Owner: ${schemaOwner}`);
    } else {
      const tableOwners = runQuery('banyubiru', `
        SELECT tableowner FROM pg_catalog.pg_tables 
        WHERE schemaname = 'public' AND tablename != '_prisma_migrations';
      `, connectionUrl);
      const owners = tableOwners.split(/\r?\n/).map(o => o.trim()).filter(Boolean);
      const nonMigratorOwned = owners.filter(o => o !== 'banyubiru_migrator');
      if (nonMigratorOwned.length > 0) {
        verdict = 'FAIL';
        failures.push(`Unexpected table ownership. Found ${nonMigratorOwned.length} tables not owned by banyubiru_migrator.`);
      } else {
        console.log('  [OK] Database, Schema, and all domain tables owned by banyubiru_migrator.');
      }
    }

    // 13. Audit Event Immutability Function and Trigger Attachment
    console.log('Checking audit event immutability triggers...');
    const triggerDetails = runQuery('banyubiru', `
      SELECT COUNT(*) FROM pg_catalog.pg_trigger t
      JOIN pg_catalog.pg_class c ON t.tgrelid = c.oid
      WHERE c.relname = 'audit_events' AND t.tgname = 'audit_events_immutability_trigger';
    `, connectionUrl);
    if (triggerDetails !== '1') {
      verdict = 'FAIL';
      failures.push('Immutability trigger is not correctly attached to audit_events table.');
    } else {
      console.log('  [OK] Audit events immutability verified.');
    }

  } catch (err) {
    verdict = 'FAIL';
    failures.push(`Exception occurred during verification: ${err.message}`);
  }

  console.log('\n--- VERIFICATION RESULT ---');
  if (verdict === 'PASS') {
    console.log('PHASE 4F-6 VERDICT: PASS');
  } else {
    console.log('PHASE 4F-6 VERDICT: FAIL');
    console.log('Reasons for failure:');
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }
}

main();
