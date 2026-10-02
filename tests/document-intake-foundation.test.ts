import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'crypto';
import { DocumentCategory, DocumentStatus, UserRole } from '@prisma/client';
import {
  listDocumentsAction,
  uploadDocumentIntakeAction,
  getDocumentDetailsAction,
} from '../src/platform/actions/document';
import {
  setSessionProvider,
  resetSessionProvider,
  AuthenticatedActorContext,
} from '../src/platform/auth/session';
import {
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_SOURCE_LABELS,
  DOCUMENT_STATUS_LABELS,
  formatBytesToIndonesian,
} from '../src/platform/types/document';

const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!migrationUrl) {
  throw new Error('SECURITY ERROR: MIGRATION_DATABASE_URL environment variable is missing.');
}
const migrationPool = new pg.Pool({ connectionString: migrationUrl });

const TENANT_A_ID = '77777777-7777-4777-8777-777777777777';
const TENANT_B_ID = '88888888-8888-4888-8888-888888888888';

const ACTOR_A_ID = 'a7777777-7777-4777-8777-777777777777';
const ACTOR_B_ID = 'b8888888-8888-4888-8888-888888888888';

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
    ('${TENANT_A_ID}', 'INTAKE-TENANT-A', 'Intake Test Tenant A', 'ACTIVE', NOW(), NOW()),
    ('${TENANT_B_ID}', 'INTAKE-TENANT-B', 'Intake Test Tenant B', 'ACTIVE', NOW(), NOW());
  `);

  await migrationPool.query(`
    INSERT INTO user_actors (id, tenant_id, username, email, full_name, role, status, created_at, updated_at) VALUES
    ('${ACTOR_A_ID}', '${TENANT_A_ID}', 'admin_intake_a', 'admin_a@intake.test', 'Admin Intake A', 'ADMIN', 'ACTIVE', NOW(), NOW()),
    ('${ACTOR_B_ID}', '${TENANT_B_ID}', 'admin_intake_b', 'admin_b@intake.test', 'Admin Intake B', 'ADMIN', 'ACTIVE', NOW(), NOW());
  `);
}

async function runAllTests() {
  console.log('\n=== P0-G: Document Intake Foundation Test Suite ===\n');

  try {
    await setupFixtures();

    // 1. Test helper mappings
    assert(
      DOCUMENT_CATEGORY_LABELS.KARTU_KELUARGA === 'Kartu Keluarga' &&
        DOCUMENT_CATEGORY_LABELS.IJAZAH === 'Ijazah',
      'DOCUMENT_CATEGORY_LABELS returns correct Indonesian labels'
    );
    assert(
      DOCUMENT_SOURCE_LABELS.UNGGAH_LANGSUNG === 'Unggah Langsung' &&
        DOCUMENT_SOURCE_LABELS.TAUTAN_PUBLIK === 'Tautan Publik',
      'DOCUMENT_SOURCE_LABELS returns correct Indonesian labels'
    );
    assert(
      DOCUMENT_STATUS_LABELS.DRAFT === 'Diterima' &&
        DOCUMENT_STATUS_LABELS.PENDING_VERIFICATION === 'Perlu Diperiksa',
      'DOCUMENT_STATUS_LABELS returns correct Indonesian labels'
    );
    assert(
      formatBytesToIndonesian(1048576) === '1 MB',
      'formatBytesToIndonesian formats bytes correctly'
    );

    // 2. Test direct document upload via uploadDocumentIntakeAction
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'admin_intake_a',
        role: UserRole.ADMIN,
        status: 'ACTIVE',
      }),
    });

    const fileContent = 'Dummy PDF content for testing document intake ' + randomUUID();
    const mockFile = new File([fileContent], 'ijazah_siswa_2026.pdf', {
      type: 'application/pdf',
    });

    const formData = new FormData();
    formData.append('file', mockFile);
    formData.append('category', DocumentCategory.IJAZAH);
    formData.append('isTemporary', 'false');

    const uploadRes = await uploadDocumentIntakeAction(formData);

    assert(uploadRes.success === true, 'uploadDocumentIntakeAction succeeds for valid PDF upload');
    assert(
      uploadRes.data?.title === 'ijazah_siswa_2026.pdf',
      'uploadDocumentIntakeAction stores correct document title'
    );
    assert(
      uploadRes.data?.category === DocumentCategory.IJAZAH,
      'uploadDocumentIntakeAction stores correct category'
    );
    assert(
      uploadRes.data?.source === 'UNGGAH_LANGSUNG',
      'uploadDocumentIntakeAction stores source as UNGGAH_LANGSUNG'
    );
    assert(
      uploadRes.data?.status === DocumentStatus.DRAFT,
      'uploadDocumentIntakeAction sets initial status to DRAFT (Diterima)'
    );
    assert(
      uploadRes.data?.checksumSha256 !== null && uploadRes.data?.checksumSha256 !== undefined,
      'uploadDocumentIntakeAction computes and saves SHA-256 integrity hash'
    );
    assert(
      uploadRes.data?.storageKey !== null && uploadRes.data?.storageKey !== undefined,
      'uploadDocumentIntakeAction saves storageKey foundation'
    );

    const docId = uploadRes.data!.id;

    // 3. Test listDocumentsAction
    const listRes = await listDocumentsAction();
    assert(listRes.success === true, 'listDocumentsAction returns successful response');
    assert(listRes.data?.documents.length === 1, 'listDocumentsAction lists uploaded document');
    assert(
      listRes.data?.documents[0]?.id === docId,
      'listDocumentsAction returns matching document ID'
    );
    assert(
      listRes.data?.documents[0]?.categoryLabel === 'Ijazah',
      'listDocumentsAction provides formatted category label'
    );

    // 4. Test list filtering by category
    const filterCatRes = await listDocumentsAction({ category: DocumentCategory.KTP });
    assert(
      filterCatRes.success === true && filterCatRes.data?.documents.length === 0,
      'listDocumentsAction correctly filters by category'
    );

    // 5. Test search filter
    const searchRes = await listDocumentsAction({ search: 'ijazah' });
    assert(
      searchRes.success === true && searchRes.data?.documents.length === 1,
      'listDocumentsAction correctly searches by title query'
    );

    // 6. Test getDocumentDetailsAction
    const detailRes = await getDocumentDetailsAction(docId);
    assert(detailRes.success === true, 'getDocumentDetailsAction retrieves document details');
    assert(
      detailRes.data?.versions?.length === 1,
      'getDocumentDetailsAction includes version history'
    );
    assert(
      detailRes.data?.versions?.[0]?.storageKey === uploadRes.data?.storageKey,
      'getDocumentDetailsAction includes storage key in version'
    );

    // 7. Test Tenant Isolation
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_B_ID,
        tenantId: TENANT_B_ID,
        username: 'admin_intake_b',
        role: UserRole.ADMIN,
        status: 'ACTIVE',
      }),
    });

    const tenantBList = await listDocumentsAction();
    assert(
      tenantBList.success === true && tenantBList.data?.documents.length === 0,
      'Tenant B cannot see Tenant A documents (Tenant Isolation)'
    );

    const tenantBAccessDetail = await getDocumentDetailsAction(docId);
    assert(
      tenantBAccessDetail.success === false,
      'Tenant B cannot access Tenant A document details'
    );

    console.log(`\nResults: ${passCount}/${testCount} tests passed.`);
    if (passCount === testCount) {
      console.log('ALL TESTS PASSED!\n');
    } else {
      console.error('SOME TESTS FAILED!\n');
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

void runAllTests();
