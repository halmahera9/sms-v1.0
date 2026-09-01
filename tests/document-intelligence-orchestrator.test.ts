import 'dotenv/config';
import pg from 'pg';
import crypto from 'crypto';
import { PrismaClient, UserRole, UserStatus, DocumentCategory, DocumentStatus, OCRExtractionStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { DocumentIntelligenceOrchestrator } from '../src/platform/services/document-intelligence';
import { PostgresAuditEventRepository } from '../src/platform/repositories/audit-event';
import { PostgresExceptionRepository } from '../src/platform/repositories/exception';
import { runInTenantContext } from '../src/platform/db/tenant-context';

let testCount = 0;
let passCount = 0;

function assert(condition: boolean, message: string, detail?: string) {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`  ✓ Test ${testCount}: ${message}`);
  } else {
    console.error(`  ✗ Test ${testCount} FAILED: ${message} (${detail || ''})`);
  }
}

async function runDocumentIntelligenceOrchestratorTests() {
  console.log('================================================================');
  console.log('  DOCUMENT INTELLIGENCE ORCHESTRATOR COMPREHENSIVE TEST SUITE   ');
  console.log('================================================================\n');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_A_ID = '33333333-3333-7333-8333-333333333333';
  const TENANT_B_ID = '88888888-8888-7888-8888-888888888888';

  const ACTOR_OPERATOR_A = 'a7777777-7777-7777-8777-777777777771';
  const ACTOR_OPERATOR_B = 'b7777777-7777-7777-8777-777777777772';

  const student1Id = '44444444-4444-7444-8444-444444444441';
  const student2Id = '44444444-4444-7444-8444-444444444442';

  const doc1Id = '55555555-5555-7555-8555-555555555551';
  const doc1VersionId = '66666666-6666-7666-8666-666666666661';

  const doc2Id = '55555555-5555-7555-8555-555555555552';
  const doc2VersionId = '66666666-6666-7666-8666-666666666662';

  const auditRepo = new PostgresAuditEventRepository();
  const exceptionRepo = new PostgresExceptionRepository(auditRepo);
  const orchestrator = new DocumentIntelligenceOrchestrator(auditRepo, exceptionRepo);

  try {
    // -------------------------------------------------------------
    // 1. Setup Fixtures: Tenants, Actors, Students, Documents
    // -------------------------------------------------------------
    console.log('[Setup] Seeding test fixtures...');

    await adminPrisma.tenant.upsert({
      where: { id: TENANT_A_ID },
      create: { id: TENANT_A_ID, name: 'DI Tenant A', code: 'DI_TENANT_A', status: 'ACTIVE' },
      update: {},
    });

    await adminPrisma.tenant.upsert({
      where: { id: TENANT_B_ID },
      create: { id: TENANT_B_ID, name: 'DI Tenant B', code: 'DI_TENANT_B', status: 'ACTIVE' },
      update: {},
    });

    // Cleanup previous test instances
    await adminPrisma.exceptionItem.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
    await adminPrisma.workflowInstance.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
    await adminPrisma.extractedItem.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
    await adminPrisma.oCRExtraction.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
    await adminPrisma.documentProcessingJob.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
    await adminPrisma.documentVersion.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
    await adminPrisma.document.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
    await adminPrisma.student.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_OPERATOR_A },
      create: {
        id: ACTOR_OPERATOR_A,
        tenantId: TENANT_A_ID,
        username: 'di_operator_a',
        email: 'di_op_a@test.local',
        fullName: 'DI Operator Tenant A',
        role: UserRole.OPERATOR,
        status: UserStatus.ACTIVE,
      },
      update: {},
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_OPERATOR_B },
      create: {
        id: ACTOR_OPERATOR_B,
        tenantId: TENANT_B_ID,
        username: 'di_operator_b',
        email: 'di_op_b@test.local',
        fullName: 'DI Operator Tenant B',
        role: UserRole.OPERATOR,
        status: UserStatus.ACTIVE,
      },
      update: {},
    });

    // Create master students in Tenant A
    await adminPrisma.student.createMany({
      data: [
        {
          id: student1Id,
          tenantId: TENANT_A_ID,
          nisn: '0051111111',
          nis: '1001',
          fullName: 'Budi Santoso',
          className: 'X IPA 1',
        },
        {
          id: student2Id,
          tenantId: TENANT_A_ID,
          nisn: '0052222222',
          nis: '1002',
          fullName: 'Siti Rahma',
          className: 'X IPA 2',
        },
      ],
    });

    // Create Document 1 (Valid Items) in Tenant A
    await adminPrisma.document.create({
      data: {
        id: doc1Id,
        tenantId: TENANT_A_ID,
        title: 'Presensi_Valid_Doc.png',
        category: DocumentCategory.LAINNYA,
        status: DocumentStatus.PENDING_VERIFICATION,
      },
    });

    await adminPrisma.documentVersion.create({
      data: {
        id: doc1VersionId,
        tenantId: TENANT_A_ID,
        documentId: doc1Id,
        versionNumber: 1,
        filePath: '/docs/presensi_valid.png',
        fileSizeBytes: BigInt(300000),
        mimeType: 'image/png',
        checksumSha256: 'simulated_hash_1',
      },
    });

    // Create Document 2 (Mixed Items with Anomalies) in Tenant A
    await adminPrisma.document.create({
      data: {
        id: doc2Id,
        tenantId: TENANT_A_ID,
        title: 'Presensi_Anomali_Doc.png',
        category: DocumentCategory.LAINNYA,
        status: DocumentStatus.PENDING_VERIFICATION,
      },
    });

    await adminPrisma.documentVersion.create({
      data: {
        id: doc2VersionId,
        tenantId: TENANT_A_ID,
        documentId: doc2Id,
        versionNumber: 1,
        filePath: '/docs/presensi_anomali.png',
        fileSizeBytes: BigInt(450000),
        mimeType: 'image/png',
        checksumSha256: 'simulated_hash_2',
      },
    });

    // -------------------------------------------------------------
    // 2. Test Suite 1: Input Validation & Guard Rails
    // -------------------------------------------------------------
    console.log('\n[1] Testing Pipeline Request Input Validation...');

    const resEmptyReq = await orchestrator.process(null as any);
    assert(resEmptyReq.status === 'FAILED', 'Null request returns status FAILED');
    assert(Boolean(resEmptyReq.errorMessage?.includes('Validation Error')), 'Returns clear validation error message');

    const resInvalidTenant = await orchestrator.process({
      tenantId: 'invalid-uuid',
      actorId: ACTOR_OPERATOR_A,
      documentId: doc1Id,
      documentVersionId: doc1VersionId,
      targetDomain: 'student',
    });
    assert(resInvalidTenant.status === 'FAILED', 'Invalid tenantId returns status FAILED');
    assert(Boolean(resInvalidTenant.errorMessage?.includes('SECURITY/SCHEMA ERROR')), 'Rejects invalid tenant UUID');

    const resInvalidDoc = await orchestrator.process({
      tenantId: TENANT_A_ID,
      actorId: ACTOR_OPERATOR_A,
      documentId: 'bad-uuid',
      documentVersionId: doc1VersionId,
      targetDomain: 'student',
    });
    assert(resInvalidDoc.status === 'FAILED', 'Invalid documentId returns status FAILED');

    const resNonExistentDoc = await orchestrator.process({
      tenantId: TENANT_A_ID,
      actorId: ACTOR_OPERATOR_A,
      documentId: crypto.randomUUID(),
      documentVersionId: doc1VersionId,
      targetDomain: 'student',
    });
    assert(resNonExistentDoc.status === 'FAILED', 'Non-existent documentId returns status FAILED');
    assert(Boolean(resNonExistentDoc.errorMessage?.includes('Document not found')), 'Indicates document not found');

    // -------------------------------------------------------------
    // 3. Test Suite 2: Processing Document with Clean / Valid Items
    // -------------------------------------------------------------
    console.log('\n[2] Testing Orchestration on Clean Document (Terminal COMPLETED)...');

    const cleanResult = await orchestrator.process({
      tenantId: TENANT_A_ID,
      actorId: ACTOR_OPERATOR_A,
      documentId: doc1Id,
      documentVersionId: doc1VersionId,
      targetDomain: 'student',
      metadata: {
        items: [
          {
            ocrText: 'Budi Santoso',
            matchedNisn: '0051111111',
            confidence: 95,
            status: 'Hadir',
            date: '2026-03-01',
          },
          {
            ocrText: 'Siti Rahma',
            matchedNisn: '0052222222',
            confidence: 90,
            status: 'Sakit',
            date: '2026-03-01',
          },
        ],
      },
    });

    assert(cleanResult.status === 'COMPLETED', 'Clean document processing returns terminal status COMPLETED');
    assert(cleanResult.documentId === doc1Id, 'Result contains correct documentId');
    assert(cleanResult.documentVersionId === doc1VersionId, 'Result contains correct documentVersionId');
    assert(cleanResult.processedItems.length === 2, 'Result contains exactly 2 processed items');
    assert(cleanResult.summary.totalItemsExtracted === 2, 'Summary totalItemsExtracted = 2');
    assert(cleanResult.summary.itemsResolved === 2, 'Summary itemsResolved = 2');
    assert(cleanResult.summary.itemsUnresolved === 0, 'Summary itemsUnresolved = 0');
    assert(cleanResult.summary.itemsAmbiguous === 0, 'Summary itemsAmbiguous = 0');
    assert(cleanResult.summary.validationErrorsCount === 0, 'Summary validationErrorsCount = 0');
    assert(cleanResult.summary.exceptionsCreatedCount === 0, 'Summary exceptionsCreatedCount = 0');
    assert(cleanResult.summary.itemsRequiringReview === 0, 'Summary itemsRequiringReview = 0');
    assert(cleanResult.exceptionIds.length === 0, 'No exceptionIds returned');
    assert(typeof cleanResult.auditEventId === 'string', 'Transaction-bound auditEventId returned');

    // Verify identity resolution on items
    const budiItem = cleanResult.processedItems.find((p) => p.rawText.includes('Budi'));
    assert(budiItem?.identityResolution.status === 'RESOLVED', 'Budi identity resolved');
    assert(budiItem?.identityResolution.matchedEntityId === student1Id, 'Budi mapped to student1Id');
    assert(budiItem?.identityResolution.matchedEntityType === 'Student', 'Budi matchedEntityType is Student');
    assert(budiItem?.requiresHumanReview === false, 'Budi does not require human review');
    assert(budiItem?.fields.studentName.rawValue === 'Budi Santoso', 'Extracted fields populated');

    // -------------------------------------------------------------
    // 4. Test Suite 3: Processing Document with Anomalies (Low Confidence & Unmatched)
    // -------------------------------------------------------------
    console.log('\n[3] Testing Orchestration with Anomalies (Terminal REQUIRES_REVIEW)...');

    const anomalyResult = await orchestrator.process({
      tenantId: TENANT_A_ID,
      actorId: ACTOR_OPERATOR_A,
      documentId: doc2Id,
      documentVersionId: doc2VersionId,
      targetDomain: 'student',
      metadata: {
        items: [
          {
            // Valid item
            ocrText: 'Budi Santoso',
            matchedNisn: '0051111111',
            confidence: 88,
            status: 'Hadir',
            date: '2026-03-01',
          },
          {
            // Low confidence item (< 70%)
            ocrText: 'Siti Rahma (Buram)',
            matchedNisn: '0052222222',
            confidence: 58,
            status: 'Izin',
            date: '2026-03-01',
          },
          {
            // Unmatched student
            ocrText: 'Murid Tidak Dikenal',
            confidence: 85,
            status: 'Alpha',
            date: '2026-03-01',
          },
        ],
      },
    });

    assert(anomalyResult.status === 'REQUIRES_REVIEW', 'Anomalous document processing returns status REQUIRES_REVIEW');
    assert(anomalyResult.processedItems.length === 3, 'Result contains 3 processed items');
    assert(anomalyResult.summary.totalItemsExtracted === 3, 'Summary totalItemsExtracted = 3');
    assert(anomalyResult.summary.itemsResolved === 2, 'Summary itemsResolved = 2 (Budi & Siti)');
    assert(anomalyResult.summary.itemsUnresolved === 1, 'Summary itemsUnresolved = 1 (Unmatched)');
    assert(anomalyResult.summary.exceptionsCreatedCount === 2, 'Summary exceptionsCreatedCount = 2 (low-conf & unmatched)');
    assert(anomalyResult.summary.itemsRequiringReview === 2, 'Summary itemsRequiringReview = 2');
    assert(anomalyResult.exceptionIds.length === 2, 'Exactly 2 exception IDs returned');

    // Verify exception creation in PostgreSQL database
    const dbExceptions = await adminPrisma.exceptionItem.findMany({
      where: { tenantId: TENANT_A_ID, id: { in: anomalyResult.exceptionIds } },
    });
    assert(dbExceptions.length === 2, 'Exceptions persisted in database under tenant RLS');
    assert(
      dbExceptions.every((e) => e.status === 'OPEN'),
      'All generated exceptions have status OPEN'
    );
    assert(
      dbExceptions.every((e) => e.ruleCode === 'OCR_CONFIDENCE_RULE'),
      'All generated exceptions have ruleCode OCR_CONFIDENCE_RULE'
    );

    // -------------------------------------------------------------
    // 5. Test Suite 4: Tenant Isolation & RLS Boundary
    // -------------------------------------------------------------
    console.log('\n[4] Testing Tenant Isolation...');

    // Operator B in Tenant B attempting to process Tenant A's document
    const crossTenantResult = await orchestrator.process({
      tenantId: TENANT_B_ID,
      actorId: ACTOR_OPERATOR_B,
      documentId: doc1Id,
      documentVersionId: doc1VersionId,
      targetDomain: 'student',
    });

    assert(crossTenantResult.status === 'FAILED', 'Cross-tenant document access returns status FAILED');
    assert(
      Boolean(crossTenantResult.errorMessage?.includes('Document not found')),
      'Tenant B cannot access Tenant A document due to tenant RLS boundary'
    );

    // -------------------------------------------------------------
    // 6. Test Suite 5: Audit Event Verification
    // -------------------------------------------------------------
    console.log('\n[5] Testing Audit Trail Verification...');

    const auditEventRecord = await adminPrisma.auditEvent.findUnique({
      where: { id: cleanResult.auditEventId! },
    });
    assert(auditEventRecord !== null, 'Audit event persisted in PostgreSQL');
    assert(auditEventRecord?.action === 'PROCESS_DOCUMENT_INTELLIGENCE', 'AuditEvent action is PROCESS_DOCUMENT_INTELLIGENCE');
    assert(auditEventRecord?.actorUserId === ACTOR_OPERATOR_A, 'AuditEvent captures actorUserId correctly');
    assert(auditEventRecord?.tenantId === TENANT_A_ID, 'AuditEvent captures tenantId correctly');

    // -------------------------------------------------------------
    // 7. Test Suite 6: JSON Serializability Contract
    // -------------------------------------------------------------
    console.log('\n[6] Testing JSON Serializability Contract...');

    const serialized = JSON.stringify(anomalyResult);
    const parsed = JSON.parse(serialized);
    assert(
      parsed.status === 'REQUIRES_REVIEW' &&
      parsed.processedItems.length === 3 &&
      parsed.summary.exceptionsCreatedCount === 2,
      'Pipeline result is 100% JSON serializable for server action / client boundaries'
    );

  } finally {
    try {
      await adminPrisma.exceptionItem.deleteMany({
        where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
      });
      await adminPrisma.workflowInstance.deleteMany({
        where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
      });
      await adminPrisma.extractedItem.deleteMany({
        where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
      });
      await adminPrisma.oCRExtraction.deleteMany({
        where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
      });
      await adminPrisma.documentVersion.deleteMany({
        where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
      });
      await adminPrisma.document.deleteMany({
        where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
      });
      await adminPrisma.student.deleteMany({
        where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
      });
    } catch (cleanupErr) {
      // Ignore cleanup error
    }

    await adminPrisma.$disconnect();
    await adminPool.end();
  }

  console.log('\n================================================================');
  console.log(` SUMMARY: ${passCount} / ${testCount} TESTS PASSED `);
  console.log('================================================================\n');

  if (passCount !== testCount) {
    process.exit(1);
  }
}

runDocumentIntelligenceOrchestratorTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
