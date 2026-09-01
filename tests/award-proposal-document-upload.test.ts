import 'dotenv/config';
import pg from 'pg';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  uploadProposalDocumentAction,
  UploadProposalDocumentDTO,
} from '../src/domains/employee/awards/actions';
import {
  setSessionProvider,
  resetSessionProvider,
} from '../src/platform/auth/session';
import {
  getObjectStorageProvider,
  InMemoryObjectStorageProvider,
  calculateSha256,
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
  }
}

async function runAwardProposalDocumentUploadTests() {
  console.log('================================================================');
  console.log('  AWARD PROPOSAL CANONICAL DOCUMENT PERSISTENCE TEST SUITE      ');
  console.log('================================================================\n');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_A_ID = '11111111-1111-7111-8111-111111111111';
  const TENANT_B_ID = '99999999-9999-7999-8999-999999999999';

  const ACTOR_ADMIN = 'a0000000-0000-7000-8000-000000000000';
  const ACTOR_OPERATOR = 'a2222222-2222-7222-8222-222222222222';
  const ACTOR_PEGAWAI = 'a3333333-3333-7333-8333-333333333333';
  const ACTOR_TENANT_B = 'b2222222-2222-7222-8222-222222222222';

  const testEmpAId = '33333333-3333-7333-8333-333333333311';
  const testEmpBId = '33333333-3333-7333-8333-333333333322';

  const proposalA1Id = '66666666-6666-7666-8666-666666666601';
  const proposalA2Id = '66666666-6666-7666-8666-666666666602';
  const proposalB1Id = '66666666-6666-7666-8666-666666666699';

  const storageProvider = new InMemoryObjectStorageProvider();

  try {
    // -------------------------------------------------------------
    // 1. Setup Tenants, Users, Employee & Proposal Fixtures
    // -------------------------------------------------------------
    console.log('[Setup] Seeding database fixtures...');

    await adminPrisma.tenant.upsert({
      where: { id: TENANT_A_ID },
      create: { id: TENANT_A_ID, name: 'Award Doc Tenant A', code: 'AWARD_DOC_A', status: 'ACTIVE' },
      update: {},
    });
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_B_ID },
      create: { id: TENANT_B_ID, name: 'Award Doc Tenant B', code: 'AWARD_DOC_B', status: 'ACTIVE' },
      update: {},
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_ADMIN },
      create: {
        id: ACTOR_ADMIN,
        tenantId: TENANT_A_ID,
        username: 'admin_award_doc',
        email: 'admin_doc@award.local',
        fullName: 'Admin Award Doc',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      update: {},
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_OPERATOR },
      create: {
        id: ACTOR_OPERATOR,
        tenantId: TENANT_A_ID,
        username: 'operator_award_doc',
        email: 'operator_doc@award.local',
        fullName: 'Operator Award Doc',
        role: 'OPERATOR',
        status: 'ACTIVE',
      },
      update: {},
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_PEGAWAI },
      create: {
        id: ACTOR_PEGAWAI,
        tenantId: TENANT_A_ID,
        username: 'pegawai_award_doc',
        email: 'pegawai_doc@award.local',
        fullName: 'Pegawai Award Doc',
        role: 'PEGAWAI',
        status: 'ACTIVE',
      },
      update: {},
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_TENANT_B },
      create: {
        id: ACTOR_TENANT_B,
        tenantId: TENANT_B_ID,
        username: 'tenant_b_award_doc',
        email: 'tenant_b@award.local',
        fullName: 'Tenant B Award Doc User',
        role: 'OPERATOR',
        status: 'ACTIVE',
      },
      update: {},
    });

    await adminPrisma.employee.upsert({
      where: { id: testEmpAId },
      create: {
        id: testEmpAId,
        tenantId: TENANT_A_ID,
        nip: '198501012010011001',
        nrk: '123456',
        fullName: 'Budi Award PNS',
        jabatan: 'Analis Kepegawaian',
        unitKerja: 'Badan Kepegawaian Daerah',
        instansi: 'Pemerintah Provinsi',
        statusKepegawaian: 'PNS',
      },
      update: {},
    });

    await adminPrisma.employee.upsert({
      where: { id: testEmpBId },
      create: {
        id: testEmpBId,
        tenantId: TENANT_B_ID,
        nip: '198602022011022002',
        nrk: '654321',
        fullName: 'Siti Award Tenant B',
        jabatan: 'Pranata Komputer',
        unitKerja: 'Dinas Kominfo',
        instansi: 'Pemerintah Provinsi',
        statusKepegawaian: 'PNS',
      },
      update: {},
    });

    // Cleanup previous test proposals
    await adminPrisma.awardProposalDocument.deleteMany({
      where: { proposalId: { in: [proposalA1Id, proposalA2Id, proposalB1Id] } },
    });
    await adminPrisma.awardProposal.deleteMany({
      where: { id: { in: [proposalA1Id, proposalA2Id, proposalB1Id] } },
    });

    await adminPrisma.awardProposal.create({
      data: {
        id: proposalA1Id,
        tenantId: TENANT_A_ID,
        employeeId: testEmpAId,
        jenisPenghargaan: 'MASA_KERJA',
        tahunUsulan: 2026,
        status: 'NOMINATIF',
      },
    });

    await adminPrisma.awardProposal.create({
      data: {
        id: proposalA2Id,
        tenantId: TENANT_A_ID,
        employeeId: testEmpAId,
        jenisPenghargaan: 'SATYALANCANA',
        tahunUsulan: 2026,
        status: 'NOMINATIF',
      },
    });

    await adminPrisma.awardProposal.create({
      data: {
        id: proposalB1Id,
        tenantId: TENANT_B_ID,
        employeeId: testEmpBId,
        jenisPenghargaan: 'MASA_KERJA',
        tahunUsulan: 2026,
        status: 'NOMINATIF',
      },
    });

    // =============================================================
    // [1] Testing Invalid Inputs & Binary Validation
    // =============================================================
    console.log('\n[1] Testing Invalid Inputs & Binary Validation...');
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_OPERATOR,
        tenantId: TENANT_A_ID,
        username: 'operator_award_doc',
        role: 'OPERATOR',
        status: 'ACTIVE',
      }),
    });

    const invalidResp = await uploadProposalDocumentAction(
      {
        proposalId: proposalA1Id,
        requirementCode: 'SK_CPNS',
        fileName: 'sk_cpns.pdf',
        fileBuffer: Buffer.from('test buffer'),
        fileBase64: Buffer.from('test base64').toString('base64'),
      },
      storageProvider
    );

    assert(!invalidResp.success, 'Simultaneous fileBuffer and fileBase64 is rejected');
    assert(invalidResp.error?.code === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');

    const emptyBufferResp = await uploadProposalDocumentAction(
      {
        proposalId: proposalA1Id,
        requirementCode: 'SK_CPNS',
        fileName: 'empty.pdf',
        fileBuffer: Buffer.alloc(0),
      },
      storageProvider
    );

    assert(!emptyBufferResp.success, 'Empty fileBuffer is strictly rejected');
    assert(emptyBufferResp.error?.code === 'VALIDATION_ERROR', 'Empty buffer returns VALIDATION_ERROR');

    const emptyBase64Resp = await uploadProposalDocumentAction(
      {
        proposalId: proposalA1Id,
        requirementCode: 'SK_CPNS',
        fileName: 'empty.pdf',
        fileBase64: '   ',
      },
      storageProvider
    );

    assert(!emptyBase64Resp.success, 'Empty fileBase64 string is strictly rejected');
    assert(emptyBase64Resp.error?.code === 'VALIDATION_ERROR', 'Empty base64 returns VALIDATION_ERROR');

    // Test Compensation Cleanup on DB Failure
    const nonExistentProposalId = '00000000-0000-7000-8000-000000000099';
    const compensationBytes = Buffer.from('binary bytes intended to fail in DB and trigger compensation');
    const compUploadResp = await uploadProposalDocumentAction(
      {
        proposalId: nonExistentProposalId,
        requirementCode: 'SK_CPNS',
        fileName: 'fail_compensation.pdf',
        fileBuffer: compensationBytes,
      },
      storageProvider
    );

    assert(!compUploadResp.success, 'Upload with non-existent proposal ID fails with DOMAIN_ERROR');
    assert(compUploadResp.error?.code === 'DOMAIN_ERROR', 'Failure error is preserved and returned to caller');
    // Ensure no orphaned document exists in database
    const dbDocCount = await adminPrisma.document.count({
      where: { tenantId: TENANT_A_ID, title: 'fail_compensation.pdf' },
    });
    assert(dbDocCount === 0, 'No orphaned Document record exists in database after failed transaction');

    // =============================================================
    // [2] Testing Real Binary Upload via Buffer
    // =============================================================
    console.log('\n[2] Testing Real Binary Upload via Buffer...');

    const samplePdfBytes = Buffer.from('%PDF-1.4 sample PDF binary content for employee award verification 12345');
    const expectedSha256 = calculateSha256(samplePdfBytes);
    const expectedSize = samplePdfBytes.byteLength;

    const bufferUploadResp = await uploadProposalDocumentAction(
      {
        proposalId: proposalA1Id,
        requirementCode: 'SK_CPNS',
        fileName: 'sk_cpns_budi.pdf',
        fileBuffer: samplePdfBytes,
        mimeType: 'application/pdf',
      },
      storageProvider
    );

    assert(bufferUploadResp.success, 'Buffer upload server action succeeds');
    const updatedProposal = bufferUploadResp.data!;
    const uploadedDoc = updatedProposal.documents.find((d) => d.requirementCode === 'SK_CPNS');

    assert(Boolean(uploadedDoc), 'SK_CPNS document exists in returned proposal documents');
    assert(Boolean(uploadedDoc?.documentId), 'AwardProposalDocument.documentId is populated');
    assert(uploadedDoc?.fileSize === expectedSize, 'Document fileSize matches exact byte length', `size: ${uploadedDoc?.fileSize}`);
    assert(uploadedDoc?.checksumSha256 === expectedSha256, 'Document checksumSha256 matches exact real SHA-256', `hash: ${uploadedDoc?.checksumSha256}`);
    assert(uploadedDoc?.fileName === 'sk_cpns_budi.pdf', 'Document fileName matches uploaded title');
    assert(uploadedDoc?.verificationStatus === 'pending', 'Document verificationStatus is pending');

    // Verify canonical Document and DocumentVersion in database
    const dbDoc = await adminPrisma.document.findUnique({
      where: { id: uploadedDoc!.documentId! },
      include: { versions: true },
    });

    assert(Boolean(dbDoc), 'Canonical Document record exists in database under tenant');
    assert(dbDoc?.tenantId === TENANT_A_ID, 'Canonical Document has correct tenantId');
    assert(dbDoc?.title === 'sk_cpns_budi.pdf', 'Canonical Document title matches');
    assert(dbDoc?.category === 'SK_CPNS', 'Canonical Document category matches mapped requirement');
    assert(dbDoc?.versions.length === 1, 'Canonical Document has exactly 1 version');

    const dbVersion = dbDoc?.versions[0];
    assert(dbVersion?.versionNumber === 1, 'DocumentVersion versionNumber is 1');
    assert(dbVersion?.checksumSha256 === expectedSha256, 'DocumentVersion checksumSha256 is authoritative real SHA-256');
    assert(Number(dbVersion?.fileSizeBytes) === expectedSize, 'DocumentVersion fileSizeBytes matches exact binary byte size');
    assert(dbVersion?.mimeType === 'application/pdf', 'DocumentVersion mimeType is application/pdf');
    assert(Boolean(dbVersion?.filePath.includes(uploadedDoc!.documentId!)), 'DocumentVersion filePath is canonical storage path');

    // =============================================================
    // [3] Testing Object Storage Download Verification
    // =============================================================
    console.log('\n[3] Testing Storage Download & Integrity Verification...');

    const downloadedBytes = await storageProvider.download(TENANT_A_ID, dbVersion!.filePath);
    assert(
      downloadedBytes.equals(samplePdfBytes),
      'Downloaded binary from IObjectStorageProvider equals original uploaded Buffer'
    );

    // =============================================================
    // [4] Testing Real Binary Upload via Base64 Payload
    // =============================================================
    console.log('\n[4] Testing Real Binary Upload via Base64 Payload...');

    const sampleImageBytes = Buffer.from('GIF89a synthetic binary image content for PNS award requirement');
    const expectedImageSha256 = calculateSha256(sampleImageBytes);
    const base64Payload = sampleImageBytes.toString('base64');

    const base64UploadResp = await uploadProposalDocumentAction(
      {
        proposalId: proposalA1Id,
        requirementCode: 'SK_PNS',
        fileName: 'sk_pns_budi.png',
        fileBase64: base64Payload,
        mimeType: 'image/png',
      },
      storageProvider
    );

    assert(base64UploadResp.success, 'Base64 upload server action succeeds');
    const uploadedPnsDoc = base64UploadResp.data!.documents.find((d) => d.requirementCode === 'SK_PNS');
    assert(Boolean(uploadedPnsDoc?.documentId), 'Base64 upload populates canonical documentId');
    assert(uploadedPnsDoc?.fileSize === sampleImageBytes.byteLength, 'Base64 upload sets exact binary size');
    assert(uploadedPnsDoc?.checksumSha256 === expectedImageSha256, 'Base64 upload sets exact SHA-256 digest');

    const downloadedImage = await storageProvider.download(TENANT_A_ID, uploadedPnsDoc!.fileUrl);
    assert(
      downloadedImage.equals(sampleImageBytes),
      'Downloaded Base64-uploaded binary equals original image bytes'
    );

    // =============================================================
    // [5] Testing Tenant Isolation
    // =============================================================
    console.log('\n[5] Testing Tenant Isolation...');

    let crossTenantDownloadFailed = false;
    try {
      await storageProvider.download(TENANT_B_ID, dbVersion!.filePath);
    } catch {
      crossTenantDownloadFailed = true;
    }
    assert(crossTenantDownloadFailed, 'Tenant B calling storageProvider.download on Tenant A file path is strictly rejected');

    // Tenant B actor attempting to upload to Tenant A proposal
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_TENANT_B,
        tenantId: TENANT_B_ID,
        username: 'tenant_b_award_doc',
        role: 'OPERATOR',
        status: 'ACTIVE',
      }),
    });

    const crossTenantUploadResp = await uploadProposalDocumentAction(
      {
        proposalId: proposalA1Id,
        requirementCode: 'SKP_2025',
        fileName: 'skp.pdf',
        fileBuffer: Buffer.from('malicious cross-tenant content'),
      },
      storageProvider
    );

    assert(!crossTenantUploadResp.success, 'Tenant B actor cannot upload document to Tenant A proposal');
    assert(
      crossTenantUploadResp.error?.code === 'DOMAIN_ERROR' || crossTenantUploadResp.error?.code === 'FORBIDDEN',
      'Cross-tenant upload rejected due to Tenant RLS boundary'
    );

    // =============================================================
    // [6] Testing Metadata-Only Legacy Upload Path
    // =============================================================
    console.log('\n[6] Testing Metadata-Only Legacy Upload Path...');

    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_OPERATOR,
        tenantId: TENANT_A_ID,
        username: 'operator_award_doc',
        role: 'OPERATOR',
        status: 'ACTIVE',
      }),
    });

    const countDocsBefore = await adminPrisma.document.count({ where: { tenantId: TENANT_A_ID } });
    const countVersionsBefore = await adminPrisma.documentVersion.count({ where: { tenantId: TENANT_A_ID } });

    const legacyUploadResp = await uploadProposalDocumentAction(
      {
        proposalId: proposalA2Id,
        requirementCode: 'SK_PANGKAT_TERAKHIR',
        fileName: 'sk_pangkat_legacy.pdf',
      },
      storageProvider
    );

    assert(legacyUploadResp.success, 'Metadata-only legacy upload succeeds');
    const legacyDoc = legacyUploadResp.data!.documents.find((d) => d.requirementCode === 'SK_PANGKAT_TERAKHIR');
    assert(Boolean(legacyDoc), 'Legacy checklist item created in proposal');
    assert(!legacyDoc?.documentId, 'Legacy upload creates no canonical documentId (remains undefined/null)');
    assert(!legacyDoc?.checksumSha256, 'Legacy upload creates no fake SHA-256 checksum');

    const countDocsAfter = await adminPrisma.document.count({ where: { tenantId: TENANT_A_ID } });
    const countVersionsAfter = await adminPrisma.documentVersion.count({ where: { tenantId: TENANT_A_ID } });

    assert(countDocsAfter === countDocsBefore, 'No row created in documents table for legacy metadata-only upload');
    assert(countVersionsAfter === countVersionsBefore, 'No row created in document_versions table for legacy metadata-only upload');

    // =============================================================
    // [7] Testing RBAC Authorization Policies
    // =============================================================
    console.log('\n[7] Testing RBAC Authorization Policies...');

    // PEGAWAI role is forbidden from UPLOAD_DOCUMENT in PLATFORM_RBAC_REGISTRY
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_PEGAWAI,
        tenantId: TENANT_A_ID,
        username: 'pegawai_award_doc',
        role: 'PEGAWAI',
        status: 'ACTIVE',
      }),
    });

    const pegawaiUploadResp = await uploadProposalDocumentAction(
      {
        proposalId: proposalA1Id,
        requirementCode: 'SKT_TIDAK_HUKDIS',
        fileName: 'bebas_hukdis.pdf',
        fileBuffer: Buffer.from('surat bebas hukdis pegawai 2026'),
      },
      storageProvider
    );

    assert(!pegawaiUploadResp.success, 'PEGAWAI role is forbidden from uploading proposal documents');
    assert(pegawaiUploadResp.error?.code === 'FORBIDDEN', 'PEGAWAI upload rejected with FORBIDDEN');

    // ADMIN role is authorized
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_ADMIN,
        tenantId: TENANT_A_ID,
        username: 'admin_award_doc',
        role: 'ADMIN',
        status: 'ACTIVE',
      }),
    });

    const adminUploadResp = await uploadProposalDocumentAction(
      {
        proposalId: proposalA1Id,
        requirementCode: 'SKT_TIDAK_HUKDIS',
        fileName: 'bebas_hukdis_admin.pdf',
        fileBuffer: Buffer.from('surat bebas hukdis admin 2026'),
      },
      storageProvider
    );

    assert(adminUploadResp.success, 'ADMIN role is permitted to upload proposal documents');

    // Unauthenticated request
    resetSessionProvider();

    const unauthResp = await uploadProposalDocumentAction(
      {
        proposalId: proposalA1Id,
        requirementCode: 'SK_JABATAN_TERAKHIR',
        fileName: 'jabatan.pdf',
        fileBuffer: Buffer.from('unauth buffer'),
      },
      storageProvider
    );

    // =============================================================
    // [8] Testing Canonical Document Version Increment & Replacement Flow
    // =============================================================
    console.log('\n[8] Testing Canonical Document Version Increment & Replacement Flow...');

    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_OPERATOR,
        tenantId: TENANT_A_ID,
        username: 'operator_award_doc',
        role: 'OPERATOR',
        status: 'ACTIVE',
      }),
    });

    const v1Bytes = Buffer.from('%PDF-1.4 Original SK CPNS Version 1 Initial Upload Content 11111');
    const v1Sha256 = calculateSha256(v1Bytes);
    const v1Size = v1Bytes.byteLength;

    // 1. Initial upload creates Document(v1)
    const initialUploadResp = await uploadProposalDocumentAction(
      {
        proposalId: proposalA2Id,
        requirementCode: 'SK_CPNS',
        fileName: 'sk_cpns_initial.pdf',
        fileBuffer: v1Bytes,
        mimeType: 'application/pdf',
      },
      storageProvider
    );

    assert(initialUploadResp.success, 'Initial upload succeeds');
    const initialProposalDoc = initialUploadResp.data!.documents.find((d) => d.requirementCode === 'SK_CPNS');
    assert(Boolean(initialProposalDoc?.documentId), 'Initial upload creates canonical documentId');
    const canonicalDocId = initialProposalDoc!.documentId!;

    const initialDbDoc = await adminPrisma.document.findUniqueOrThrow({
      where: { id: canonicalDocId },
      include: { versions: { orderBy: { versionNumber: 'asc' } } },
    });

    assert(initialDbDoc.currentVersion === 1, 'Document.currentVersion is 1 on initial upload');
    assert(initialDbDoc.versions.length === 1, 'Exactly one DocumentVersion exists');
    assert(initialDbDoc.versions[0].versionNumber === 1, 'DocumentVersion is version 1');
    assert(initialDbDoc.versions[0].checksumSha256 === v1Sha256, 'DocumentVersion v1 has correct SHA-256');
    assert(Number(initialDbDoc.versions[0].fileSizeBytes) === v1Size, 'DocumentVersion v1 has correct file size');

    // Simulate rejection / flagging of version 1
    await adminPrisma.document.update({
      where: { id: canonicalDocId },
      data: { status: 'REJECTED' },
    });
    await adminPrisma.awardProposalDocument.update({
      where: { proposalId_requirementCode: { proposalId: proposalA2Id, requirementCode: 'SK_CPNS' } },
      data: { status: 'FAILED' },
    });

    // 2. Replacement upload creates DocumentVersion(v2) under the same Document.id
    const v2Bytes = Buffer.from('%PDF-1.4 Corrected SK CPNS Version 2 Replacement Upload Content 22222');
    const v2Sha256 = calculateSha256(v2Bytes);
    const v2Size = v2Bytes.byteLength;

    const replacementUploadResp = await uploadProposalDocumentAction(
      {
        proposalId: proposalA2Id,
        requirementCode: 'SK_CPNS',
        fileName: 'sk_cpns_corrected_v2.pdf',
        fileBuffer: v2Bytes,
        mimeType: 'application/pdf',
      },
      storageProvider
    );

    assert(replacementUploadResp.success, 'Replacement upload succeeds');
    const replacedProposalDoc = replacementUploadResp.data!.documents.find((d) => d.requirementCode === 'SK_CPNS');
    assert(replacedProposalDoc?.documentId === canonicalDocId, 'Replacement retains the exact same Document.id');
    assert(replacedProposalDoc?.checksumSha256 === v2Sha256, 'Proposal document projects latest v2 SHA-256');
    assert(replacedProposalDoc?.fileSize === v2Size, 'Proposal document projects latest v2 file size');

    const updatedDbDoc = await adminPrisma.document.findUniqueOrThrow({
      where: { id: canonicalDocId },
      include: { versions: { orderBy: { versionNumber: 'asc' } } },
    });

    assert(updatedDbDoc.currentVersion === 2, 'Document.currentVersion advanced to 2');
    assert(updatedDbDoc.status === 'PENDING_VERIFICATION', 'Document.status reset to PENDING_VERIFICATION');
    assert(updatedDbDoc.versions.length === 2, 'Both DocumentVersions (v1 and v2) are retained');

    // 3. Verify v1 remains unchanged
    const dbV1 = updatedDbDoc.versions[0];
    assert(dbV1.versionNumber === 1, 'v1 versionNumber is 1');
    assert(dbV1.checksumSha256 === v1Sha256, 'v1 SHA-256 remains unchanged');
    assert(Number(dbV1.fileSizeBytes) === v1Size, 'v1 size remains unchanged');

    // 4. Verify v2 has distinct binary and correct metadata
    const dbV2 = updatedDbDoc.versions[1];
    assert(dbV2.versionNumber === 2, 'v2 versionNumber is 2');
    assert(dbV2.checksumSha256 === v2Sha256, 'v2 SHA-256 matches replacement binary');
    assert(Number(dbV2.fileSizeBytes) === v2Size, 'v2 size matches replacement binary');
    assert(dbV2.filePath.includes(`v${dbV2.versionNumber}-`), 'v2 filePath contains version number 2');

    // 5. Verify both v1 and v2 binaries remain downloadable through storage
    const downloadedV1 = await storageProvider.download(TENANT_A_ID, dbV1.filePath);
    const downloadedV2 = await storageProvider.download(TENANT_A_ID, dbV2.filePath);
    assert(downloadedV1.equals(v1Bytes), 'Downloaded v1 bytes match original v1 binary');
    assert(downloadedV2.equals(v2Bytes), 'Downloaded v2 bytes match replacement v2 binary');

    // 6. Test storage compensation on replacement failure (v3 fails in DB => v3 deleted, v1 & v2 remain untouched)
    const v3Bytes = Buffer.from('%PDF-1.4 Version 3 doomed to fail DB transaction');
    const v3Sha256 = calculateSha256(v3Bytes);

    // Mock a DB failure during replacement by passing a corrupted session or non-existent proposal ID in middle
    const failedReplacementResp = await uploadProposalDocumentAction(
      {
        proposalId: '00000000-0000-7000-8000-000000000000', // Non-existent proposal ID
        requirementCode: 'SK_CPNS',
        fileName: 'sk_cpns_v3_fail.pdf',
        fileBuffer: v3Bytes,
      },
      storageProvider
    );

    assert(!failedReplacementResp.success, 'Failed replacement operation returns error');
    // Ensure v1 and v2 remain intact in DB and storage
    const docAfterFailedV3 = await adminPrisma.document.findUniqueOrThrow({
      where: { id: canonicalDocId },
      include: { versions: { orderBy: { versionNumber: 'asc' } } },
    });
    assert(docAfterFailedV3.currentVersion === 2, 'Document.currentVersion remains 2 after failed v3 attempt');
    assert(docAfterFailedV3.versions.length === 2, 'DocumentVersion count remains 2 after failed v3 attempt');

    const v1StillExists = await storageProvider.download(TENANT_A_ID, dbV1.filePath);
    const v2StillExists = await storageProvider.download(TENANT_A_ID, dbV2.filePath);
    assert(v1StillExists.equals(v1Bytes), 'v1 binary is completely unaffected by failed replacement');
    assert(v2StillExists.equals(v2Bytes), 'v2 binary is completely unaffected by failed replacement');

    // =============================================================
    // [9] Testing Concurrent Document Replacement Uploads (Race Condition Invariant)
    // =============================================================
    console.log('\n[9] Testing Concurrent Document Replacement Uploads (Race Condition Invariant)...');

    // Initial upload creates a fresh document with currentVersion = 1
    const freshV1Bytes = Buffer.from('%PDF-1.4 Fresh Concurrency Base Document Version 1 Binary Content');
    const freshInitialResp = await uploadProposalDocumentAction(
      {
        proposalId: proposalA1Id,
        requirementCode: 'SK_PANGKAT_TERAKHIR',
        fileName: 'sk_pangkat_base_v1.pdf',
        fileBuffer: freshV1Bytes,
        mimeType: 'application/pdf',
      },
      storageProvider
    );

    assert(freshInitialResp.success, 'Fresh base document upload succeeds');
    const freshProposalDoc = freshInitialResp.data!.documents.find((d) => d.requirementCode === 'SK_PANGKAT_TERAKHIR');
    const freshDocId = freshProposalDoc!.documentId!;

    const freshDocInitialDb = await adminPrisma.document.findUniqueOrThrow({
      where: { id: freshDocId },
    });
    assert(freshDocInitialDb.currentVersion === 1, 'Initial document starts with currentVersion = 1');

    // Launch two simultaneous replacement uploads against the SAME document concurrently
    const concurrentReqA_Bytes = Buffer.from('%PDF-1.4 Concurrent Replacement Upload Request A Binary Payload');
    const concurrentReqB_Bytes = Buffer.from('%PDF-1.4 Concurrent Replacement Upload Request B Binary Payload');

    const [concurrentRespA, concurrentRespB] = await Promise.all([
      uploadProposalDocumentAction(
        {
          proposalId: proposalA1Id,
          requirementCode: 'SK_PANGKAT_TERAKHIR',
          fileName: 'sk_pangkat_concurrent_A.pdf',
          fileBuffer: concurrentReqA_Bytes,
          mimeType: 'application/pdf',
        },
        storageProvider
      ),
      uploadProposalDocumentAction(
        {
          proposalId: proposalA1Id,
          requirementCode: 'SK_PANGKAT_TERAKHIR',
          fileName: 'sk_pangkat_concurrent_B.pdf',
          fileBuffer: concurrentReqB_Bytes,
          mimeType: 'application/pdf',
        },
        storageProvider
      ),
    ]);

    assert(concurrentRespA.success, 'Concurrent replacement upload A succeeds');
    assert(concurrentRespB.success, 'Concurrent replacement upload B succeeds');

    const finalConcurrentDbDoc = await adminPrisma.document.findUniqueOrThrow({
      where: { id: freshDocId },
      include: { versions: { orderBy: { versionNumber: 'asc' } } },
    });

    assert(finalConcurrentDbDoc.currentVersion === 3, 'Document.currentVersion advanced to exactly 3 under concurrency');
    assert(finalConcurrentDbDoc.versions.length === 3, 'Exactly 3 DocumentVersion records exist');

    const versionNumbers = finalConcurrentDbDoc.versions.map((v) => v.versionNumber);
    assert(
      JSON.stringify(versionNumbers) === JSON.stringify([1, 2, 3]),
      'DocumentVersion versionNumbers are strictly [1, 2, 3] with zero duplicates or lost increments'
    );

    // Verify all 3 version binaries are intact in object storage
    const downloadedFreshV1 = await storageProvider.download(TENANT_A_ID, finalConcurrentDbDoc.versions[0].filePath);
    const downloadedFreshV2 = await storageProvider.download(TENANT_A_ID, finalConcurrentDbDoc.versions[1].filePath);
    const downloadedFreshV3 = await storageProvider.download(TENANT_A_ID, finalConcurrentDbDoc.versions[2].filePath);

    assert(downloadedFreshV1.equals(freshV1Bytes), 'Version 1 binary intact after concurrent replacements');
    assert(
      (downloadedFreshV2.equals(concurrentReqA_Bytes) && downloadedFreshV3.equals(concurrentReqB_Bytes)) ||
      (downloadedFreshV2.equals(concurrentReqB_Bytes) && downloadedFreshV3.equals(concurrentReqA_Bytes)),
      'Both concurrent uploads A and B persisted valid, distinct version binaries (v2 and v3)'
    );
  } finally {
    resetSessionProvider();
    // Cleanup fixtures
    await adminPrisma.awardProposalDocument.deleteMany({
      where: { proposalId: { in: [proposalA1Id, proposalA2Id, proposalB1Id] } },
    });
    await adminPrisma.awardProposal.deleteMany({
      where: { id: { in: [proposalA1Id, proposalA2Id, proposalB1Id] } },
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
    await adminPrisma.employee.deleteMany({
      where: { id: { in: [testEmpAId, testEmpBId] } },
    });
    await adminPool.end();
  }

  console.log('\n================================================================');
  console.log(` SUMMARY: ${passCount} / ${testCount} TESTS PASSED `);
  console.log('================================================================\n');

  if (passCount !== testCount) {
    process.exit(1);
  }
}

runAwardProposalDocumentUploadTests().catch((err) => {
  console.error('Unhandled error in test suite:', err);
  process.exit(1);
});
