import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { runInTenantContext } from '../src/platform/db/tenant-context';
import { matchDocumentIdentity, ENTITY_TYPE, MatcherInput } from '../src/platform/services/document-identity-matcher';

// ---------------------------------------------------------------------------
// DB connections
// ---------------------------------------------------------------------------
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!migrationUrl) throw new Error('SECURITY ERROR: MIGRATION_DATABASE_URL required');
const migrationPool = new pg.Pool({ connectionString: migrationUrl });
const adminPrisma = new PrismaClient({ adapter: new PrismaPg(migrationPool) });

// ---------------------------------------------------------------------------
// Test fixtures — UUIDs dedicated to this suite (avoid collision with others)
// ---------------------------------------------------------------------------
const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ACTOR_A  = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
const ACTOR_B  = 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001';

// Students Tenant A
const ST_A1 = 'aaaaaaaa-0001-4aaa-8aaa-000000000001'; // NISN 1234567890
const ST_A2 = 'aaaaaaaa-0002-4aaa-8aaa-000000000002'; // NIS 2024001
const ST_A3 = 'aaaaaaaa-0003-4aaa-8aaa-000000000003'; // fullName "Siti Rahayu" (dup 1)
const ST_A4 = 'aaaaaaaa-0004-4aaa-8aaa-000000000004'; // fullName "Siti Rahayu" (dup 2)
const ST_A5 = 'aaaaaaaa-0005-4aaa-8aaa-000000000005'; // unique name "Budi Santoso"
// Student Tenant B (cross-tenant isolation)
const ST_B1 = 'bbbbbbbb-0001-4bbb-8bbb-000000000001';

// Employees Tenant A
const EMP_A1 = 'aaaaaaaa-0011-4aaa-8aaa-000000000011'; // NIP 198001012006011001
const EMP_A2 = 'aaaaaaaa-0012-4aaa-8aaa-000000000012'; // NIP null, NIK 3201010101010001
const EMP_A3 = 'aaaaaaaa-0013-4aaa-8aaa-000000000013'; // Name "Dewi Lestari" (dup 1)
const EMP_A4 = 'aaaaaaaa-0014-4aaa-8aaa-000000000014'; // Name "Dewi Lestari" (dup 2)

// ExtractionResult / Document fixtures (mocked UUIDs — DB not required for these)
const DOC_ID      = 'dddddddd-dddd-4ddd-8ddd-000000000001';
const DOC_VER_ID  = 'dddddddd-dddd-4ddd-8ddd-000000000002';
const OCR_ID      = 'dddddddd-dddd-4ddd-8ddd-000000000003';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
let testCount = 0;
let passCount = 0;

function assert(condition: boolean, message: string, detail?: string) {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`  ✓ T${testCount}: ${message}`);
  } else {
    console.error(`  ✗ T${testCount} FAILED: ${message}${detail ? ' — ' + detail : ''}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers for ExtractionResult and Document fixtures
// ---------------------------------------------------------------------------
async function createDocumentFixtures(tenantId: string) {
  await adminPrisma.document.upsert({
    where: { id: DOC_ID },
    create: { id: DOC_ID, tenantId, title: 'Test Doc', category: 'LAINNYA', source: 'UNGGAH_LANGSUNG' },
    update: {},
  });
  await adminPrisma.documentVersion.upsert({
    where: { id: DOC_VER_ID },
    create: {
      id: DOC_VER_ID,
      tenantId,
      documentId: DOC_ID,
      versionNumber: 1,
      filePath: '/test/doc.pdf',
      fileSizeBytes: BigInt(1024),
      mimeType: 'application/pdf',
      storageStatus: 'ACTIVE',
    },
    update: {},
  });
  await adminPrisma.oCRExtraction.upsert({
    where: { id: OCR_ID },
    create: {
      id: OCR_ID,
      tenantId,
      documentId: DOC_ID,
      documentVersionId: DOC_VER_ID,
      status: 'COMPLETED',
      extractedText: 'sample text',
    },
    update: {},
  });
}

async function createExtractionResult(tenantId: string, field: string, value: string): Promise<string> {
  const id = crypto.randomUUID();
  await adminPrisma.extractionResult.create({
    data: {
      id,
      tenantId,
      documentId: DOC_ID,
      documentVersionId: DOC_VER_ID,
      ocrExtractionId: OCR_ID,
      field,
      value,
      status: 'BERHASIL',
    },
  });
  return id;
}

async function deleteMatchingData() {
  await migrationPool.query(`DELETE FROM matching_candidates WHERE tenant_id IN ('${TENANT_A}','${TENANT_B}')`);
  await migrationPool.query(`DELETE FROM matching_results WHERE tenant_id IN ('${TENANT_A}','${TENANT_B}')`);
  await migrationPool.query(`DELETE FROM extraction_results WHERE tenant_id IN ('${TENANT_A}','${TENANT_B}')`);
  await migrationPool.query(`DELETE FROM ocr_extractions WHERE tenant_id IN ('${TENANT_A}','${TENANT_B}')`);
  await migrationPool.query(`DELETE FROM document_versions WHERE tenant_id IN ('${TENANT_A}','${TENANT_B}')`);
  await migrationPool.query(`DELETE FROM documents WHERE tenant_id IN ('${TENANT_A}','${TENANT_B}')`);
  await migrationPool.query(`DELETE FROM students WHERE tenant_id IN ('${TENANT_A}','${TENANT_B}')`);
  await migrationPool.query(`DELETE FROM employees WHERE tenant_id IN ('${TENANT_A}','${TENANT_B}')`);
  await migrationPool.query(`DELETE FROM user_actors WHERE tenant_id IN ('${TENANT_A}','${TENANT_B}')`);
  await migrationPool.query(`DELETE FROM tenants WHERE id IN ('${TENANT_A}','${TENANT_B}')`);
}

async function setupTenant(tenantId: string, actorId: string, code: string) {
  await adminPrisma.tenant.upsert({
    where: { id: tenantId },
    create: { id: tenantId, name: `Test Tenant ${code}`, code, status: 'ACTIVE' },
    update: {},
  });
  await adminPrisma.userActor.upsert({
    where: { id: actorId },
    create: {
      id: actorId, tenantId, username: `actor_${code}`,
      email: `actor_${code}@test.local`, fullName: `Actor ${code}`,
      role: 'OPERATOR', status: 'ACTIVE',
    },
    update: {},
  });
}

// ---------------------------------------------------------------------------
// Main test runner
// ---------------------------------------------------------------------------
async function runMatcherTests() {
  console.log('\n=====================================================');
  console.log(' P0-J.1 DOCUMENT IDENTITY MATCHER TEST SUITE');
  console.log('=====================================================\n');

  await deleteMatchingData();
  await setupTenant(TENANT_A, ACTOR_A, 'MATCHER_A');
  await setupTenant(TENANT_B, ACTOR_B, 'MATCHER_B');
  await createDocumentFixtures(TENANT_A);

  // Seed Students Tenant A
  await adminPrisma.student.upsert({
    where: { id: ST_A1 },
    create: { id: ST_A1, tenantId: TENANT_A, nisn: '1234567890', nis: '2024001-X', fullName: 'Ahmad Fauzi', className: '9A', status: 'ACTIVE' },
    update: {},
  });
  await adminPrisma.student.upsert({
    where: { id: ST_A2 },
    create: { id: ST_A2, tenantId: TENANT_A, nisn: '9999999999', nis: '2024001', fullName: 'Rina Wati', className: '8B', status: 'ACTIVE' },
    update: {},
  });
  await adminPrisma.student.upsert({
    where: { id: ST_A3 },
    create: { id: ST_A3, tenantId: TENANT_A, nisn: '1111111111', nis: '2024002', fullName: 'Siti Rahayu', className: '7A', status: 'ACTIVE' },
    update: {},
  });
  await adminPrisma.student.upsert({
    where: { id: ST_A4 },
    create: { id: ST_A4, tenantId: TENANT_A, nisn: '2222222222', nis: '2024003', fullName: 'Siti Rahayu', className: '7B', status: 'ACTIVE' },
    update: {},
  });
  await adminPrisma.student.upsert({
    where: { id: ST_A5 },
    create: { id: ST_A5, tenantId: TENANT_A, nisn: '3333333333', nis: '2024004', fullName: 'Budi Santoso', className: '9B', status: 'ACTIVE' },
    update: {},
  });
  // Student Tenant B — cross-tenant isolation fixture
  await adminPrisma.student.upsert({
    where: { id: ST_B1 },
    create: { id: ST_B1, tenantId: TENANT_B, nisn: '1234567890', nis: '2024001', fullName: 'Ahmad Fauzi', className: '9A', status: 'ACTIVE' },
    update: {},
  });

  // Seed Employees Tenant A
  await adminPrisma.employee.upsert({
    where: { id: EMP_A1 },
    create: {
      id: EMP_A1, tenantId: TENANT_A, nip: '198001012006011001', nrk: 'NRK001',
      nik: '3201010101010001', fullName: 'Supriyadi', jabatan: 'Guru Matematika',
      unitKerja: 'SMPN 1', instansi: 'Dinas Pendidikan', statusKepegawaian: 'PNS',
    },
    update: {},
  });
  await adminPrisma.employee.upsert({
    where: { id: EMP_A2 },
    create: {
      id: EMP_A2, tenantId: TENANT_A, nip: null, nrk: 'NRK002',
      nik: '3201010101010002', fullName: 'Kartini Putri', jabatan: 'Guru IPA',
      unitKerja: 'SMPN 1', instansi: 'Dinas Pendidikan', statusKepegawaian: 'HONORER',
    },
    update: {},
  });
  await adminPrisma.employee.upsert({
    where: { id: EMP_A3 },
    create: {
      id: EMP_A3, tenantId: TENANT_A, nip: null, nrk: 'NRK003',
      nik: '3201010101010003', fullName: 'Dewi Lestari', jabatan: 'Tata Usaha',
      unitKerja: 'SMPN 1', instansi: 'Dinas Pendidikan', statusKepegawaian: 'HONORER',
    },
    update: {},
  });
  await adminPrisma.employee.upsert({
    where: { id: EMP_A4 },
    create: {
      id: EMP_A4, tenantId: TENANT_A, nip: null, nrk: 'NRK004',
      nik: '3201010101010004', fullName: 'Dewi Lestari', jabatan: 'Perpustakaan',
      unitKerja: 'SMPN 1', instansi: 'Dinas Pendidikan', statusKepegawaian: 'HONORER',
    },
    update: {},
  });

  // =========================================================================
  // STUDENT TESTS
  // =========================================================================
  console.log('\n── STUDENT MATCHING ─────────────────────────────────');

  // T1: NISN exact → COCOK
  {
    const extId = await createExtractionResult(TENANT_A, 'NISN', '1234567890');
    const result = await runInTenantContext(ACTOR_A, TENANT_A, (tx) =>
      matchDocumentIdentity(tx, {
        tenantId: TENANT_A, documentId: DOC_ID, documentVersionId: DOC_VER_ID,
        extractionResultId: extId, entityType: ENTITY_TYPE.STUDENT,
        extractedValue: '1234567890', fieldKey: 'NISN',
      })
    );
    assert(result.status === 'COCOK', 'NISN exact match → COCOK');
    assert(result.candidateCount === 1, 'NISN match produces 1 candidate');

    // Verify candidate persisted
    const cands = await adminPrisma.matchingCandidate.findMany({ where: { matchingResultId: result.matchingResultId } });
    assert(cands.length === 1, 'MatchingCandidate saved for NISN match');
    assert(cands[0].matchedEntityId === ST_A1, 'Candidate points to correct Student');
  }

  // T2: NIS exact → COCOK
  {
    const extId = await createExtractionResult(TENANT_A, 'NIS', '2024001');
    const result = await runInTenantContext(ACTOR_A, TENANT_A, (tx) =>
      matchDocumentIdentity(tx, {
        tenantId: TENANT_A, documentId: DOC_ID, documentVersionId: DOC_VER_ID,
        extractionResultId: extId, entityType: ENTITY_TYPE.STUDENT,
        extractedValue: '2024001', fieldKey: 'NIS',
      })
    );
    assert(result.status === 'COCOK', 'NIS exact match → COCOK');
    assert(result.candidateCount === 1, 'NIS match produces 1 candidate');
  }

  // T3: Unique name → COCOK
  {
    const extId = await createExtractionResult(TENANT_A, 'NAMA', 'Budi Santoso');
    const result = await runInTenantContext(ACTOR_A, TENANT_A, (tx) =>
      matchDocumentIdentity(tx, {
        tenantId: TENANT_A, documentId: DOC_ID, documentVersionId: DOC_VER_ID,
        extractionResultId: extId, entityType: ENTITY_TYPE.STUDENT,
        extractedValue: 'Budi Santoso', fieldKey: 'NAMA',
      })
    );
    assert(result.status === 'COCOK', 'Unique name match → COCOK');
    assert(result.candidateCount === 1, 'Unique name produces 1 candidate');
  }

  // T4: Duplicate name → PERLU_DIPERIKSA
  {
    const extId = await createExtractionResult(TENANT_A, 'NAMA', 'Siti Rahayu');
    const result = await runInTenantContext(ACTOR_A, TENANT_A, (tx) =>
      matchDocumentIdentity(tx, {
        tenantId: TENANT_A, documentId: DOC_ID, documentVersionId: DOC_VER_ID,
        extractionResultId: extId, entityType: ENTITY_TYPE.STUDENT,
        extractedValue: 'Siti Rahayu', fieldKey: 'NAMA',
      })
    );
    assert(result.status === 'PERLU_DIPERIKSA', 'Duplicate name → PERLU_DIPERIKSA');
    assert(result.candidateCount === 2, 'Duplicate name produces 2 candidates');

    const cands = await adminPrisma.matchingCandidate.findMany({
      where: { matchingResultId: result.matchingResultId },
      orderBy: { ranking: 'asc' },
    });
    assert(cands.length === 2, '2 MatchingCandidate records persisted for duplicate name');
  }

  // T5: Not found → TIDAK_DITEMUKAN
  {
    const extId = await createExtractionResult(TENANT_A, 'NISN', '0000000000');
    const result = await runInTenantContext(ACTOR_A, TENANT_A, (tx) =>
      matchDocumentIdentity(tx, {
        tenantId: TENANT_A, documentId: DOC_ID, documentVersionId: DOC_VER_ID,
        extractionResultId: extId, entityType: ENTITY_TYPE.STUDENT,
        extractedValue: '0000000000', fieldKey: 'NISN',
      })
    );
    assert(result.status === 'TIDAK_DITEMUKAN', 'No match → TIDAK_DITEMUKAN');
    assert(result.candidateCount === 0, 'No candidates for not-found');
  }

  // =========================================================================
  // EMPLOYEE TESTS
  // =========================================================================
  console.log('\n── EMPLOYEE (GURU & KARYAWAN) MATCHING ──────────────');

  // T6: NIP exact → COCOK
  {
    const extId = await createExtractionResult(TENANT_A, 'NIP', '198001012006011001');
    const result = await runInTenantContext(ACTOR_A, TENANT_A, (tx) =>
      matchDocumentIdentity(tx, {
        tenantId: TENANT_A, documentId: DOC_ID, documentVersionId: DOC_VER_ID,
        extractionResultId: extId, entityType: ENTITY_TYPE.EMPLOYEE,
        extractedValue: '198001012006011001', fieldKey: 'NIP',
      })
    );
    assert(result.status === 'COCOK', 'NIP exact match → COCOK');
    const cands = await adminPrisma.matchingCandidate.findMany({ where: { matchingResultId: result.matchingResultId } });
    assert(cands[0].matchedEntityId === EMP_A1, 'Candidate points to correct Employee (NIP)');
  }

  // T7: NIK exact → COCOK (Employee has no NIP)
  {
    const extId = await createExtractionResult(TENANT_A, 'NIK', '3201010101010002');
    const result = await runInTenantContext(ACTOR_A, TENANT_A, (tx) =>
      matchDocumentIdentity(tx, {
        tenantId: TENANT_A, documentId: DOC_ID, documentVersionId: DOC_VER_ID,
        extractionResultId: extId, entityType: ENTITY_TYPE.EMPLOYEE,
        extractedValue: '3201010101010002', fieldKey: 'NIK',
      })
    );
    assert(result.status === 'COCOK', 'NIK exact match (NIP=null employee) → COCOK');
    const cands = await adminPrisma.matchingCandidate.findMany({ where: { matchingResultId: result.matchingResultId } });
    assert(cands[0].matchedEntityId === EMP_A2, 'Candidate points to correct Employee (NIK, NIP=null)');
  }

  // T8: Employee duplicate name → PERLU_DIPERIKSA
  {
    const extId = await createExtractionResult(TENANT_A, 'NAMA', 'Dewi Lestari');
    const result = await runInTenantContext(ACTOR_A, TENANT_A, (tx) =>
      matchDocumentIdentity(tx, {
        tenantId: TENANT_A, documentId: DOC_ID, documentVersionId: DOC_VER_ID,
        extractionResultId: extId, entityType: ENTITY_TYPE.EMPLOYEE,
        extractedValue: 'Dewi Lestari', fieldKey: 'NAMA',
      })
    );
    assert(result.status === 'PERLU_DIPERIKSA', 'Duplicate employee name → PERLU_DIPERIKSA');
    assert(result.candidateCount === 2, 'Duplicate employee name produces 2 candidates');
  }

  // =========================================================================
  // TENANT ISOLATION
  // =========================================================================
  console.log('\n── TENANT ISOLATION ─────────────────────────────────');

  // T9: Tenant A cannot see Student from Tenant B (same NISN)
  {
    const extId = await createExtractionResult(TENANT_A, 'NISN', '1234567890');
    // Create a fresh ExtractionResult so we get a fresh MatchingResult
    const freshExtId = await createExtractionResult(TENANT_A, 'NISN', '1234567890');
    const result = await runInTenantContext(ACTOR_A, TENANT_A, (tx) =>
      matchDocumentIdentity(tx, {
        tenantId: TENANT_A, documentId: DOC_ID, documentVersionId: DOC_VER_ID,
        extractionResultId: freshExtId, entityType: ENTITY_TYPE.STUDENT,
        extractedValue: '1234567890', fieldKey: 'NISN',
      })
    );
    // Should find ST_A1, NOT ST_B1
    const cands = await adminPrisma.matchingCandidate.findMany({ where: { matchingResultId: result.matchingResultId } });
    assert(cands.every(c => c.matchedEntityId !== ST_B1), 'Tenant A cannot see Student from Tenant B');
    assert(cands.some(c => c.matchedEntityId === ST_A1), 'Tenant A correctly finds own Student');
    void extId;
  }

  // =========================================================================
  // IDEMPOTENCY
  // =========================================================================
  console.log('\n── IDEMPOTENCY ──────────────────────────────────────');

  // T10: Run #1 → 1 result, Run #2 → still 1 result (no duplicate)
  {
    const extId = await createExtractionResult(TENANT_A, 'NISN', '3333333333');
    const input: MatcherInput = {
      tenantId: TENANT_A, documentId: DOC_ID, documentVersionId: DOC_VER_ID,
      extractionResultId: extId, entityType: ENTITY_TYPE.STUDENT,
      extractedValue: '3333333333', fieldKey: 'NISN',
    };

    await runInTenantContext(ACTOR_A, TENANT_A, (tx) => matchDocumentIdentity(tx, input));
    await runInTenantContext(ACTOR_A, TENANT_A, (tx) => matchDocumentIdentity(tx, input));
    await runInTenantContext(ACTOR_A, TENANT_A, (tx) => matchDocumentIdentity(tx, input));

    const resultCount = await adminPrisma.matchingResult.count({
      where: { tenantId: TENANT_A, extractionResultId: extId, entityType: ENTITY_TYPE.STUDENT },
    });
    assert(resultCount === 1, 'Idempotency: 3 runs produce exactly 1 MatchingResult');

    const candCount = await adminPrisma.matchingCandidate.count({
      where: {
        matchingResult: { tenantId: TENANT_A, extractionResultId: extId },
      },
    });
    assert(candCount === 1, 'Idempotency: 3 runs produce exactly 1 MatchingCandidate');
  }

  // =========================================================================
  // MANUAL CONFIRMATION PROTECTION
  // =========================================================================
  console.log('\n── MANUAL CONFIRMATION PROTECTION ───────────────────');

  // T11: Re-run does not overwrite manuallyConfirmed decision
  {
    const extId = await createExtractionResult(TENANT_A, 'NIS', '2024002');
    const input: MatcherInput = {
      tenantId: TENANT_A, documentId: DOC_ID, documentVersionId: DOC_VER_ID,
      extractionResultId: extId, entityType: ENTITY_TYPE.STUDENT,
      extractedValue: '2024002', fieldKey: 'NIS',
    };

    const run1 = await runInTenantContext(ACTOR_A, TENANT_A, (tx) => matchDocumentIdentity(tx, input));

    // Simulate manual confirmation directly in DB
    await adminPrisma.matchingResult.update({
      where: { id: run1.matchingResultId },
      data: {
        manuallyConfirmed: true,
        status: 'COCOK',
        confirmedByUserId: ACTOR_A,
        confirmedAt: new Date(),
      },
    });

    const run2 = await runInTenantContext(ACTOR_A, TENANT_A, (tx) => matchDocumentIdentity(tx, input));

    assert(run2.wasReused === true, 'Re-run with manuallyConfirmed=true returns wasReused=true');
    assert(run2.status === 'COCOK', 'Re-run preserves COCOK status after manual confirmation');

    const saved = await adminPrisma.matchingResult.findUnique({ where: { id: run1.matchingResultId } });
    assert(saved?.manuallyConfirmed === true, 'manuallyConfirmed flag preserved after re-run');
    assert(saved?.confirmedByUserId === ACTOR_A, 'confirmedByUserId preserved after re-run');
  }

  // T12: "Tidak Ada yang Cocok" decision preserved on re-run
  {
    const extId = await createExtractionResult(TENANT_A, 'NISN', '7777777777');
    const input: MatcherInput = {
      tenantId: TENANT_A, documentId: DOC_ID, documentVersionId: DOC_VER_ID,
      extractionResultId: extId, entityType: ENTITY_TYPE.STUDENT,
      extractedValue: '7777777777', fieldKey: 'NISN',
    };

    const run1 = await runInTenantContext(ACTOR_A, TENANT_A, (tx) => matchDocumentIdentity(tx, input));
    assert(run1.status === 'TIDAK_DITEMUKAN', 'Initial run: TIDAK_DITEMUKAN (no match)');

    // Simulate "Tidak Ada yang Cocok" manual decision
    await adminPrisma.matchingResult.update({
      where: { id: run1.matchingResultId },
      data: { manuallyConfirmed: true, status: 'TIDAK_DITEMUKAN', confirmedByUserId: ACTOR_A, confirmedAt: new Date() },
    });

    const run2 = await runInTenantContext(ACTOR_A, TENANT_A, (tx) => matchDocumentIdentity(tx, input));
    assert(run2.wasReused === true, '"Tidak Ada yang Cocok" decision preserved — wasReused=true');

    const saved = await adminPrisma.matchingResult.findUnique({ where: { id: run1.matchingResultId } });
    assert(saved?.status === 'TIDAK_DITEMUKAN', '"Tidak Ada yang Cocok" status not overwritten');
  }

  // =========================================================================
  // MULTIPLE CANDIDATES PERSISTENCE
  // =========================================================================
  console.log('\n── MULTIPLE CANDIDATES ──────────────────────────────');

  // T13: Multiple candidates stored as separate MatchingCandidate records
  {
    const extId = await createExtractionResult(TENANT_A, 'NAMA', 'Siti Rahayu Baru');
    // Add a second Siti Rahayu Baru to produce 2 candidates
    await adminPrisma.student.upsert({
      where: { id: 'aaaaaaaa-0006-4aaa-8aaa-000000000006' },
      create: {
        id: 'aaaaaaaa-0006-4aaa-8aaa-000000000006',
        tenantId: TENANT_A, nisn: '4444444444', nis: '2024005',
        fullName: 'Siti Rahayu Baru', className: '8A', status: 'ACTIVE',
      },
      update: {},
    });
    await adminPrisma.student.upsert({
      where: { id: 'aaaaaaaa-0007-4aaa-8aaa-000000000007' },
      create: {
        id: 'aaaaaaaa-0007-4aaa-8aaa-000000000007',
        tenantId: TENANT_A, nisn: '5555555555', nis: '2024006',
        fullName: 'Siti Rahayu Baru', className: '8B', status: 'ACTIVE',
      },
      update: {},
    });

    const result = await runInTenantContext(ACTOR_A, TENANT_A, (tx) =>
      matchDocumentIdentity(tx, {
        tenantId: TENANT_A, documentId: DOC_ID, documentVersionId: DOC_VER_ID,
        extractionResultId: extId, entityType: ENTITY_TYPE.STUDENT,
        extractedValue: 'Siti Rahayu Baru', fieldKey: 'NAMA',
      })
    );
    assert(result.candidateCount === 2, 'Multiple candidates stored correctly');

    const cands = await adminPrisma.matchingCandidate.findMany({
      where: { matchingResultId: result.matchingResultId },
      orderBy: { ranking: 'asc' },
    });
    assert(cands.length === 2, '2 separate MatchingCandidate records persisted');
    assert(cands[0].ranking === 1, 'First candidate has ranking 1');
    assert(cands[1].ranking === 2, 'Second candidate has ranking 2');
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
runMatcherTests()
  .then(async () => {
    console.log(`\n✅ ALL TESTS PASSED: ${passCount}/${testCount}`);
    await migrationPool.end();
  })
  .catch(async (err) => {
    console.error('\n❌ TEST SUITE FAILED:', err);
    await migrationPool.end();
    process.exit(1);
  });