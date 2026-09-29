import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'crypto';
import { DocumentCategory, DocumentStatus, OCRExtractionStatus, UserRole } from '@prisma/client';
import { adminPrisma } from '../src/platform/db/prisma';
import { getObjectStorageProvider, buildDocumentStoragePath } from '../src/platform/storage';
import { DocumentOCRService } from '../src/platform/services/document-ocr';
import {
  readDocumentOCRAction,
  getDocumentOCRResultAction,
  listDocumentsForOCRAction,
} from '../src/platform/actions/document-ocr';
import { setSessionProvider } from '../src/platform/auth/session';
import { OCR_STATUS_LABELS } from '../src/platform/types/ocr';

const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!migrationUrl) {
  throw new Error('SECURITY ERROR: MIGRATION_DATABASE_URL environment variable is missing.');
}
const migrationPool = new pg.Pool({ connectionString: migrationUrl });

const TENANT_A_ID = '33333333-3333-4333-8333-333333333333';
const TENANT_B_ID = '66666666-6666-4666-8666-666666666666';

const ACTOR_A_ID = 'a3333333-3333-4333-8333-333333333333';
const ACTOR_B_ID = 'b6666666-6666-4666-8666-666666666666';

const DOC_A_ID = 'd3333333-3333-4333-8333-333333333333';
const VER_A_ID = 'v3333333-3333-4333-8333-333333333333';

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

async function cleanupFixtures() {
  try {
    await migrationPool.query(
      `DELETE FROM ocr_extractions WHERE tenant_id IN ('${TENANT_A_ID}', '${TENANT_B_ID}');`
    );
    await migrationPool.query(
      `DELETE FROM audit_events WHERE tenant_id IN ('${TENANT_A_ID}', '${TENANT_B_ID}');`
    );
    await migrationPool.query(
      `DELETE FROM document_versions WHERE tenant_id IN ('${TENANT_A_ID}', '${TENANT_B_ID}');`
    );
    await migrationPool.query(
      `DELETE FROM documents WHERE tenant_id IN ('${TENANT_A_ID}', '${TENANT_B_ID}');`
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
    ('${TENANT_A_ID}', 'OCR-TENANT-A', 'OCR Test Tenant A', 'ACTIVE', NOW(), NOW()),
    ('${TENANT_B_ID}', 'OCR-TENANT-B', 'OCR Test Tenant B', 'ACTIVE', NOW(), NOW());
  `);

  await migrationPool.query(`
    INSERT INTO user_actors (id, tenant_id, username, email, full_name, role, status, created_at, updated_at) VALUES
    ('${ACTOR_A_ID}', '${TENANT_A_ID}', 'admin_ocr_a', 'admin_a@ocr.test', 'Admin OCR A', 'ADMIN', 'ACTIVE', NOW(), NOW()),
    ('${ACTOR_B_ID}', '${TENANT_B_ID}', 'admin_ocr_b', 'admin_b@ocr.test', 'Admin OCR B', 'ADMIN', 'ACTIVE', NOW(), NOW());
  `);
}

async function runOCRFoundationTests() {
  console.log('\n=== P0-H: OCR Foundation Test Suite ===\n');

  try {
    await setupFixtures();

    // 1. Check OCR Indonesian Status Labels
    assert(
      OCR_STATUS_LABELS.QUEUED === 'Menunggu Pembacaan' &&
        OCR_STATUS_LABELS.PROCESSING === 'Sedang Dibaca' &&
        OCR_STATUS_LABELS.COMPLETED === 'Selesai Dibaca (Siap Diekstraksi)' &&
        OCR_STATUS_LABELS.FAILED === 'Gagal Dibaca (Perlu Diperiksa)',
      'OCR_STATUS_LABELS maps to formal Indonesian school administration terminology'
    );

    // 2. Prepare uploaded document fixture in storage and database
    const storage = getObjectStorageProvider();
    const testContent = Buffer.from('PEMERINTAH KABUPATEN BANYUBIRU\nDINAS PENDIDIKAN\nSURAT KETERANGAN');
    const storagePath = buildDocumentStoragePath(TENANT_A_ID, DOC_A_ID, 1, 'surat_tugas_guru.pdf');

    const uploadResult = await storage.upload({
      tenantId: TENANT_A_ID,
      storagePath,
      content: testContent,
      mimeType: 'application/pdf',
    });

    await migrationPool.query(`
      INSERT INTO documents (id, tenant_id, title, category, sumber, current_version, status, is_temporary, created_at, updated_at)
      VALUES ('${DOC_A_ID}', '${TENANT_A_ID}', 'surat_tugas_guru.pdf', 'SURAT_TUGAS', 'UNGGAH_LANGSUNG', 1, 'DRAFT', false, NOW(), NOW());
    `);

    await migrationPool.query(`
      INSERT INTO document_versions (id, tenant_id, document_id, version_number, file_path, storage_key, storage_status, file_size_bytes, mime_type, checksum_sha256, created_at)
      VALUES ('${VER_A_ID}', '${TENANT_A_ID}', '${DOC_A_ID}', 1, '${uploadResult.storagePath}', '${uploadResult.storagePath}', 'ACTIVE', ${uploadResult.sizeBytes}, 'application/pdf', '${uploadResult.checksumSha256}', NOW());
    `);

    // Mock extractor that returns text
    const mockExtractor = {
      extract: async () => ({
        success: true,
        items: [],
        rawText: 'PEMERINTAH KABUPATEN BANYUBIRU\nDINAS PENDIDIKAN\nSURAT KETERANGAN',
      }),
    };

    // 3. Test DocumentOCRService.readDocumentText
    const ocrService = new DocumentOCRService(adminPrisma, storage, mockExtractor);
    const ocrResult = await ocrService.readDocumentText({
      tenantId: TENANT_A_ID,
      actorId: ACTOR_A_ID,
      documentId: DOC_A_ID,
      documentVersionId: VER_A_ID,
    });

    assert(
      ocrResult.status === OCRExtractionStatus.COMPLETED,
      'DocumentOCRService sets status to COMPLETED on success'
    );
    assert(
      ocrResult.documentId === DOC_A_ID && ocrResult.documentVersionId === VER_A_ID,
      'DocumentOCRService links result to Document and DocumentVersion'
    );
    assert(
      Boolean(ocrResult.extractedText?.includes('PEMERINTAH KABUPATEN BANYUBIRU')),
      'DocumentOCRService stores extracted text'
    );
    assert(
      ocrResult.checksumSha256 === uploadResult.checksumSha256,
      'DocumentOCRService retains original SHA-256 integrity hash'
    );
    assert(
      ocrResult.storageKey === uploadResult.storagePath,
      'DocumentOCRService retains original storageKey reference'
    );
    assert(
      ocrResult.startedAt !== null && ocrResult.completedAt !== null,
      'DocumentOCRService records startedAt and completedAt timestamps'
    );

    // 4. Test Server Action: getDocumentOCRResultAction
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'admin_ocr_a',
        role: UserRole.ADMIN,
        status: 'ACTIVE',
      }),
    });

    const getRes = await getDocumentOCRResultAction(DOC_A_ID);
    assert(getRes.success === true, 'getDocumentOCRResultAction returns success');
    assert(
      Boolean(getRes.data?.extractedText?.includes('SURAT KETERANGAN')),
      'getDocumentOCRResultAction returns stored reading result'
    );

    // 5. Test Server Action: listDocumentsForOCRAction
    const listRes = await listDocumentsForOCRAction();
    assert(listRes.success === true, 'listDocumentsForOCRAction returns success');
    const item = listRes.data?.find((d) => d.documentId === DOC_A_ID);
    assert(
      item?.ocrStatus === OCRExtractionStatus.COMPLETED && item?.hasOCRResult === true,
      'listDocumentsForOCRAction reports COMPLETED status and hasOCRResult flag'
    );

    // 6. Test Multi-Tenant Isolation
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_B_ID,
        tenantId: TENANT_B_ID,
        username: 'admin_ocr_b',
        role: UserRole.ADMIN,
        status: 'ACTIVE',
      }),
    });

    const tenantBAccess = await getDocumentOCRResultAction(DOC_A_ID);
    assert(
      tenantBAccess.success === true && tenantBAccess.data === null,
      'Tenant B cannot read Tenant A OCR extraction result (Tenant Isolation)'
    );

    const tenantBList = await listDocumentsForOCRAction();
    const tenantBDocA = tenantBList.data?.find((d) => d.documentId === DOC_A_ID);
    assert(
      Boolean(tenantBDocA === undefined),
      'Tenant B document list does not contain Tenant A documents'
    );

    console.log(`\nResults: ${passCount}/${testCount} tests passed.`);
    if (passCount === testCount) {
      console.log('ALL OCR FOUNDATION TESTS PASSED!\n');
    } else {
      console.error('SOME OCR FOUNDATION TESTS FAILED!\n');
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await cleanupFixtures();
    await migrationPool.end();
  }
}

void runOCRFoundationTests();
