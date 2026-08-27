import 'dotenv/config';
import pg from 'pg';
import { Document, DocumentVersion } from '@prisma/client';
import { PostgresDocumentRepository } from '../src/platform/repositories/document';
import { PostgresDocumentVersionRepository } from '../src/platform/repositories/document-version';
import { runInTenantContext } from '../src/platform/db/tenant-context';

// Connection pool using MIGRATION_DATABASE_URL exclusively for setup & teardown
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!migrationUrl) {
  throw new Error('SECURITY ERROR: MIGRATION_DATABASE_URL environment variable is missing.');
}
const migrationPool = new pg.Pool({ connectionString: migrationUrl });

const docRepository = new PostgresDocumentRepository();
const verRepository = new PostgresDocumentVersionRepository();

// Dedicated Hex UUID Fixture IDs for Document & DocumentVersion Repository Tests
const TENANT_A_ID = '44444444-4444-4444-8444-444444444444';
const TENANT_B_ID = '55555555-5555-4555-8555-555555555555';

const ACTOR_A_ID = 'd4444444-4444-4444-8444-444444444444';
const ACTOR_B_ID = 'e5555555-5555-4555-8555-555555555555';

const DOC_1_ID = 'e1111111-1111-4111-8111-111111111111';
const DOC_2_ID = 'e2222222-2222-4222-8222-222222222222';
const DOC_3_ID = 'e3333333-3333-4333-8333-333333333333';
const DOC_4_ID = 'e4444444-4444-4444-8444-444444444444';
const DOC_5_ID = 'e5555555-5555-4555-8555-555555555555';
const DOC_B1_ID = 'f1111111-1111-4111-8111-111111111111';

const VER_1_1_ID = 'f2222222-2222-4222-8222-222222222222';
const VER_1_2_ID = 'f3333333-3333-4333-8333-333333333333';
const VER_B1_1_ID = 'f4444444-4444-4444-8444-444444444444';

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
      `DELETE FROM document_versions WHERE id IN ('${VER_1_1_ID}', '${VER_1_2_ID}', '${VER_B1_1_ID}');`
    );
    await migrationPool.query(
      `DELETE FROM documents WHERE id IN ('${DOC_1_ID}', '${DOC_2_ID}', '${DOC_3_ID}', '${DOC_4_ID}', '${DOC_5_ID}', '${DOC_B1_ID}');`
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

  // 1. Create Active Tenant A & Active Tenant B
  await migrationPool.query(`
    INSERT INTO tenants (id, code, name, status, created_at, updated_at) VALUES
    ('${TENANT_A_ID}', 'DOC-TENANT-A', 'Document Test Tenant A', 'ACTIVE', NOW(), NOW()),
    ('${TENANT_B_ID}', 'DOC-TENANT-B', 'Document Test Tenant B', 'ACTIVE', NOW(), NOW());
  `);

  // 2. Create Active Actor A in Tenant A, Active Actor B in Tenant B
  await migrationPool.query(`
    INSERT INTO user_actors (id, tenant_id, username, email, full_name, role, status, created_at, updated_at) VALUES
    ('${ACTOR_A_ID}', '${TENANT_A_ID}', 'doc_actor_a', 'doc_actor_a@test.local', 'Doc Actor A', 'VERIFIKATOR', 'ACTIVE', NOW(), NOW()),
    ('${ACTOR_B_ID}', '${TENANT_B_ID}', 'doc_actor_b', 'doc_actor_b@test.local', 'Doc Actor B', 'VERIFIKATOR', 'ACTIVE', NOW(), NOW());
  `);

  // 3. Create Document 1 in Tenant A, Document B1 in Tenant B
  await migrationPool.query(`
    INSERT INTO documents (id, tenant_id, title, category, current_version, status, created_at, updated_at) VALUES
    ('${DOC_1_ID}', '${TENANT_A_ID}', 'SK CPNS Guru 2024', 'SK_CPNS', 1, 'DRAFT', NOW(), NOW()),
    ('${DOC_B1_ID}', '${TENANT_B_ID}', 'Surat Pengantar Dinas Tenant B', 'SURAT_PENGANTAR', 1, 'DRAFT', NOW(), NOW());
  `);

  // 4. Create DocumentVersion 1_1 for Document 1, DocumentVersion B1_1 for Document B1
  await migrationPool.query(`
    INSERT INTO document_versions (id, tenant_id, document_id, version_number, file_path, file_size_bytes, mime_type, checksum_sha256, created_at) VALUES
    ('${VER_1_1_ID}', '${TENANT_A_ID}', '${DOC_1_ID}', 1, '/storage/tenant_a/sk_cpns_v1.pdf', 1048576, 'application/pdf', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', NOW()),
    ('${VER_B1_1_ID}', '${TENANT_B_ID}', '${DOC_B1_ID}', 1, '/storage/tenant_b/surat_v1.pdf', 524288, 'application/pdf', 'f4c8996fb92427ae41e4649b934ca495991b7852b855e3b0c44298fc1c149afb', NOW());
  `);
}

async function runDocumentRepositoryTestSuite() {
  console.log('===========================================================');
  console.log(' BANYUBIRU PHASE 4G-8 DOCUMENT & VERSION REPOSITORY TESTS  ');
  console.log('===========================================================\n');

  try {
    console.log('[Setup] Provisioning deterministic test fixtures via migrator...');
    await setupFixtures();
    console.log('[Setup] Fixtures created successfully.\n');

    // ------------------------------------------------------------------------
    // TEST 1 — Document findByIdInContext (Happy Path)
    // ------------------------------------------------------------------------
    console.log('[1] Testing Document findByIdInContext...');
    const doc1 = await docRepository.findByIdInContext(ACTOR_A_ID, TENANT_A_ID, DOC_1_ID);
    assert(
      doc1 !== null && doc1.id === DOC_1_ID && doc1.title === 'SK CPNS Guru 2024',
      'TEST 1: findByIdInContext returns Document 1 in Tenant A context',
      `Found document: ${doc1?.title}`
    );

    // ------------------------------------------------------------------------
    // TEST 2 — Document findAllInContext (Tenant Isolation)
    // ------------------------------------------------------------------------
    console.log('\n[2] Testing Document findAllInContext...');
    const tenantADocs = await docRepository.findAllInContext(ACTOR_A_ID, TENANT_A_ID);
    const hasDoc1 = tenantADocs.some((d) => d.id === DOC_1_ID);
    const hasDocB1 = tenantADocs.some((d) => d.id === DOC_B1_ID);
    assert(
      hasDoc1 && !hasDocB1,
      'TEST 2: findAllInContext returns only Tenant A documents',
      `Tenant A doc count: ${tenantADocs.length}, has Doc 1: ${hasDoc1}, has Doc B1: ${hasDocB1}`
    );

    // ------------------------------------------------------------------------
    // TEST 3 — Document CREATE in Tenant A
    // ------------------------------------------------------------------------
    console.log('\n[3] Testing Document CREATE...');
    const newDoc2: Document = {
      id: DOC_2_ID,
      tenantId: TENANT_A_ID,
      title: 'Ijazah S1 Pendidikan',
      category: 'SERTIFIKAT',
      currentVersion: 1,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const createdDoc = await docRepository.saveInContext(ACTOR_A_ID, TENANT_A_ID, newDoc2);
    assert(
      createdDoc.id === DOC_2_ID && createdDoc.title === 'Ijazah S1 Pendidikan',
      'TEST 3: saveInContext successfully creates new Document 2 in Tenant A',
      `Created document: ${createdDoc.title}`
    );

    // ------------------------------------------------------------------------
    // TEST 4 — Document UPDATE in Tenant A
    // ------------------------------------------------------------------------
    console.log('\n[4] Testing Document UPDATE...');
    const updateDocPayload: Document = {
      ...createdDoc,
      title: 'Ijazah S1 Pendidikan Legalisir',
      status: 'VERIFIED',
    };
    const updatedDoc = await docRepository.saveInContext(ACTOR_A_ID, TENANT_A_ID, updateDocPayload);
    assert(
      updatedDoc.id === DOC_2_ID &&
        updatedDoc.title === 'Ijazah S1 Pendidikan Legalisir' &&
        updatedDoc.status === 'VERIFIED',
      'TEST 4: saveInContext successfully updates Document allowed fields',
      `Updated document: ${updatedDoc.title}, status: ${updatedDoc.status}`
    );

    // ------------------------------------------------------------------------
    // TEST 5 — Document tenantId Immutability Verification
    // ------------------------------------------------------------------------
    console.log('\n[5] Testing Document tenantId Immutability...');
    const doc2PostUpdateInDb = await docRepository.findByIdInContext(ACTOR_A_ID, TENANT_A_ID, DOC_2_ID);
    assert(
      doc2PostUpdateInDb?.tenantId === TENANT_A_ID,
      'TEST 5: saveInContext preserves tenantId immutability during UPDATE',
      `Tenant ID in DB: ${doc2PostUpdateInDb?.tenantId}`
    );

    // ------------------------------------------------------------------------
    // TEST 6 — Application Tenant Invariant Rejection
    // ------------------------------------------------------------------------
    console.log('\n[6] Testing Application Tenant Invariant Rejection...');
    let invariantCaught = false;
    let invariantErrorMessage = '';
    const mismatchedDoc: Document = {
      id: DOC_3_ID,
      tenantId: TENANT_B_ID, // Mismatched! Entity says Tenant B, context is Tenant A
      title: 'Mismatched Document',
      category: 'IDENTITAS',
      currentVersion: 1,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await docRepository.saveInContext(ACTOR_A_ID, TENANT_A_ID, mismatchedDoc);
    } catch (err) {
      invariantCaught = true;
      invariantErrorMessage = (err as Error).message;
    }

    assert(
      invariantCaught && invariantErrorMessage.includes('SECURITY ERROR'),
      'TEST 6: saveInContext rejects mismatched entity.tenantId before reaching DB',
      `Caught error: ${invariantErrorMessage}`
    );

    // ------------------------------------------------------------------------
    // TEST 7 — Document Batch Creation (saveAllInContext)
    // ------------------------------------------------------------------------
    console.log('\n[7] Testing Document Batch Creation...');
    const batchDocs: Document[] = [
      {
        id: DOC_3_ID,
        tenantId: TENANT_A_ID,
        title: 'SK Jabatan Fungsional 2024',
        category: 'SK_JABATAN',
        currentVersion: 1,
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: DOC_4_ID,
        tenantId: TENANT_A_ID,
        title: 'SKP Tahun 2023-2024',
        category: 'SKP_2_TAHUN',
        currentVersion: 1,
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const savedBatchDocs = await docRepository.saveAllInContext(ACTOR_A_ID, TENANT_A_ID, batchDocs);
    assert(
      savedBatchDocs.length === 2 && savedBatchDocs[0].id === DOC_3_ID && savedBatchDocs[1].id === DOC_4_ID,
      'TEST 7: saveAllInContext atomically creates batch documents in Tenant A',
      `Saved batch count: ${savedBatchDocs.length}`
    );

    // ------------------------------------------------------------------------
    // TEST 8 — Document Batch Atomic Rollback on Constraint Failure
    // ------------------------------------------------------------------------
    console.log('\n[8] Testing Document Batch Atomic Rollback...');
    let rollbackCaught = false;
    const rollbackBatchDocs: Document[] = [
      {
        id: DOC_5_ID,
        tenantId: TENANT_A_ID,
        title: 'Dokumen Rollback Test',
        category: 'FOTO',
        currentVersion: 1,
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        // Invalid title null or broken payload (let's pass null title to force DB constraint error)
        id: 'e6666666-6666-4666-8666-666666666666',
        tenantId: TENANT_A_ID,
        title: null as unknown as string,
        category: 'FOTO',
        currentVersion: 1,
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    try {
      await docRepository.saveAllInContext(ACTOR_A_ID, TENANT_A_ID, rollbackBatchDocs);
    } catch (err) {
      rollbackCaught = true;
    }

    const doc5Check = await docRepository.findByIdInContext(ACTOR_A_ID, TENANT_A_ID, DOC_5_ID);
    assert(
      rollbackCaught && doc5Check === null,
      'TEST 8: saveAllInContext rolls back entire transaction atomically on constraint failure',
      `Rollback caught: ${rollbackCaught}, Doc 5 in DB: ${doc5Check !== null}`
    );

    // ------------------------------------------------------------------------
    // TEST 9 — Document READ Cross-Tenant Isolation
    // ------------------------------------------------------------------------
    console.log('\n[9] Testing Document READ Cross-Tenant Isolation...');
    const doc1InB = await docRepository.findByIdInContext(ACTOR_B_ID, TENANT_B_ID, DOC_1_ID);
    assert(
      doc1InB === null,
      'TEST 9: READ cross-tenant — Tenant B actor cannot retrieve Tenant A document',
      `Doc 1 visible in Tenant B: ${doc1InB !== null}`
    );

    // ------------------------------------------------------------------------
    // TEST 10 — Document UPDATE Cross-Tenant Isolation
    // ------------------------------------------------------------------------
    console.log('\n[10] Testing Document UPDATE Cross-Tenant Isolation...');
    let docUpdateCrossTenantCaught = false;
    const illegalDocUpdate: Document = {
      id: DOC_1_ID,
      tenantId: TENANT_A_ID,
      title: 'HACKED DOCUMENT BY TENANT B',
      category: 'SK_CPNS',
      currentVersion: 1,
      status: 'REJECTED',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await docRepository.saveInContext(ACTOR_B_ID, TENANT_B_ID, illegalDocUpdate);
    } catch (err) {
      docUpdateCrossTenantCaught = true;
    }

    const doc1PostUpdateAttempt = await docRepository.findByIdInContext(ACTOR_A_ID, TENANT_A_ID, DOC_1_ID);
    assert(
      docUpdateCrossTenantCaught && doc1PostUpdateAttempt?.title === 'SK CPNS Guru 2024',
      'TEST 10: UPDATE cross-tenant — Tenant B cannot update Tenant A document, DB state remains unchanged',
      `Update rejected: ${docUpdateCrossTenantCaught}, Title in DB: ${doc1PostUpdateAttempt?.title}`
    );

    // ------------------------------------------------------------------------
    // TEST 11 — Document DELETE Cross-Tenant Isolation
    // ------------------------------------------------------------------------
    console.log('\n[11] Testing Document DELETE Cross-Tenant Isolation...');
    const deleteDocCrossTenantResult = await docRepository.deleteInContext(ACTOR_B_ID, TENANT_B_ID, DOC_1_ID);
    const doc1PostDeleteAttempt = await docRepository.findByIdInContext(ACTOR_A_ID, TENANT_A_ID, DOC_1_ID);
    assert(
      deleteDocCrossTenantResult === false && doc1PostDeleteAttempt !== null,
      'TEST 11: DELETE cross-tenant — Tenant B deleteInContext returns false (P2025 under RLS), DB state remains intact',
      `Delete result: ${deleteDocCrossTenantResult}, Doc 1 still in DB: ${doc1PostDeleteAttempt !== null}`
    );

    // ------------------------------------------------------------------------
    // TEST 12 — Unauthorized Tenant Context Lockout
    // ------------------------------------------------------------------------
    console.log('\n[12] Testing Unauthorized Tenant Context Lockout...');
    let unauthCaught = false;
    let callbackExecuted = false;
    try {
      await runInTenantContext(ACTOR_A_ID, TENANT_B_ID, async () => {
        callbackExecuted = true;
      });
    } catch (err) {
      unauthCaught = true;
    }
    assert(
      unauthCaught && !callbackExecuted,
      'TEST 12: Unauthorized context (Actor A + Tenant B) fails set_tenant_context() and callback does not execute',
      `Unauth caught: ${unauthCaught}, Callback executed: ${callbackExecuted}`
    );

    // ------------------------------------------------------------------------
    // TEST 13 — Document deleteInContext P2025 Semantics
    // ------------------------------------------------------------------------
    console.log('\n[13] Testing Document deleteInContext P2025 Semantics...');
    const deleteDocSuccess = await docRepository.deleteInContext(ACTOR_A_ID, TENANT_A_ID, DOC_4_ID);
    const deleteNonExistingDoc = await docRepository.deleteInContext(
      ACTOR_A_ID,
      TENANT_A_ID,
      '99999999-9999-4999-8999-999999999999'
    );
    assert(
      deleteDocSuccess === true && deleteNonExistingDoc === false,
      'TEST 13: deleteInContext returns true for deleted record and false for non-existing record (P2025)',
      `Delete existing: ${deleteDocSuccess}, Delete non-existing: ${deleteNonExistingDoc}`
    );

    // ------------------------------------------------------------------------
    // TEST 14 — DocumentVersion CREATE under correct tenant/document
    // ------------------------------------------------------------------------
    console.log('\n[14] Testing DocumentVersion CREATE...');
    const newVer1_2: DocumentVersion = {
      id: VER_1_2_ID,
      tenantId: TENANT_A_ID,
      documentId: DOC_1_ID,
      versionNumber: 2,
      filePath: '/storage/tenant_a/sk_cpns_v2_signed.pdf',
      fileSizeBytes: BigInt(2097152),
      mimeType: 'application/pdf',
      checksumSha256: 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef',
      createdAt: new Date(),
    };
    const createdVer = await verRepository.saveInContext(ACTOR_A_ID, TENANT_A_ID, newVer1_2);
    assert(
      createdVer.id === VER_1_2_ID && createdVer.versionNumber === 2 && createdVer.documentId === DOC_1_ID,
      'TEST 14: DocumentVersion successfully created under correct Tenant A / Document 1',
      `Created version ID: ${createdVer.id}, versionNumber: ${createdVer.versionNumber}`
    );

    // ------------------------------------------------------------------------
    // TEST 15 — DocumentVersion READ under correct tenant
    // ------------------------------------------------------------------------
    console.log('\n[15] Testing DocumentVersion READ...');
    const ver1_1 = await verRepository.findByIdInContext(ACTOR_A_ID, TENANT_A_ID, VER_1_1_ID);
    assert(
      ver1_1 !== null && ver1_1.id === VER_1_1_ID && ver1_1.filePath === '/storage/tenant_a/sk_cpns_v1.pdf',
      'TEST 15: findByIdInContext returns DocumentVersion 1_1 in Tenant A context',
      `Found version filePath: ${ver1_1?.filePath}`
    );

    // ------------------------------------------------------------------------
    // TEST 16 — Duplicate (documentId, versionNumber) Constraint Rejection
    // ------------------------------------------------------------------------
    console.log('\n[16] Testing Duplicate (documentId, versionNumber) Constraint...');
    let dupVerCaught = false;
    const duplicateVer: DocumentVersion = {
      id: 'f9999999-9999-4999-8999-999999999999',
      tenantId: TENANT_A_ID,
      documentId: DOC_1_ID,
      versionNumber: 1, // Duplicate version number 1 for Document 1!
      filePath: '/storage/tenant_a/sk_cpns_dup.pdf',
      fileSizeBytes: BigInt(5000),
      mimeType: 'application/pdf',
      checksumSha256: '0000000000000000000000000000000000000000000000000000000000000000',
      createdAt: new Date(),
    };

    try {
      await verRepository.saveInContext(ACTOR_A_ID, TENANT_A_ID, duplicateVer);
    } catch (err) {
      dupVerCaught = true;
    }

    assert(
      dupVerCaught,
      'TEST 16: Duplicate (documentId, versionNumber) constraint is rejected by DB without swallowing error',
      `Duplicate version error caught: ${dupVerCaught}`
    );

    // ------------------------------------------------------------------------
    // TEST 17 — DocumentVersion UPDATE while preserving tenantId
    // ------------------------------------------------------------------------
    console.log('\n[17] Testing DocumentVersion UPDATE...');
    const updateVerPayload: DocumentVersion = {
      ...createdVer,
      filePath: '/storage/tenant_a/sk_cpns_v2_final.pdf',
    };
    const updatedVer = await verRepository.saveInContext(ACTOR_A_ID, TENANT_A_ID, updateVerPayload);
    assert(
      updatedVer.id === VER_1_2_ID &&
        updatedVer.filePath === '/storage/tenant_a/sk_cpns_v2_final.pdf' &&
        updatedVer.tenantId === TENANT_A_ID,
      'TEST 17: saveInContext updates DocumentVersion allowed fields while preserving tenantId immutability',
      `Updated version filePath: ${updatedVer.filePath}`
    );

    // ------------------------------------------------------------------------
    // TEST 18 — DocumentVersion READ Cross-Tenant Isolation
    // ------------------------------------------------------------------------
    console.log('\n[18] Testing DocumentVersion READ Cross-Tenant Isolation...');
    const ver1_1InB = await verRepository.findByIdInContext(ACTOR_B_ID, TENANT_B_ID, VER_1_1_ID);
    assert(
      ver1_1InB === null,
      'TEST 18: READ cross-tenant — Tenant B actor cannot retrieve Tenant A document version',
      `Ver 1_1 visible in Tenant B: ${ver1_1InB !== null}`
    );

    // ------------------------------------------------------------------------
    // TEST 19 — DocumentVersion UPDATE Cross-Tenant Isolation
    // ------------------------------------------------------------------------
    console.log('\n[19] Testing DocumentVersion UPDATE Cross-Tenant Isolation...');
    let verUpdateCrossTenantCaught = false;
    const illegalVerUpdate: DocumentVersion = {
      id: VER_1_1_ID,
      tenantId: TENANT_A_ID,
      documentId: DOC_1_ID,
      versionNumber: 1,
      filePath: '/storage/tenant_b/HACKED_FILE.pdf',
      fileSizeBytes: BigInt(999),
      mimeType: 'application/pdf',
      checksumSha256: '9999999999999999999999999999999999999999999999999999999999999999',
      createdAt: new Date(),
    };

    try {
      await verRepository.saveInContext(ACTOR_B_ID, TENANT_B_ID, illegalVerUpdate);
    } catch (err) {
      verUpdateCrossTenantCaught = true;
    }

    const ver1_1PostUpdateAttempt = await verRepository.findByIdInContext(ACTOR_A_ID, TENANT_A_ID, VER_1_1_ID);
    assert(
      verUpdateCrossTenantCaught && ver1_1PostUpdateAttempt?.filePath === '/storage/tenant_a/sk_cpns_v1.pdf',
      'TEST 19: UPDATE cross-tenant — Tenant B cannot update Tenant A document version, DB state remains unchanged',
      `Update rejected: ${verUpdateCrossTenantCaught}, FilePath in DB: ${ver1_1PostUpdateAttempt?.filePath}`
    );

    // ------------------------------------------------------------------------
    // TEST 20 — DocumentVersion DELETE Cross-Tenant Isolation
    // ------------------------------------------------------------------------
    console.log('\n[20] Testing DocumentVersion DELETE Cross-Tenant Isolation...');
    const deleteVerCrossTenantResult = await verRepository.deleteInContext(ACTOR_B_ID, TENANT_B_ID, VER_1_1_ID);
    const ver1_1PostDeleteAttempt = await verRepository.findByIdInContext(ACTOR_A_ID, TENANT_A_ID, VER_1_1_ID);
    assert(
      deleteVerCrossTenantResult === false && ver1_1PostDeleteAttempt !== null,
      'TEST 20: DELETE cross-tenant — Tenant B deleteInContext returns false (P2025 under RLS), DB state remains intact',
      `Delete result: ${deleteVerCrossTenantResult}, Ver 1_1 still in DB: ${ver1_1PostDeleteAttempt !== null}`
    );

    // ------------------------------------------------------------------------
    // TEST 21 — PostgreSQL ON DELETE CASCADE for Document Versions
    // ------------------------------------------------------------------------
    console.log('\n[21] Testing PostgreSQL ON DELETE CASCADE for Document Versions...');
    // Delete Document 1 in Tenant A
    const doc1DeleteSuccess = await docRepository.deleteInContext(ACTOR_A_ID, TENANT_A_ID, DOC_1_ID);
    
    // Check if associated DocumentVersion 1_1 and 1_2 were automatically cascaded and deleted by PostgreSQL
    const ver1_1PostDocDelete = await verRepository.findByIdInContext(ACTOR_A_ID, TENANT_A_ID, VER_1_1_ID);
    const ver1_2PostDocDelete = await verRepository.findByIdInContext(ACTOR_A_ID, TENANT_A_ID, VER_1_2_ID);

    assert(
      doc1DeleteSuccess === true && ver1_1PostDocDelete === null && ver1_2PostDocDelete === null,
      'TEST 21: Deleting Document automatically cascades and deletes all associated DocumentVersions via PostgreSQL ON DELETE CASCADE',
      `Doc 1 deleted: ${doc1DeleteSuccess}, Ver 1_1 deleted by cascade: ${ver1_1PostDocDelete === null}, Ver 1_2 deleted by cascade: ${ver1_2PostDocDelete === null}`
    );

    // ------------------------------------------------------------------------
    // TEST 22 — Transaction-Bound Methods (*Tx inside custom transaction)
    // ------------------------------------------------------------------------
    console.log('\n[22] Testing Transaction-Bound Methods (*Tx inside custom transaction)...');
    const txResult = await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      const foundDocInTx = await docRepository.findByIdTx(tx, DOC_2_ID);
      const allDocsInTx = await docRepository.findAllTx(tx);
      const allVersInTx = await verRepository.findAllTx(tx);
      return { foundDocInTx, docCount: allDocsInTx.length, verCount: allVersInTx.length };
    });

    assert(
      txResult.foundDocInTx !== null && txResult.foundDocInTx.id === DOC_2_ID,
      'TEST 22: Transaction-bound repository methods (*Tx) execute cleanly using active TenantTransactionClient',
      `Found in tx: ${txResult.foundDocInTx?.title}, total docs in tx: ${txResult.docCount}`
    );
  } finally {
    console.log('\n[Teardown] Cleaning up test fixtures...');
    await cleanupFixtures();
    await migrationPool.end();
    console.log('[Teardown] Cleanup complete.');
  }

  console.log('\n===========================================================');
  console.log(` SUMMARY: ${passCount} / ${testCount} TESTS PASSED`);
  console.log('===========================================================\n');

  if (passCount !== testCount) {
    process.exit(1);
  }
}

runDocumentRepositoryTestSuite().catch((err) => {
  console.error('Document repository test execution error:', err);
  process.exit(1);
});
