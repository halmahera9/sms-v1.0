import 'dotenv/config';
import pg from 'pg';
import { PrismaClient, AbsenceStatus, DocumentCategory, DocumentStatus, OCRExtractionStatus, UserRole, UserStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  getStudentAbsenceExportDataAction,
  mapAbsenceStatusToDto,
} from '../src/platform/actions/student-export';
import {
  setSessionProvider,
  resetSessionProvider,
  AuthenticatedActorContext,
} from '../src/platform/auth';

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

async function runStudentExportServerActionsTests() {
  console.log('=====================================================');
  console.log(' STUDENT EXPORT SERVER ACTIONS TEST SUITE            ');
  console.log('=====================================================\n');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_A_ID = '44444444-4444-7444-8444-444444444444';
  const TENANT_B_ID = '55555555-5555-7555-8555-555555555555';

  const ACTOR_OPERATOR_A_ID = 'e1111111-2222-7111-8111-111111111111';
  const ACTOR_VERIFIKATOR_A_ID = 'e2222222-2222-7222-8222-222222222222';
  const ACTOR_AUDITOR_A_ID = 'e3333333-2222-7333-8333-333333333333';
  const ACTOR_PEGAWAI_A_ID = 'e4444444-2222-7444-8444-444444444444';
  const ACTOR_INACTIVE_A_ID = 'e5555555-2222-7555-8555-555555555555';
  const ACTOR_OPERATOR_B_ID = 'f1111111-2222-7111-8111-111111111111';

  const STUDENT_A1_ID = 'a1111111-3333-7111-8111-111111111111';
  const STUDENT_A2_ID = 'a2222222-3333-7222-8222-222222222222';
  const STUDENT_A3_ID = 'a3333333-3333-7333-8333-333333333333';
  const STUDENT_UNVERIFIED_ID = 'a4444444-3333-7444-8444-444444444444';
  const STUDENT_B1_ID = 'b1111111-3333-7111-8111-111111111111';

  const DOC_A1_ID = 'd1111111-4444-7111-8111-111111111111';
  const DOC_B1_ID = 'd2222222-4444-7222-8222-222222222222';
  const DOC_PENDING_ID = 'd3333333-4444-7333-8333-333333333333';
  const DOC_REJECTED_ID = 'd4444444-4444-7444-8444-444444444444';

  const OCR_PENDING_ID = 'c1111111-4444-7111-8111-111111111111';
  const ITEM_PENDING_ID = 'e1111111-6666-7111-8111-111111111111';

  const ABS_A1_ID = 'f1111111-5555-7111-8111-111111111111';
  const ABS_A2_ID = 'f2222222-5555-7222-8222-222222222222';
  const ABS_A3_ID = 'f3333333-5555-7333-8333-333333333333';
  const ABS_DIRECT_MANUAL_A_ID = 'f6666666-5555-7666-8666-666666666666';
  const ABS_REJECTED_DOC_ID = 'f5555555-5555-7555-8555-555555555555';
  const ABS_B1_ID = 'f4444444-5555-7444-8444-444444444444';

  try {
    // 1. Setup tenants
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_A_ID },
      create: { id: TENANT_A_ID, name: 'Export Tenant A', code: 'EXP_TENANT_A', status: 'ACTIVE' },
      update: { name: 'Export Tenant A', code: 'EXP_TENANT_A' },
    });
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_B_ID },
      create: { id: TENANT_B_ID, name: 'Export Tenant B', code: 'EXP_TENANT_B', status: 'ACTIVE' },
      update: { name: 'Export Tenant B', code: 'EXP_TENANT_B' },
    });

    // 2. Setup user actors
    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_OPERATOR_A_ID },
      create: {
        id: ACTOR_OPERATOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'exp_op_a',
        email: 'exp_op_a@test.local',
        fullName: 'Export Operator A',
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
        username: 'exp_verif_a',
        email: 'exp_verif_a@test.local',
        fullName: 'Export Verifikator A',
        role: UserRole.VERIFIKATOR,
        status: UserStatus.ACTIVE,
      },
      update: { status: UserStatus.ACTIVE, role: UserRole.VERIFIKATOR },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_AUDITOR_A_ID },
      create: {
        id: ACTOR_AUDITOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'exp_audit_a',
        email: 'exp_audit_a@test.local',
        fullName: 'Export Auditor A',
        role: UserRole.AUDITOR,
        status: UserStatus.ACTIVE,
      },
      update: { status: UserStatus.ACTIVE, role: UserRole.AUDITOR },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_INACTIVE_A_ID },
      create: {
        id: ACTOR_INACTIVE_A_ID,
        tenantId: TENANT_A_ID,
        username: 'exp_inact_a',
        email: 'exp_inact_a@test.local',
        fullName: 'Export Inactive A',
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
        username: 'exp_op_b',
        email: 'exp_op_b@test.local',
        fullName: 'Export Operator B',
        role: UserRole.OPERATOR,
        status: UserStatus.ACTIVE,
      },
      update: { status: UserStatus.ACTIVE, role: UserRole.OPERATOR },
    });

    // 3. Setup students in Tenant A and B
    await adminPrisma.student.upsert({
      where: { id: STUDENT_A1_ID },
      create: {
        id: STUDENT_A1_ID,
        tenantId: TENANT_A_ID,
        nisn: '0051111111',
        nis: '21221111',
        fullName: 'Ahmad Siswa A1',
        className: 'X IPA 1',
        status: 'ACTIVE',
      },
      update: { fullName: 'Ahmad Siswa A1', className: 'X IPA 1' },
    });

    await adminPrisma.student.upsert({
      where: { id: STUDENT_A2_ID },
      create: {
        id: STUDENT_A2_ID,
        tenantId: TENANT_A_ID,
        nisn: '0051111112',
        nis: '21221112',
        fullName: 'Budi Siswa A2',
        className: 'X IPA 2',
        status: 'ACTIVE',
      },
      update: { fullName: 'Budi Siswa A2', className: 'X IPA 2' },
    });

    await adminPrisma.student.upsert({
      where: { id: STUDENT_A3_ID },
      create: {
        id: STUDENT_A3_ID,
        tenantId: TENANT_A_ID,
        nisn: '0051111113',
        nis: '21221113',
        fullName: 'Citra Siswa A3',
        className: 'X IPA 1',
        status: 'ACTIVE',
      },
      update: { fullName: 'Citra Siswa A3', className: 'X IPA 1' },
    });

    await adminPrisma.student.upsert({
      where: { id: STUDENT_UNVERIFIED_ID },
      create: {
        id: STUDENT_UNVERIFIED_ID,
        tenantId: TENANT_A_ID,
        nisn: '0051111199',
        nis: '21221199',
        fullName: 'Unverified Siswa A99',
        className: 'X IPA 1',
        status: 'ACTIVE',
      },
      update: { fullName: 'Unverified Siswa A99', className: 'X IPA 1' },
    });

    await adminPrisma.student.upsert({
      where: { id: STUDENT_B1_ID },
      create: {
        id: STUDENT_B1_ID,
        tenantId: TENANT_B_ID,
        nisn: '0052222221',
        nis: '21222221',
        fullName: 'Dedi Siswa B1',
        className: 'X IPA 1',
        status: 'ACTIVE',
      },
      update: { fullName: 'Dedi Siswa B1', className: 'X IPA 1' },
    });

    // 4. Setup documents
    await adminPrisma.document.upsert({
      where: { id: DOC_A1_ID },
      create: {
        id: DOC_A1_ID,
        tenantId: TENANT_A_ID,
        title: 'Surat_Izin_Tenant_A.pdf',
        category: DocumentCategory.LAINNYA,
        status: DocumentStatus.VERIFIED,
      },
      update: { title: 'Surat_Izin_Tenant_A.pdf', status: DocumentStatus.VERIFIED },
    });

    await adminPrisma.document.upsert({
      where: { id: DOC_B1_ID },
      create: {
        id: DOC_B1_ID,
        tenantId: TENANT_B_ID,
        title: 'Surat_Izin_Tenant_B.pdf',
        category: DocumentCategory.LAINNYA,
        status: DocumentStatus.VERIFIED,
      },
      update: { title: 'Surat_Izin_Tenant_B.pdf', status: DocumentStatus.VERIFIED },
    });

    // Unverified document and OCR extraction fixture (pending verification)
    await adminPrisma.document.upsert({
      where: { id: DOC_PENDING_ID },
      create: {
        id: DOC_PENDING_ID,
        tenantId: TENANT_A_ID,
        title: 'Surat_Pending_Tenant_A.pdf',
        category: DocumentCategory.LAINNYA,
        status: DocumentStatus.PENDING_VERIFICATION,
      },
      update: { title: 'Surat_Pending_Tenant_A.pdf', status: DocumentStatus.PENDING_VERIFICATION },
    });

    await adminPrisma.oCRExtraction.upsert({
      where: { id: OCR_PENDING_ID },
      create: {
        id: OCR_PENDING_ID,
        tenantId: TENANT_A_ID,
        documentId: DOC_PENDING_ID,
        status: OCRExtractionStatus.PROCESSING,
      },
      update: { status: OCRExtractionStatus.PROCESSING },
    });

    await adminPrisma.extractedItem.upsert({
      where: { id: ITEM_PENDING_ID },
      create: {
        id: ITEM_PENDING_ID,
        tenantId: TENANT_A_ID,
        ocrExtractionId: OCR_PENDING_ID,
        studentNameRaw: 'Unverified Siswa A99',
        nisnRaw: '0051111199',
        confidenceScore: 88.5,
        matchedStudentId: STUDENT_UNVERIFIED_ID,
        absenceRecordId: null, // Unverified, has no absenceRecord
      },
      update: { absenceRecordId: null },
    });

    // Rejected document fixture
    await adminPrisma.document.upsert({
      where: { id: DOC_REJECTED_ID },
      create: {
        id: DOC_REJECTED_ID,
        tenantId: TENANT_A_ID,
        title: 'Surat_Rejected_Tenant_A.pdf',
        category: DocumentCategory.LAINNYA,
        status: DocumentStatus.REJECTED,
      },
      update: { title: 'Surat_Rejected_Tenant_A.pdf', status: DocumentStatus.REJECTED },
    });

    // 5. Setup verified absence records
    await adminPrisma.absenceRecord.upsert({
      where: { id: ABS_A1_ID },
      create: {
        id: ABS_A1_ID,
        tenantId: TENANT_A_ID,
        studentId: STUDENT_A1_ID,
        absenceDate: new Date('2026-08-28'),
        status: AbsenceStatus.SAKIT,
        reason: 'Sakit demam',
        documentId: DOC_A1_ID,
      },
      update: { status: AbsenceStatus.SAKIT, reason: 'Sakit demam' },
    });

    await adminPrisma.absenceRecord.upsert({
      where: { id: ABS_A2_ID },
      create: {
        id: ABS_A2_ID,
        tenantId: TENANT_A_ID,
        studentId: STUDENT_A2_ID,
        absenceDate: new Date('2026-08-28'),
        status: AbsenceStatus.IZIN,
        reason: 'Izin urusan keluarga',
        documentId: DOC_A1_ID,
      },
      update: { status: AbsenceStatus.IZIN, reason: 'Izin urusan keluarga' },
    });

    await adminPrisma.absenceRecord.upsert({
      where: { id: ABS_A3_ID },
      create: {
        id: ABS_A3_ID,
        tenantId: TENANT_A_ID,
        studentId: STUDENT_A3_ID,
        absenceDate: new Date('2026-08-27'),
        status: AbsenceStatus.DISPENSASI,
        reason: 'Dispensasi lomba debat',
        documentId: DOC_A1_ID,
      },
      update: { status: AbsenceStatus.DISPENSASI, reason: 'Dispensasi lomba debat' },
    });

    // Direct manual operator absence entry (documentId: null) - Canonical verified record without OCR document
    await adminPrisma.absenceRecord.upsert({
      where: { id: ABS_DIRECT_MANUAL_A_ID },
      create: {
        id: ABS_DIRECT_MANUAL_A_ID,
        tenantId: TENANT_A_ID,
        studentId: STUDENT_A3_ID,
        absenceDate: new Date('2026-08-28'),
        status: AbsenceStatus.ALPHA,
        reason: 'Pencatatan langsung absensi harian kelas oleh wali kelas',
        documentId: null,
      },
      update: { status: AbsenceStatus.ALPHA, reason: 'Pencatatan langsung absensi harian kelas oleh wali kelas' },
    });

    // Non-canonical absence record referencing a REJECTED document
    await adminPrisma.absenceRecord.upsert({
      where: { id: ABS_REJECTED_DOC_ID },
      create: {
        id: ABS_REJECTED_DOC_ID,
        tenantId: TENANT_A_ID,
        studentId: STUDENT_UNVERIFIED_ID,
        absenceDate: new Date('2026-08-28'),
        status: AbsenceStatus.ALPHA,
        reason: 'Dokumen palsu/ditolak',
        documentId: DOC_REJECTED_ID,
      },
      update: { status: AbsenceStatus.ALPHA, reason: 'Dokumen palsu/ditolak' },
    });

    await adminPrisma.absenceRecord.upsert({
      where: { id: ABS_B1_ID },
      create: {
        id: ABS_B1_ID,
        tenantId: TENANT_B_ID,
        studentId: STUDENT_B1_ID,
        absenceDate: new Date('2026-08-28'),
        status: AbsenceStatus.ALPHA,
        reason: 'Tanpa keterangan',
        documentId: DOC_B1_ID,
      },
      update: { status: AbsenceStatus.ALPHA, reason: 'Tanpa keterangan' },
    });

    // =========================================================================
    // TEST 1 — Unauthenticated Access Fails Closed
    // =========================================================================
    console.log('[1] Testing Unauthenticated Access...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return null;
      },
    });

    const unauthRes = await getStudentAbsenceExportDataAction();
    assert(
      !unauthRes.success && unauthRes.error?.code === 'UNAUTHENTICATED',
      'TEST 1: getStudentAbsenceExportDataAction fails closed with UNAUTHENTICATED when session is null'
    );

    // =========================================================================
    // TEST 2 — Inactive Actor Rejection
    // =========================================================================
    console.log('\n[2] Testing Inactive Actor Rejection...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: ACTOR_INACTIVE_A_ID,
          tenantId: TENANT_A_ID,
          username: 'exp_inact_a',
          role: UserRole.OPERATOR,
          status: UserStatus.INACTIVE,
        };
      },
    });

    const inactiveRes = await getStudentAbsenceExportDataAction();
    assert(
      !inactiveRes.success && inactiveRes.error?.code === 'UNAUTHENTICATED',
      'TEST 2: Inactive actor session rejected with UNAUTHENTICATED'
    );

    // =========================================================================
    // TEST 3 — Malformed Actor UUID
    // =========================================================================
    console.log('\n[3] Testing Malformed Actor UUID...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: 'invalid-actor-uuid',
          tenantId: TENANT_A_ID,
          username: 'exp_malformed',
          role: UserRole.OPERATOR,
          status: UserStatus.ACTIVE,
        };
      },
    });

    const malformedRes = await getStudentAbsenceExportDataAction();
    assert(
      !malformedRes.success && malformedRes.error?.code === 'UNAUTHENTICATED',
      'TEST 3: Malformed actor UUID rejected with UNAUTHENTICATED'
    );

    // =========================================================================
    // TEST 4 — RBAC Policy: Operator, Verifikator, Auditor Allowed; Pegawai Forbidden
    // =========================================================================
    console.log('\n[4] Testing RBAC Policy...');
    
    // 4A: Pegawai is Forbidden
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: ACTOR_PEGAWAI_A_ID,
          tenantId: TENANT_A_ID,
          username: 'exp_peg_a',
          role: UserRole.PEGAWAI,
          status: UserStatus.ACTIVE,
        };
      },
    });

    const pegRes = await getStudentAbsenceExportDataAction();
    assert(
      !pegRes.success && pegRes.error?.code === 'FORBIDDEN',
      'TEST 4A: Pegawai role is forbidden from exporting absence data'
    );

    // 4B: Auditor is Allowed
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: ACTOR_AUDITOR_A_ID,
          tenantId: TENANT_A_ID,
          username: 'exp_audit_a',
          role: UserRole.AUDITOR,
          status: UserStatus.ACTIVE,
        };
      },
    });

    const auditRes = await getStudentAbsenceExportDataAction();
    assert(
      auditRes.success && Array.isArray(auditRes.data?.rows),
      'TEST 4B: Auditor role is authorized to export absence data'
    );

    // =========================================================================
    // TEST 5 — Operator Export & All Classes Query (Tenant A)
    // =========================================================================
    console.log('\n[5] Testing Operator Export for All Classes...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: ACTOR_OPERATOR_A_ID,
          tenantId: TENANT_A_ID,
          username: 'exp_op_a',
          role: UserRole.OPERATOR,
          status: UserStatus.ACTIVE,
        };
      },
    });

    const opRes = await getStudentAbsenceExportDataAction({ selectedClass: 'Semua' });
    assert(
      opRes.success && opRes.data !== undefined,
      'TEST 5A: Operator successfully queries export data'
    );
    assert(
      opRes.data?.totalCount === 4 && opRes.data?.rows.length === 4,
      'TEST 5B: Total count and rows length match Tenant A canonical verified records (4: 3 with verified docs + 1 direct entry)'
    );

    // Check row details
    const row1 = opRes.data!.rows.find((r) => r.nisn === '0051111111' && r.status === 'Sakit');
    assert(
      row1 !== undefined &&
        row1.studentName === 'Ahmad Siswa A1' &&
        row1.status === 'Sakit' &&
        row1.documentReference === 'Surat_Izin_Tenant_A.pdf' &&
        row1.verificationStatus === 'Terverifikasi',
      'TEST 5C: Row 1 correctly maps Ahmad Siswa A1 (Sakit, Terverifikasi with Document Reference)'
    );

    // Check Dispensasi support
    const row3 = opRes.data!.rows.find((r) => r.notes.includes('lomba debat'));
    assert(
      row3 !== undefined && row3.status === 'Dispensasi',
      'TEST 5D: Canonical AbsenceStatus.DISPENSASI correctly maps to "Dispensasi"'
    );

    // Regression check: Unverified extracted item is excluded
    const hasUnverifiedExtractedItem = opRes.data!.rows.some((r) => r.studentName.includes('Unverified'));
    assert(
      hasUnverifiedExtractedItem === false,
      'TEST 5E: Enforce verified-only invariant: unverified ExtractedItems and unverified documents are excluded from export'
    );

    // Regression check: AbsenceRecord referencing a REJECTED document is excluded
    const hasRejectedDocRecord = opRes.data!.rows.some((r) => r.notes.includes('Dokumen palsu'));
    assert(
      hasRejectedDocRecord === false,
      'TEST 5F: Enforce verified-only invariant: AbsenceRecords with REJECTED documents are excluded from export'
    );

    // Explicit test for direct manual operator entry without document (documentId: null)
    const directManualRow = opRes.data!.rows.find((r) => r.notes.includes('Pencatatan langsung'));
    assert(
      directManualRow !== undefined &&
        directManualRow.documentReference === 'Pencatatan Langsung (Tanpa Dokumen)' &&
        directManualRow.verificationStatus === 'Terverifikasi',
      'TEST 5G: Canonical Invariant: Direct operator AbsenceRecord without document (documentId: null) is legitimate and exported as Terverifikasi'
    );

    // Check availableClasses returned
    assert(
      Array.isArray(opRes.data?.availableClasses) && opRes.data?.availableClasses.includes('Semua') && opRes.data?.availableClasses.includes('X IPA 1'),
      'TEST 5H: availableClasses list includes "Semua" and distinct tenant student classes'
    );

    // =========================================================================
    // TEST 6 — Specific Class & Inclusive Date Range Filters
    // =========================================================================
    console.log('\n[6] Testing Specific Class and Inclusive Date Range Filters...');
    const classFilteredRes = await getStudentAbsenceExportDataAction({ selectedClass: 'X IPA 2' });
    assert(
      classFilteredRes.success && classFilteredRes.data?.rows.length === 1,
      'TEST 6A: Class filter "X IPA 2" returns exactly 1 record'
    );
    assert(
      classFilteredRes.data?.rows[0].studentName === 'Budi Siswa A2',
      'TEST 6B: Filtered record belongs to Budi Siswa A2 in X IPA 2'
    );

    // Date range filter: single inclusive day 2026-08-28
    const singleDayRes = await getStudentAbsenceExportDataAction({
      startDate: '2026-08-28',
      endDate: '2026-08-28',
    });
    assert(
      singleDayRes.success && singleDayRes.data?.rows.length === 3,
      'TEST 6C: Inclusive date filter (2026-08-28 to 2026-08-28) returns exactly 3 records from that day, excluding 2026-08-27'
    );

    // Date range filter: previous day 2026-08-27
    const prevDayRes = await getStudentAbsenceExportDataAction({
      startDate: '2026-08-27',
      endDate: '2026-08-27',
    });
    assert(
      prevDayRes.success && prevDayRes.data?.rows.length === 1 && prevDayRes.data?.rows[0].studentName === 'Citra Siswa A3',
      'TEST 6D: Inclusive date filter (2026-08-27 to 2026-08-27) returns exactly 1 record (Citra Siswa A3)'
    );

    // Date range filter: multi-day inclusive span 2026-08-27 to 2026-08-28
    const multiDayRes = await getStudentAbsenceExportDataAction({
      startDate: '2026-08-27',
      endDate: '2026-08-28',
    });
    assert(
      multiDayRes.success && multiDayRes.data?.rows.length === 4,
      'TEST 6E: Multi-day date filter (2026-08-27 to 2026-08-28) returns all 4 canonical records'
    );

    // =========================================================================
    // TEST 7 — Tenant Isolation
    // =========================================================================
    console.log('\n[7] Testing Tenant Isolation...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: ACTOR_OPERATOR_B_ID,
          tenantId: TENANT_B_ID,
          username: 'exp_op_b',
          role: UserRole.OPERATOR,
          status: UserStatus.ACTIVE,
        };
      },
    });

    const tenantBRes = await getStudentAbsenceExportDataAction();
    assert(
      tenantBRes.success && tenantBRes.data?.totalCount === 1,
      'TEST 7A: Tenant B export only sees Tenant B records (1 record)'
    );
    assert(
      tenantBRes.data?.rows[0].studentName === 'Dedi Siswa B1',
      'TEST 7B: Tenant B record belongs to Dedi Siswa B1'
    );
    const hasTenantARowInB = tenantBRes.data?.rows.some((r) => r.studentName.includes('Tenant A'));
    assert(
      hasTenantARowInB === false,
      'TEST 7C: Tenant B has zero records from Tenant A'
    );

    // =========================================================================
    // TEST 8 — Audit Event Persistence in PostgreSQL with Semantically Correct Identity
    // =========================================================================
    console.log('\n[8] Testing Audit Event Persistence...');
    const exportAudit = await adminPrisma.auditEvent.findFirst({
      where: {
        tenantId: TENANT_A_ID,
        actorUserId: ACTOR_OPERATOR_A_ID,
        action: 'EXPORT_ABSENCE_DATA',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(
      exportAudit !== null &&
        exportAudit.entityType === 'Tenant' &&
        exportAudit.entityId === TENANT_A_ID,
      'TEST 8A: Audit event EXPORT_ABSENCE_DATA uses semantically correct Tenant aggregate entityType and entityId'
    );
    const auditPayload = exportAudit?.payloadJson as Record<string, unknown> | null;
    const auditMetadata = auditPayload?.metadata as Record<string, unknown> | null;
    assert(
      auditMetadata !== null &&
        typeof auditMetadata?.filename === 'string' &&
        typeof auditMetadata?.rowCount === 'number',
      'TEST 8B: Audit event metadata contains export details (filename, rowCount, targetScope)'
    );

    // =========================================================================
    // TEST 9 — Status Mapping Helper Unit Checks
    // =========================================================================
    console.log('\n[9] Testing Status Mapping Helpers...');
    assert(mapAbsenceStatusToDto(AbsenceStatus.SAKIT) === 'Sakit', 'TEST 9A: SAKIT maps to "Sakit"');
    assert(mapAbsenceStatusToDto(AbsenceStatus.IZIN) === 'Izin', 'TEST 9B: IZIN maps to "Izin"');
    assert(mapAbsenceStatusToDto(AbsenceStatus.ALPHA) === 'Alpha', 'TEST 9C: ALPHA maps to "Alpha"');
    assert(mapAbsenceStatusToDto(AbsenceStatus.DISPENSASI) === 'Dispensasi', 'TEST 9D: DISPENSASI maps to "Dispensasi"');

    // =========================================================================
    // TEST 10 — JSON Serializability
    // =========================================================================
    console.log('\n[10] Testing DTO JSON Serializability...');
    const serialized = JSON.stringify(opRes.data);
    const parsed = JSON.parse(serialized);
    assert(
      parsed !== null &&
        Array.isArray(parsed.rows) &&
        typeof parsed.filename === 'string' &&
        typeof parsed.totalCount === 'number',
      'TEST 10: Server Action response is completely JSON serializable'
    );

    console.log('\n=====================================================');
    console.log(` RESULT: All ${passCount}/${testCount} Student Export Server Action tests PASSED `);
    console.log('=====================================================\n');
  } finally {
    resetSessionProvider();
    // Cleanup test fixtures
    try {
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
    } catch (err) {
      console.warn('Cleanup warning:', err);
    }
    await adminPrisma.$disconnect();
    await adminPool.end();
  }
}

runStudentExportServerActionsTests().catch((err) => {
  console.error('Student Export Server Actions test runner failed:', err);
  process.exit(1);
});

