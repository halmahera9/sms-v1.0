import 'dotenv/config';
import pg from 'pg';
import { LetterTemplate } from '@prisma/client';
import { PostgresLetterTemplateRepository } from '../src/platform/repositories/letter-template';

const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!migrationUrl) {
  throw new Error('SECURITY ERROR: MIGRATION_DATABASE_URL environment variable is missing.');
}
const migrationPool = new pg.Pool({ connectionString: migrationUrl });

const repository = new PostgresLetterTemplateRepository();

const TENANT_A_ID = '66666666-6666-4666-8666-666666666666';
const TENANT_B_ID = '77777777-7777-4777-8777-777777777777';

const ACTOR_A_ID = 'a6666666-6666-4666-8666-666666666666';
const ACTOR_B_ID = 'b7777777-7777-4777-8777-777777777777';

const TMPL_1_ID = 'c1111111-1111-4111-8111-111111111111';
const TMPL_2_ID = 'c2222222-2222-4222-8222-222222222222';
const TMPL_B1_ID = 'c3333333-3333-4333-8333-333333333333';

let testCount = 0;
let passCount = 0;
const results: { test: string; status: 'PASS' | 'FAIL'; detail?: string }[] = [];

function assert(condition: boolean, message: string, detail?: string) {
  testCount++;
  if (condition) {
    passCount++;
    results.push({ test: message, status: 'PASS', detail });
    console.log(`  ✓ Test ${testCount}: ${message}`);
  } else {
    results.push({ test: message, status: 'FAIL', detail: detail || 'Assertion failed' });
    console.error(`  ✗ Test ${testCount} FAILED: ${message} (${detail || ''})`);
  }
}

async function cleanupFixtures() {
  try {
    await migrationPool.query(
      `DELETE FROM letter_templates WHERE id IN ('${TMPL_1_ID}', '${TMPL_2_ID}', '${TMPL_B1_ID}');`
    );
    await migrationPool.query(
      `DELETE FROM user_actors WHERE id IN ('${ACTOR_A_ID}', '${ACTOR_B_ID}');`
    );
    await migrationPool.query(
      `DELETE FROM tenants WHERE id IN ('${TENANT_A_ID}', '${TENANT_B_ID}');`
    );
  } catch (err) {
    console.warn('Cleanup warning:', (err as Error).message);
  }
}

async function setupFixtures() {
  await cleanupFixtures();

  await migrationPool.query(`
    INSERT INTO tenants (id, code, name, status, created_at, updated_at) VALUES
    ('${TENANT_A_ID}', 'TMPL-TENANT-A', 'Template Test Tenant A', 'ACTIVE', NOW(), NOW()),
    ('${TENANT_B_ID}', 'TMPL-TENANT-B', 'Template Test Tenant B', 'ACTIVE', NOW(), NOW());
  `);

  await migrationPool.query(`
    INSERT INTO user_actors (id, tenant_id, username, email, full_name, role, status, created_at, updated_at) VALUES
    ('${ACTOR_A_ID}', '${TENANT_A_ID}', 'tmpl_actor_a', 'tmpl_actor_a@test.local', 'Tmpl Actor A', 'OPERATOR', 'ACTIVE', NOW(), NOW()),
    ('${ACTOR_B_ID}', '${TENANT_B_ID}', 'tmpl_actor_b', 'tmpl_actor_b@test.local', 'Tmpl Actor B', 'OPERATOR', 'ACTIVE', NOW(), NOW());
  `);

  await migrationPool.query(`
    INSERT INTO letter_templates (id, tenant_id, kode_template, nama_template, jenis_surat, isi_template, variabel, is_active, created_at, updated_at) VALUES
    ('${TMPL_1_ID}', '${TENANT_A_ID}', 'ST-01', 'Surat Tugas Guru', 'Surat Tugas', 'Tugas untuk {{guru.nama_lengkap}}', '["guru.nama_lengkap", "guru.nip"]'::jsonb, true, NOW(), NOW()),
    ('${TMPL_B1_ID}', '${TENANT_B_ID}', 'ST-01', 'Surat Tugas B', 'Surat Tugas', 'Tugas Tenant B', '["guru.nama_lengkap"]'::jsonb, true, NOW(), NOW());
  `);
}

async function runTests() {
  console.log('===========================================================');
  console.log('  BANYUBIRU POSTGRES LETTER TEMPLATE REPOSITORY TESTS      ');
  console.log('===========================================================\n');

  try {
    await setupFixtures();

    // 1. findByIdInContext
    const tmpl1 = await repository.findByIdInContext(ACTOR_A_ID, TENANT_A_ID, TMPL_1_ID);
    assert(
      tmpl1 !== null && tmpl1.id === TMPL_1_ID && tmpl1.code === 'ST-01',
      'TEST 1: findByIdInContext retrieves letter template in Tenant A'
    );

    // 2. findByCodeTx via context
    const tenantATemplates = await repository.findAllInContext(ACTOR_A_ID, TENANT_A_ID);
    const hasTmpl1 = tenantATemplates.some((t) => t.id === TMPL_1_ID);
    const hasTmplB1 = tenantATemplates.some((t) => t.id === TMPL_B1_ID);
    assert(
      hasTmpl1 && !hasTmplB1,
      'TEST 2: findAllInContext isolates templates strictly by tenant'
    );

    // 3. saveInContext CREATE
    const newTmpl: LetterTemplate = {
      id: TMPL_2_ID,
      tenantId: TENANT_A_ID,
      code: 'SK-01',
      name: 'Surat Keterangan Siswa Aktif',
      letterType: 'Surat Keterangan',
      content: 'Menerangkan bahwa {{siswa.nama_lengkap}} aktif di kelas {{siswa.kelas}}',
      variables: ['siswa.nama_lengkap', 'siswa.nisn', 'siswa.kelas'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const created = await repository.saveInContext(ACTOR_A_ID, TENANT_A_ID, newTmpl);
    assert(
      created.id === TMPL_2_ID && created.code === 'SK-01',
      'TEST 3: saveInContext successfully creates new letter template'
    );

    // 4. saveInContext UPDATE
    const updatedPayload: LetterTemplate = {
      ...created,
      name: 'Surat Keterangan Siswa Aktif (Revisi)',
      isActive: false,
    };
    const updated = await repository.saveInContext(ACTOR_A_ID, TENANT_A_ID, updatedPayload);
    assert(
      updated.name === 'Surat Keterangan Siswa Aktif (Revisi)' && updated.isActive === false,
      'TEST 4: saveInContext updates name and isActive status'
    );

    // 5. Invariant assertion on mismatched tenant
    let caughtMismatch = false;
    try {
      await repository.saveInContext(ACTOR_A_ID, TENANT_A_ID, {
        ...newTmpl,
        tenantId: TENANT_B_ID,
      });
    } catch {
      caughtMismatch = true;
    }
    assert(
      caughtMismatch,
      'TEST 5: saveInContext rejects mismatched tenantId invariant'
    );

    // 6. Cross-tenant READ isolation
    const tmpl1InB = await repository.findByIdInContext(ACTOR_B_ID, TENANT_B_ID, TMPL_1_ID);
    assert(
      tmpl1InB === null,
      'TEST 6: Tenant B actor cannot read Tenant A letter template'
    );
  } finally {
    await cleanupFixtures();
    await migrationPool.end();
  }

  console.log(`\nResults: ${passCount} / ${testCount} passed.`);
  if (passCount !== testCount) {
    process.exit(1);
  }
}

void runTests();
