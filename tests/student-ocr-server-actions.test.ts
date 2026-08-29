import 'dotenv/config';
import pg from 'pg';
import { PrismaClient, AbsenceStatus, OCRExtractionStatus, UserRole, UserStatus, VerificationDecision } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  getOCRDocumentsAction,
  uploadOCRDocumentAction,
  verifyExtractedItemAction,
} from '../src/platform/actions/student-workflow';
import {
  mapToDbAbsenceStatus,
  mapToDtoAbsenceStatus,
} from '../src/domains/student/mappers';
import {
  setSessionProvider,
  resetSessionProvider,
  AuthenticatedActorContext,
} from '../src/platform/auth';
import {
  calculateSha256,
  getObjectStorageProvider,
  resetObjectStorageProvider,
} from '../src/platform/storage';

let testCount = 0;
let passCount = 0;

function assert(condition: boolean, message: string, detail?: string) {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`  ✓ Test ${testCount}: ${message}`);
  } else {
    console.error(`  ✗ Test ${testCount} FAILED: ${message} (${detail || ''})`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runStudentOCRServerActionsTests() {
  console.log('=====================================================');
  console.log(' STUDENT OCR / WORKFLOW SERVER ACTIONS TEST SUITE     ');
  console.log('=====================================================\n');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_A_ID = '22222222-2222-7222-8222-222222222222';
  const TENANT_B_ID = '33333333-3333-7333-8333-333333333333';

  const ACTOR_OPERATOR_A_ID = 'c1111111-1111-7111-8111-111111111111';
  const ACTOR_VERIFIKATOR_A_ID = 'c2222222-2222-7222-8222-222222222222';
  const ACTOR_INACTIVE_A_ID = 'c5555555-5555-7555-8555-555555555555';
  const ACTOR_OPERATOR_B_ID = 'd1111111-1111-7111-8111-111111111111';

  const STUDENT_A1_ID = 'e1111111-1111-7111-8111-111111111111';

  try {
    // 1. Setup tenants
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_A_ID },
      create: { id: TENANT_A_ID, name: 'OCR Tenant A', code: 'OCR_TENANT_A', status: 'ACTIVE' },
      update: { name: 'OCR Tenant A', code: 'OCR_TENANT_A' },
    });
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_B_ID },
      create: { id: TENANT_B_ID, name: 'OCR Tenant B', code: 'OCR_TENANT_B', status: 'ACTIVE' },
      update: { name: 'OCR Tenant B', code: 'OCR_TENANT_B' },
    });

    // 2. Setup user actors (using DB-valid UserRoles)
    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_OPERATOR_A_ID },
      create: {
        id: ACTOR_OPERATOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'ocr_op_a',
        email: 'ocr_op_a@test.local',
        fullName: 'OCR Operator A',
        role: UserRole.OPERATOR,
        status: UserStatus.ACTIVE,
      },
      update: { status: UserStatus.ACTIVE, role: UserRole.OPERATOR },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_VERIFIKATOR_A_ID },
      create: {
        id: ACTOR_VERIFIKATOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'ocr_verif_a',
        email: 'ocr_verif_a@test.local',
        fullName: 'OCR Verifikator A',
        role: UserRole.VERIFIKATOR,
        status: UserStatus.ACTIVE,
      },
      update: { status: UserStatus.ACTIVE, role: UserRole.VERIFIKATOR },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_INACTIVE_A_ID },
      create: {
        id: ACTOR_INACTIVE_A_ID,
        tenantId: TENANT_A_ID,
        username: 'ocr_inact_a',
        email: 'ocr_inact_a@test.local',
        fullName: 'OCR Inactive A',
        role: UserRole.OPERATOR,
        status: UserStatus.INACTIVE,
      },
      update: { status: UserStatus.INACTIVE, role: UserRole.OPERATOR },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_OPERATOR_B_ID },
      create: {
        id: ACTOR_OPERATOR_B_ID,
        tenantId: TENANT_B_ID,
        username: 'ocr_op_b',
        email: 'ocr_op_b@test.local',
        fullName: 'OCR Operator B',
        role: UserRole.OPERATOR,
        status: UserStatus.ACTIVE,
      },
      update: { status: UserStatus.ACTIVE, role: UserRole.OPERATOR },
    });

    // 3. Setup student in Tenant A
    await adminPrisma.student.upsert({
      where: { id: STUDENT_A1_ID },
      create: {
        id: STUDENT_A1_ID,
        tenantId: TENANT_A_ID,
        nisn: '0051234569',
        nis: '21221003',
        fullName: 'Citra Dewi',
        className: 'X IPA 1',
        status: 'ACTIVE',
      },
      update: { fullName: 'Citra Dewi', className: 'X IPA 1', status: 'ACTIVE' },
    });

    // =========================================================================
    // TEST 1 — Unauthenticated Read Fails Closed
    // =========================================================================
    console.log('[1] Testing Unauthenticated Read...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return null;
      },
    });

    const unauthReadRes = await getOCRDocumentsAction();
    assert(
      !unauthReadRes.success && unauthReadRes.error?.code === 'UNAUTHENTICATED',
      'TEST 1: getOCRDocumentsAction fails closed with UNAUTHENTICATED when session is null'
    );

    // =========================================================================
    // TEST 2 — Unauthenticated Upload Fails Closed
    // =========================================================================
    console.log('\n[2] Testing Unauthenticated Upload...');
    const unauthUploadRes = await uploadOCRDocumentAction({
      fileName: 'Unauth_Doc.png',
      items: [{ ocrText: 'Test item', confidence: 80 }],
    });
    assert(
      !unauthUploadRes.success && unauthUploadRes.error?.code === 'UNAUTHENTICATED',
      'TEST 2: uploadOCRDocumentAction fails closed with UNAUTHENTICATED when session is null'
    );

    // =========================================================================
    // TEST 3 — Unauthenticated Verification Fails Closed
    // =========================================================================
    console.log('\n[3] Testing Unauthenticated Verification...');
    const unauthVerifyRes = await verifyExtractedItemAction({
      itemId: '00000000-0000-0000-0000-000000000000',
    });
    assert(
      !unauthVerifyRes.success && unauthVerifyRes.error?.code === 'UNAUTHENTICATED',
      'TEST 3: verifyExtractedItemAction fails closed with UNAUTHENTICATED when session is null'
    );

    // =========================================================================
    // TEST 4 — Inactive Account Rejection
    // =========================================================================
    console.log('\n[4] Testing Inactive Account Rejection...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: ACTOR_INACTIVE_A_ID,
          tenantId: TENANT_A_ID,
          username: 'ocr_inact_a',
          role: UserRole.OPERATOR,
          status: UserStatus.INACTIVE,
        };
      },
    });

    const inactiveRes = await getOCRDocumentsAction();
    assert(
      !inactiveRes.success && inactiveRes.error?.code === 'UNAUTHENTICATED',
      'TEST 4: Inactive actor session rejected with UNAUTHENTICATED'
    );

    // =========================================================================
    // TEST 5 — Malformed Actor UUID
    // =========================================================================
    console.log('\n[5] Testing Malformed Actor UUID...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: 'malformed-actor-uuid',
          tenantId: TENANT_A_ID,
          username: 'ocr_malformed',
          role: UserRole.OPERATOR,
          status: UserStatus.ACTIVE,
        };
      },
    });

    const malformedRes = await getOCRDocumentsAction();
    assert(
      !malformedRes.success && malformedRes.error?.code === 'UNAUTHENTICATED',
      'TEST 5: Malformed actor UUID rejected with UNAUTHENTICATED'
    );

    // =========================================================================
    // TEST 6 — Authorized Document Upload (Operator)
    // =========================================================================
    console.log('\n[6] Testing Authorized Document Upload...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: ACTOR_OPERATOR_A_ID,
          tenantId: TENANT_A_ID,
          username: 'ocr_op_a',
          role: UserRole.OPERATOR,
          status: UserStatus.ACTIVE,
        };
      },
    });

    const uploadPayload = {
      fileName: 'Surat_Izin_Ketidakhadiran_Test.png',
      fileSize: 520000,
      imageUrl: '/placeholder-doc.png',
      items: [
        {
          ocrText: 'Citra Dewi - X IPA 1 - Sakit demam',
          matchedStudentName: 'Citra Dewi',
          matchedNisn: '0051234569',
          confidence: 95,
          class: 'X IPA 1',
          date: '2026-08-28',
          status: 'Sakit' as const,
          notes: 'Demam tinggi 2 hari',
        },
        {
          ocrText: 'Budi Santoso - X IPA 2 - Izin urusan keluarga',
          matchedStudentName: 'Budi Santoso',
          matchedNisn: '0059876543',
          confidence: 65,
          class: 'X IPA 2',
          date: '2026-08-28',
          status: 'Izin' as const,
          notes: 'Urusan keluarga di luar kota',
        },
      ],
    };

    const uploadRes = await uploadOCRDocumentAction(uploadPayload);
    assert(
      uploadRes.success && uploadRes.data !== undefined,
      'TEST 6A: Operator successfully uploads OCR document'
    );
    assert(
      uploadRes.data?.items.length === 2 && uploadRes.data.extractedCount === 2,
      'TEST 6B: Document returns 2 extracted items with correct counts'
    );
    assert(
      uploadRes.data?.verifiedCount === 0 && uploadRes.data?.status === 'needs_verification',
      'TEST 6C: Newly uploaded document status is needs_verification with 0 verified items'
    );

    const docId = uploadRes.data!.id;
    const item1Id = uploadRes.data!.items[0].id;
    const item2Id = uploadRes.data!.items[1].id;

    // Verify metadata-only upload has null checksumSha256 (no fake SHA-256 or synthetic timestamp)
    const legacyDocVersion = await adminPrisma.documentVersion.findFirst({
      where: { documentId: docId, tenantId: TENANT_A_ID },
    });
    assert(
      legacyDocVersion !== null && legacyDocVersion.checksumSha256 === null,
      'TEST 6D: Metadata-only upload without binary sets checksumSha256 to null (no fake SHA-256, no synthetic timestamp)'
    );

    // =========================================================================
    // TEST 7 — Invariant: Pending ExtractedItem has absenceRecordId === null
    // =========================================================================
    console.log('\n[7] Testing Pending Item Invariant & OCRExtraction status...');
    const item1Db = await adminPrisma.extractedItem.findUnique({
      where: { id: item1Id },
      include: { ocrExtraction: true },
    });
    assert(
      item1Db?.absenceRecordId === null,
      'TEST 7A: Pending ExtractedItem has absenceRecordId === null in PostgreSQL'
    );
    assert(
      item1Db?.ocrExtraction.status === OCRExtractionStatus.COMPLETED,
      'TEST 7B: OCRExtraction status is COMPLETED (extraction computational job completed)'
    );

    // =========================================================================
    // TEST 8 — Audit Event Recorded for Upload
    // =========================================================================
    console.log('\n[8] Testing Audit Event for Upload...');
    const uploadAudit = await adminPrisma.auditEvent.findFirst({
      where: {
        tenantId: TENANT_A_ID,
        entityId: docId,
        action: 'UPLOAD_OCR',
      },
    });
    assert(
      uploadAudit !== null && uploadAudit.actorUserId === ACTOR_OPERATOR_A_ID,
      'TEST 8: Audit event is recorded under transaction with actorUserId = ACTOR_OPERATOR_A_ID'
    );

    // =========================================================================
    // TEST 9 — Authorized Document Read
    // =========================================================================
    console.log('\n[9] Testing Authorized Document Read...');
    const readDocsRes = await getOCRDocumentsAction();
    assert(
      readDocsRes.success && Array.isArray(readDocsRes.data) && readDocsRes.data.length >= 1,
      'TEST 9A: Operator can read OCR documents list'
    );
    const foundUploadedDoc = readDocsRes.data?.find((d) => d.id === docId);
    assert(
      foundUploadedDoc !== undefined && foundUploadedDoc.items.length === 2,
      'TEST 9B: Read document matches uploaded document with correct extracted items'
    );

    // =========================================================================
    // TEST 10 — Authorized Item Verification (Verifikator)
    // =========================================================================
    console.log('\n[10] Testing Authorized Item Verification (PASSED decision)...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: ACTOR_VERIFIKATOR_A_ID,
          tenantId: TENANT_A_ID,
          username: 'ocr_verif_a',
          role: UserRole.VERIFIKATOR,
          status: UserStatus.ACTIVE,
        };
      },
    });

    const verifyItem1Res = await verifyExtractedItemAction({
      itemId: item1Id,
      decision: 'PASSED',
      notes: 'Surat dokter terverifikasi valid',
    });

    assert(
      verifyItem1Res.success && verifyItem1Res.data?.verifiedItemId === item1Id,
      'TEST 10A: Verifikator successfully verifies item 1 with PASSED decision'
    );
    assert(
      verifyItem1Res.data?.documentCompleted === false,
      'TEST 10B: Document is not yet completed because item 2 remains pending'
    );

    // Verify DB state for item 1 and absence record
    const item1AfterVerify = await adminPrisma.extractedItem.findUnique({
      where: { id: item1Id },
      include: { absenceRecord: true },
    });

    assert(
      item1AfterVerify?.absenceRecordId !== null && item1AfterVerify?.absenceRecord !== null,
      'TEST 10C: ExtractedItem now links to newly created AbsenceRecord in PostgreSQL'
    );
    assert(
      item1AfterVerify?.absenceRecord?.studentId === STUDENT_A1_ID &&
        item1AfterVerify?.absenceRecord?.status === AbsenceStatus.SAKIT,
      'TEST 10D: AbsenceRecord uses canonical AbsenceStatus.SAKIT enum'
    );

    // Check HumanVerification record with canonical VerificationDecision.PASSED
    const humanVerif = await adminPrisma.humanVerification.findFirst({
      where: {
        tenantId: TENANT_A_ID,
        targetEntityId: item1Id,
      },
    });
    assert(
      humanVerif !== null &&
        humanVerif.verifiedByUserId === ACTOR_VERIFIKATOR_A_ID &&
        humanVerif.decision === VerificationDecision.PASSED,
      'TEST 10E: HumanVerification audit trail created with decision = PASSED'
    );

    // =========================================================================
    // TEST 11 — Complete All Items & Document State Transition
    // =========================================================================
    console.log('\n[11] Testing Document Completion on All Items Verified...');
    const verifyItem2Res = await verifyExtractedItemAction({
      itemId: item2Id,
      decision: 'PASSED',
      notes: 'Izin keluarga terverifikasi',
    });

    assert(
      verifyItem2Res.success && verifyItem2Res.data?.documentCompleted === true,
      'TEST 11A: Document completes when all items are verified'
    );

    const docAfterAllVerified = await adminPrisma.document.findUnique({
      where: { id: docId },
    });

    assert(
      docAfterAllVerified?.status === 'VERIFIED',
      'TEST 11B: Document status transitions to VERIFIED'
    );

    // =========================================================================
    // TEST 12 — Unauthorized Roles (Pegawai) Rejected
    // =========================================================================
    console.log('\n[12] Testing Unauthorized Roles (Pegawai)...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: ACTOR_OPERATOR_A_ID,
          tenantId: TENANT_A_ID,
          username: 'ocr_peg_a',
          role: UserRole.PEGAWAI,
          status: UserStatus.ACTIVE,
        };
      },
    });

    const pegReadRes = await getOCRDocumentsAction();
    assert(
      !pegReadRes.success && pegReadRes.error?.code === 'FORBIDDEN',
      'TEST 12A: Pegawai role forbidden from reading OCR documents'
    );

    const pegUploadRes = await uploadOCRDocumentAction(uploadPayload);
    assert(
      !pegUploadRes.success && pegUploadRes.error?.code === 'FORBIDDEN',
      'TEST 12B: Pegawai role forbidden from uploading OCR documents'
    );

    const pegVerifyRes = await verifyExtractedItemAction({ itemId: item1Id });
    assert(
      !pegVerifyRes.success && pegVerifyRes.error?.code === 'FORBIDDEN',
      'TEST 12C: Pegawai role forbidden from verifying extracted items'
    );

    // =========================================================================
    // TEST 13 — Tenant Isolation on Read
    // =========================================================================
    console.log('\n[13] Testing Tenant Isolation on Read...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: ACTOR_OPERATOR_B_ID,
          tenantId: TENANT_B_ID,
          username: 'ocr_op_b',
          role: UserRole.OPERATOR,
          status: UserStatus.ACTIVE,
        };
      },
    });

    const tenantBDocsRes = await getOCRDocumentsAction();
    const hasTenantADocInB = tenantBDocsRes.data?.some((d) => d.id === docId);
    assert(
      tenantBDocsRes.success && hasTenantADocInB === false,
      'TEST 13: Actor in Tenant B cannot see documents belonging to Tenant A'
    );

    // =========================================================================
    // TEST 14 — Tenant Isolation on Verification
    // =========================================================================
    console.log('\n[14] Testing Tenant Isolation on Verification...');
    const crossTenantVerifyRes = await verifyExtractedItemAction({
      itemId: item1Id,
      notes: 'Cross tenant attempt',
    });

    assert(
      !crossTenantVerifyRes.success && crossTenantVerifyRes.error?.code === 'VALIDATION_ERROR',
      'TEST 14: Actor in Tenant B cannot verify extracted item belonging to Tenant A'
    );

    // =========================================================================
    // TEST 15 — Validation Errors on Invalid Upload Payload
    // =========================================================================
    console.log('\n[15] Testing Validation Errors on Upload Payload...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: ACTOR_OPERATOR_A_ID,
          tenantId: TENANT_A_ID,
          username: 'ocr_op_a',
          role: UserRole.OPERATOR,
          status: UserStatus.ACTIVE,
        };
      },
    });

    // 15A. Empty fileName
    const emptyFileRes = await uploadOCRDocumentAction({
      fileName: '   ',
      items: [{ ocrText: 'Item 1', confidence: 90 }],
    });
    assert(
      !emptyFileRes.success && emptyFileRes.error?.code === 'VALIDATION_ERROR',
      'TEST 15A: Empty fileName rejected with VALIDATION_ERROR'
    );

    // 15B. Empty items array
    const emptyItemsRes = await uploadOCRDocumentAction({
      fileName: 'Valid_File.png',
      items: [],
    });
    assert(
      !emptyItemsRes.success && emptyItemsRes.error?.code === 'VALIDATION_ERROR',
      'TEST 15B: Empty items array rejected with VALIDATION_ERROR'
    );

    // 15C. Malformed itemId on verification
    const malformedItemVerifyRes = await verifyExtractedItemAction({
      itemId: 'not-a-valid-uuid',
    });
    assert(
      !malformedItemVerifyRes.success && malformedItemVerifyRes.error?.code === 'VALIDATION_ERROR',
      'TEST 15C: Malformed itemId rejected with VALIDATION_ERROR'
    );

    // =========================================================================
    // TEST 16 — Canonical Enum Mapping Helpers & DISPENSASI Support
    // =========================================================================
    console.log('\n[16] Testing Canonical Enum Mapping Helpers...');
    assert(mapToDbAbsenceStatus('Sakit') === AbsenceStatus.SAKIT, 'TEST 16A: "Sakit" maps to SAKIT');
    assert(mapToDbAbsenceStatus('Izin') === AbsenceStatus.IZIN, 'TEST 16B: "Izin" maps to IZIN');
    assert(mapToDbAbsenceStatus('Alpha') === AbsenceStatus.ALPHA, 'TEST 16C: "Alpha" maps to ALPHA');
    assert(mapToDbAbsenceStatus('Dispensasi') === AbsenceStatus.DISPENSASI, 'TEST 16D: "Dispensasi" maps to DISPENSASI');

    assert(mapToDtoAbsenceStatus(AbsenceStatus.SAKIT) === 'Sakit', 'TEST 16E: SAKIT maps to "Sakit" DTO');
    assert(mapToDtoAbsenceStatus(AbsenceStatus.IZIN) === 'Izin', 'TEST 16F: IZIN maps to "Izin" DTO');
    assert(mapToDtoAbsenceStatus(AbsenceStatus.ALPHA) === 'Alpha', 'TEST 16G: ALPHA maps to "Alpha" DTO');

    // =========================================================================
    // TEST 17 — JSON Serializability
    // =========================================================================
    console.log('\n[17] Testing DTO JSON Serializability...');
    const readAllDocs = await getOCRDocumentsAction();
    const serialized = JSON.stringify(readAllDocs.data);
    const parsed = JSON.parse(serialized);

    assert(
      Array.isArray(parsed) &&
        typeof parsed[0].uploadedAt === 'string' &&
        typeof parsed[0].items[0].date === 'string',
      'TEST 17: Returned OCRDocumentDTO array is completely JSON serializable'
    );

    // =========================================================================
    // TEST 18 & 19 & 20 — Automated OCR Validation Exception Bridge
    // =========================================================================
    console.log('\n[18-20] Testing Automated OCR Validation Exception Bridge...');
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_OPERATOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'ocr_op_a',
        role: UserRole.OPERATOR,
        status: UserStatus.ACTIVE,
      }),
    });

    const ocrUploadRes = await uploadOCRDocumentAction({
      fileName: 'daftar_hadir_kelas_x_mixed.png',
      fileSize: 450000,
      items: [
        {
          // Valid item: matched student and high confidence (85%)
          ocrText: 'Citra Dewi',
          matchedNisn: '0051234569',
          confidence: 85,
          class: 'X IPA 1',
          date: '2026-03-01',
          status: 'Hadir',
        },
        {
          // Failed item: low confidence (55%) even if matched
          ocrText: 'Citra Dewi (Buram)',
          matchedNisn: '0051234569',
          confidence: 55,
          class: 'X IPA 1',
          date: '2026-03-01',
          status: 'Sakit',
        },
        {
          // Failed item: unmatched student
          ocrText: 'Nama Tidak Dikenal',
          confidence: 90,
          class: 'X IPA 1',
          date: '2026-03-01',
          status: 'Alpha',
        },
      ],
    });

    assert(ocrUploadRes.success && ocrUploadRes.data?.items.length === 3, 'TEST 18A: Upload with mixed items succeeded');
    const validItemId = ocrUploadRes.data!.items[0].id;
    const lowConfItemId = ocrUploadRes.data!.items[1].id;
    const unmatchedItemId = ocrUploadRes.data!.items[2].id;

    // Verify ExceptionItem generation in database
    const validItemExceptions = await adminPrisma.exceptionItem.findMany({
      where: {
        tenantId: TENANT_A_ID,
        workflowInstance: {
          entityType: 'ExtractedItem',
          entityId: validItemId,
        },
      },
    });
    assert(validItemExceptions.length === 0, 'TEST 19: Valid OCR result creates 0 ExceptionItems');

    const lowConfExceptions = await adminPrisma.exceptionItem.findMany({
      where: {
        tenantId: TENANT_A_ID,
        workflowInstance: {
          entityType: 'ExtractedItem',
          entityId: lowConfItemId,
        },
      },
      include: {
        workflowInstance: true,
      },
    });
    assert(lowConfExceptions.length === 1, 'TEST 18B: Failed low-confidence OCR item creates exactly 1 ExceptionItem');
    assert(lowConfExceptions[0].ruleCode === 'OCR_CONFIDENCE_RULE', 'TEST 20A: Exception ruleCode is OCR_CONFIDENCE_RULE');
    assert(lowConfExceptions[0].severity === 'HIGH', 'TEST 20B: Severity ERROR mapped canonically to HIGH');
    assert(lowConfExceptions[0].status === 'OPEN', 'TEST 20C: Exception initial status is OPEN');
    assert(lowConfExceptions[0].resolutionNotes === null, 'TEST 20D: Automated exception has null resolutionNotes');
    assert(
      lowConfExceptions[0].workflowInstance.entityId === lowConfItemId,
      'TEST 20E: Exception is correctly linked to createdItem.id'
    );

    const unmatchedExceptions = await adminPrisma.exceptionItem.findMany({
      where: {
        tenantId: TENANT_A_ID,
        workflowInstance: {
          entityType: 'ExtractedItem',
          entityId: unmatchedItemId,
        },
      },
    });
    assert(unmatchedExceptions.length === 1, 'TEST 18C: Unmatched student OCR item creates exactly 1 ExceptionItem');

    // =========================================================================
    // TEST 21 — Atomic Rollback on Downstream Failure
    // =========================================================================
    console.log('\n[21] Testing Atomic Transaction Rollback...');
    const failingExceptionRepo = {
      findManyTx: async () => [],
      findByIdTx: async () => null,
      updateStatusTx: async () => { throw new Error('Unreachable'); },
      createTx: async () => { throw new Error('Unreachable'); },
      createFromValidationResultsTx: async () => {
        throw new Error('SIMULATED_DOWNSTREAM_EXCEPTION_BRIDGE_FAILURE');
      },
    };

    const rollbackUploadRes = await uploadOCRDocumentAction(
      {
        fileName: 'dokumen_rollback_test.png',
        fileSize: 320000,
        items: [
          {
            ocrText: 'Siswa Rollback',
            confidence: 40,
          },
        ],
      },
      failingExceptionRepo
    );

    assert(
      !rollbackUploadRes.success && rollbackUploadRes.error?.code === 'INTERNAL_ERROR',
      'TEST 21A: Downstream exception bridge failure fails closed'
    );

    const rolledBackDoc = await adminPrisma.document.findFirst({
      where: { title: 'dokumen_rollback_test.png' },
    });
    assert(rolledBackDoc === null, 'TEST 21B: Document rolled back atomically on exception bridge failure');

    // =========================================================================
    // TEST 22 — Real Binary Upload (Buffer) → Object Storage → SHA-256 → DocumentVersion
    // =========================================================================
    console.log('\n[22] Testing Real Binary Upload via Buffer to Object Storage & DocumentVersion...');
    resetObjectStorageProvider();
    const rawPdfBinary = Buffer.from('%PDF-1.4 Mock OCR Certificate Binary Content For Testing 12345', 'utf-8');
    const expectedSha256 = calculateSha256(rawPdfBinary);

    const binaryUploadRes = await uploadOCRDocumentAction({
      fileName: 'Surat_Izin_Real_Binary.pdf',
      fileBuffer: rawPdfBinary,
      mimeType: 'application/pdf',
      items: [
        {
          ocrText: 'Citra Dewi - Sakit Surat Dokter',
          matchedStudentName: 'Citra Dewi',
          matchedNisn: '0051234569',
          confidence: 99,
          date: '2026-08-28',
          status: 'Sakit',
        },
      ],
    });

    assert(
      binaryUploadRes.success && binaryUploadRes.data !== undefined,
      'TEST 22A: uploadOCRDocumentAction succeeds with real binary Buffer'
    );

    const binaryDocId = binaryUploadRes.data!.id;
    const docVersionDb = await adminPrisma.documentVersion.findFirst({
      where: { documentId: binaryDocId, tenantId: TENANT_A_ID },
    });

    assert(docVersionDb !== null, 'TEST 22B: DocumentVersion record created in database');
    assert(
      docVersionDb!.checksumSha256 === expectedSha256,
      `TEST 22C: DocumentVersion.checksumSha256 matches exact real binary SHA-256 digest (${expectedSha256})`
    );
    assert(
      docVersionDb!.checksumSha256 !== null && !docVersionDb!.checksumSha256.startsWith('simulated_ocr_checksum_'),
      'TEST 22D: Synthetic timestamp checksum is eliminated from real binary path'
    );
    assert(
      docVersionDb!.fileSizeBytes === BigInt(rawPdfBinary.byteLength),
      'TEST 22E: DocumentVersion.fileSizeBytes matches exact binary byte size'
    );
    assert(
      docVersionDb!.filePath.startsWith(`tenants/${TENANT_A_ID}/documents/${binaryDocId}/v1-`),
      'TEST 22F: DocumentVersion.filePath is canonical tenant-isolated storage path'
    );

    // Verify stored binary in IObjectStorageProvider matches original bytes
    const storageProvider = getObjectStorageProvider();
    const downloadedStoredBinary = await storageProvider.download(TENANT_A_ID, docVersionDb!.filePath);
    assert(
      Buffer.compare(downloadedStoredBinary, rawPdfBinary) === 0,
      'TEST 22G: Downloaded binary from IObjectStorageProvider equals original uploaded bytes'
    );

    // =========================================================================
    // TEST 23 — Real Binary Upload via Base64 Payload
    // =========================================================================
    console.log('\n[23] Testing Real Binary Upload via Base64 Payload...');
    const rawImageBinary = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const base64Payload = rawImageBinary.toString('base64');
    const expectedBase64Sha = calculateSha256(rawImageBinary);

    const base64UploadRes = await uploadOCRDocumentAction({
      fileName: 'Scan_Surat_Base64.png',
      fileBase64: base64Payload,
      mimeType: 'image/png',
      items: [
        {
          ocrText: 'Budi Santoso - Sakit Surat Base64',
          matchedStudentName: 'Budi Santoso',
          matchedNisn: '0059876543',
          confidence: 90,
          date: '2026-08-28',
          status: 'Sakit',
        },
      ],
    });

    assert(
      base64UploadRes.success && base64UploadRes.data !== undefined,
      'TEST 23A: uploadOCRDocumentAction succeeds with real Base64 binary payload'
    );

    const base64DocId = base64UploadRes.data!.id;
    const base64VersionDb = await adminPrisma.documentVersion.findFirst({
      where: { documentId: base64DocId, tenantId: TENANT_A_ID },
    });

    assert(
      base64VersionDb!.checksumSha256 === expectedBase64Sha,
      'TEST 23B: Base64 payload is converted to binary and real SHA-256 is stored in DocumentVersion'
    );
    assert(
      base64VersionDb!.fileSizeBytes === BigInt(rawImageBinary.byteLength),
      'TEST 23C: Base64 upload sets exact binary byte size'
    );

    // =========================================================================
    // TEST 24 — SHA-256 Invariance & Tenant Storage Isolation in Action Context
    // =========================================================================
    console.log('\n[24] Testing Binary Integrity Invariance & Cross-Tenant Rejection...');
    // Upload identical binary under a second document in Tenant A
    const secondUploadRes = await uploadOCRDocumentAction({
      fileName: 'Surat_Izin_Identical_Binary.pdf',
      fileBuffer: rawPdfBinary,
      items: [{ ocrText: 'Citra Dewi Item 2', confidence: 95 }],
    });
    const secondVersionDb = await adminPrisma.documentVersion.findFirst({
      where: { documentId: secondUploadRes.data!.id, tenantId: TENANT_A_ID },
    });
    assert(
      secondVersionDb!.checksumSha256 === expectedSha256,
      'TEST 24A: Same binary content uploaded in different document produces identical SHA-256'
    );

    // Cross-tenant storage isolation: Tenant B cannot download Tenant A's document file from storage
    let crossTenantStorageFailed = false;
    try {
      await storageProvider.download(TENANT_B_ID, docVersionDb!.filePath);
    } catch {
      crossTenantStorageFailed = true;
    }
    assert(
      crossTenantStorageFailed,
      'TEST 24B: Tenant B cannot access Tenant A document binary via storage provider'
    );

    console.log('\n=====================================================');
    console.log(` RESULT: All ${passCount}/${testCount} Student OCR Server Action tests PASSED `);
    console.log('=====================================================\n');
  } finally {
    resetSessionProvider();
    // Cleanup fixtures
    try {
      await adminPrisma.exceptionItem.deleteMany({
        where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
      });
      await adminPrisma.workflowInstance.deleteMany({
        where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
      });
      await adminPrisma.humanVerification.deleteMany({
        where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
      });
      await adminPrisma.extractedItem.deleteMany({
        where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
      });
      await adminPrisma.oCRExtraction.deleteMany({
        where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
      });
      await adminPrisma.absenceRecord.deleteMany({
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
      await adminPrisma.userActor.deleteMany({
        where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
      });
      await adminPrisma.tenant.deleteMany({
        where: { id: { in: [TENANT_A_ID, TENANT_B_ID] } },
      });
    } catch (err) {
      console.warn('Cleanup warning:', err);
    }
    await adminPrisma.$disconnect();
    await adminPool.end();
  }
}

runStudentOCRServerActionsTests().catch((err) => {
  console.error('Student OCR Server Actions test runner failed:', err);
  process.exit(1);
});
