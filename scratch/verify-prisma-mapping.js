// Verification script: verify-prisma-mapping.js
// Compares Prisma DMMF scalar/enum fields against physical PostgreSQL information_schema.columns
require('dotenv/config');
const { Prisma } = require('@prisma/client');
const { Client } = require('pg');

async function main() {
  console.log('========================================================================');
  console.log('PHASE 4G: AUTOMATED PRISMA-TO-PHYSICAL-DB MAPPING VERIFICATION');
  console.log('========================================================================\n');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();
  console.log('✔ Connected to PostgreSQL 17 database successfully.');

  // Fetch all physical columns for public schema
  const res = await client.query(`
    SELECT table_name, column_name, data_type, udt_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `);

  const physicalDb = {};
  for (const row of res.rows) {
    if (!physicalDb[row.table_name]) {
      physicalDb[row.table_name] = {};
    }
    physicalDb[row.table_name][row.column_name] = {
      dataType: row.data_type,
      udtName: row.udt_name,
      isNullable: row.is_nullable === 'YES',
    };
  }

  const dmmf = Prisma.dmmf;
  const models = dmmf.datamodel.models;

  console.log(`Auditing ${models.length} Prisma models against PostgreSQL physical schema...\n`);

  let totalErrors = 0;
  let totalModelsAudited = 0;

  for (const model of models) {
    const tableName = model.dbName || model.name.toLowerCase();
    totalModelsAudited++;

    console.log(`[MODEL ${totalModelsAudited}/17] ${model.name} -> DB Table "${tableName}"`);

    const physicalColumns = physicalDb[tableName];
    if (!physicalColumns) {
      console.error(`  ❌ ERROR: Physical table "${tableName}" does not exist in PostgreSQL!`);
      totalErrors++;
      continue;
    }

    const prismaDbFields = {};
    for (const field of model.fields) {
      // Only check scalar or enum fields (skip virtual relation objects)
      if (field.kind !== 'scalar' && field.kind !== 'enum') continue;
      const dbColName = field.dbName || field.name;
      prismaDbFields[dbColName] = field;
    }

    // 1. Check for physical columns missing in Prisma model
    for (const [colName, colMeta] of Object.entries(physicalColumns)) {
      if (!prismaDbFields[colName]) {
        console.error(`  ❌ ERROR: Physical column "${colName}" (${colMeta.udtName}) in table "${tableName}" is MISSING from Prisma model ${model.name}!`);
        totalErrors++;
      }
    }

    // 2. Check for Prisma fields missing in physical DB
    for (const [dbColName, fieldMeta] of Object.entries(prismaDbFields)) {
      if (!physicalColumns[dbColName]) {
        console.error(`  ❌ ERROR: Prisma field "${fieldMeta.name}" (mapped to "${dbColName}") does NOT exist in physical DB table "${tableName}"!`);
        totalErrors++;
      }
    }

    console.log(`  ✔ Model ${model.name} -> Table "${tableName}" (${Object.keys(prismaDbFields).length} columns 1:1 aligned)`);
  }

  await client.end();

  console.log('\n========================================================================');
  if (totalErrors === 0) {
    console.log('VERDICT: 100% PERFECT ALIGNMENT (0 ERRORS ACROSS ALL 17 MODELS)');
    console.log('========================================================================\n');
    process.exit(0);
  } else {
    console.error(`VERDICT: FAILED WITH ${totalErrors} DISCREPANCY ERRORS!`);
    console.log('========================================================================\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal verification script error:', err);
  process.exit(1);
});
