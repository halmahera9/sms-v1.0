import 'dotenv/config';
import { calculateSha256 } from '../src/platform/storage/checksum';
import { InMemoryObjectStorageProvider, normalizeAndValidateStoragePath } from '../src/platform/storage/in-memory';

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

async function runObjectStorageTests() {
  console.log('=====================================================');
  console.log(' OBJECT STORAGE & SHA-256 INTEGRITY TEST SUITE       ');
  console.log('=====================================================\n');

  // =================================================================================
  // SECTION A: SHA-256 CHECKSUM UNIT TESTS
  // =================================================================================
  console.log('[1] Testing Known SHA-256 Vectors...');
  
  // Vector 1: 'hello world'
  const helloBuffer = Buffer.from('hello world', 'utf-8');
  const helloHash = calculateSha256(helloBuffer);
  assert(
    helloHash === 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
    'Known binary vector "hello world" matches standard SHA-256 digest'
  );

  // Vector 2: Empty buffer (e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
  const emptyBuffer = Buffer.alloc(0);
  const emptyHash = calculateSha256(emptyBuffer);
  assert(
    emptyHash === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'Empty binary buffer matches canonical empty SHA-256 digest'
  );

  // Vector 3: Uint8Array input equivalence
  const uint8Input = new Uint8Array([104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100]); // 'hello world'
  const uint8Hash = calculateSha256(uint8Input);
  assert(
    uint8Hash === helloHash,
    'Uint8Array input generates identical checksum to Buffer input'
  );

  console.log('\n[2] Testing SHA-256 Invariants (Deterministic, Differential, Formatting)...');
  const data1 = Buffer.from('banyubiru-production-payload-alpha-12345', 'utf-8');
  const data2 = Buffer.from('banyubiru-production-payload-alpha-12346', 'utf-8');

  const hash1a = calculateSha256(data1);
  const hash1b = calculateSha256(data1);
  const hash2 = calculateSha256(data2);

  assert(
    hash1a === hash1b,
    'Deterministic: Identical binary content produces identical SHA-256 checksum'
  );

  assert(
    hash1a !== hash2,
    'Differential: Different binary content produces distinct SHA-256 checksums'
  );

  assert(
    hash1a.length === 64,
    'Output length is strictly 64 characters'
  );

  assert(
    /^[a-f0-9]{64}$/.test(hash1a),
    'Output format is strictly lowercase hexadecimal'
  );

  // =================================================================================
  // SECTION B: IN-MEMORY STORAGE UPLOAD TESTS
  // =================================================================================
  console.log('\n[3] Testing In-Memory Storage Upload & Defensive Buffer Copying...');
  const provider = new InMemoryObjectStorageProvider();
  const TENANT_A = '11111111-1111-7111-8111-111111111111';
  const TENANT_B = '22222222-2222-7222-8222-222222222222';

  const testPdfContent = Buffer.from('%PDF-1.4 Mock PDF Content For Banyubiru Testing', 'utf-8');
  const uploadRes = await provider.upload({
    tenantId: TENANT_A,
    storagePath: 'documents/2026/proposal-001.pdf',
    content: testPdfContent,
    mimeType: 'application/pdf',
  });

  assert(
    uploadRes.storagePath === 'documents/2026/proposal-001.pdf',
    'Upload output storagePath matches canonical path'
  );

  assert(
    uploadRes.sizeBytes === testPdfContent.byteLength,
    'Upload output sizeBytes matches exact byte length of uploaded binary'
  );

  assert(
    uploadRes.checksumSha256 === calculateSha256(testPdfContent),
    'Upload output checksumSha256 matches canonical SHA-256 of uploaded binary'
  );

  assert(
    uploadRes.mimeType === 'application/pdf',
    'Upload output preserves provided MIME type'
  );

  // Buffer Safety: Caller mutates local buffer after upload -> internal storage remains untouched
  const mutatingBuffer = Buffer.from('Original Immutable Data', 'utf-8');
  await provider.upload({
    tenantId: TENANT_A,
    storagePath: 'documents/immutable-check.txt',
    content: mutatingBuffer,
  });
  mutatingBuffer[0] = 88; // Change 'O' to 'X' in caller buffer

  const downloadedCheck = await provider.download(TENANT_A, 'documents/immutable-check.txt');
  assert(
    downloadedCheck.toString('utf-8') === 'Original Immutable Data',
    'Buffer Safety: External buffer mutation after upload does not affect stored binary'
  );

  // Buffer Safety: Caller mutates downloaded buffer -> internal storage remains untouched
  downloadedCheck[0] = 89; // Change 'O' to 'Y'
  const downloadedCheck2 = await provider.download(TENANT_A, 'documents/immutable-check.txt');
  assert(
    downloadedCheck2.toString('utf-8') === 'Original Immutable Data',
    'Buffer Safety: Downloaded buffer mutation does not affect internal stored object'
  );

  // =================================================================================
  // SECTION C: PATH TRAVERSAL & CANONICALIZATION TESTS
  // =================================================================================
  console.log('\n[4] Testing Path Traversal Defense & Canonicalization...');

  let traversalBlocked1 = false;
  try {
    normalizeAndValidateStoragePath('../../tenant-a-secret');
  } catch (err: any) {
    traversalBlocked1 = err.message.includes('Path traversal');
  }
  assert(
    traversalBlocked1,
    'Path Traversal: "../../tenant-a-secret" is strictly rejected'
  );

  let traversalBlocked2 = false;
  try {
    normalizeAndValidateStoragePath('documents/../../../secret.txt');
  } catch (err: any) {
    traversalBlocked2 = err.message.includes('Path traversal');
  }
  assert(
    traversalBlocked2,
    'Path Traversal: "documents/../../../secret.txt" is strictly rejected'
  );

  let nullByteBlocked = false;
  try {
    normalizeAndValidateStoragePath('documents/file.pdf\0malicious');
  } catch (err: any) {
    nullByteBlocked = err.message.includes('illegal null bytes');
  }
  assert(
    nullByteBlocked,
    'Path Security: Null byte injection is strictly rejected'
  );

  const cleanWindowsPath = normalizeAndValidateStoragePath('\\documents\\2026\\subfolder\\file.pdf');
  assert(
    cleanWindowsPath === 'documents/2026/subfolder/file.pdf',
    'Path Canonicalization: Windows backslashes and leading/trailing slashes are canonicalized'
  );

  // =================================================================================
  // SECTION D: IN-MEMORY STORAGE DOWNLOAD & TENANT ISOLATION TESTS
  // =================================================================================
  console.log('\n[5] Testing In-Memory Storage Download & Strict Tenant Isolation...');
  const downloadedContentA = await provider.download(TENANT_A, 'documents/2026/proposal-001.pdf');

  assert(
    Buffer.compare(downloadedContentA, testPdfContent) === 0,
    'download(tenantId, storagePath) returns Buffer matching original uploaded binary'
  );

  const metadataA = await provider.getMetadata(TENANT_A, 'documents/2026/proposal-001.pdf');
  assert(
    metadataA !== null &&
    metadataA.sizeBytes === testPdfContent.byteLength &&
    metadataA.checksumSha256 === calculateSha256(testPdfContent),
    'getMetadata(tenantId, storagePath) matches stored binary metadata'
  );

  // Tenant B cannot access Tenant A's document
  let crossTenantFailed = false;
  try {
    await provider.download(TENANT_B, 'documents/2026/proposal-001.pdf');
  } catch {
    crossTenantFailed = true;
  }

  assert(
    crossTenantFailed,
    'Tenant B calling download(tenantB, path) is strictly rejected when path belongs only to Tenant A'
  );

  // Independent same-path coexistence in Tenant B
  const tenantBContent = Buffer.from('Distinct Tenant B private document content', 'utf-8');
  await provider.upload({
    tenantId: TENANT_B,
    storagePath: 'documents/2026/proposal-001.pdf',
    content: tenantBContent,
    mimeType: 'text/plain',
  });

  const downloadedContentB = await provider.download(TENANT_B, 'documents/2026/proposal-001.pdf');

  assert(
    Buffer.compare(downloadedContentB, tenantBContent) === 0,
    'Tenant B receives its own distinct bytes at same storagePath'
  );

  const downloadedContentAAfterB = await provider.download(TENANT_A, 'documents/2026/proposal-001.pdf');

  assert(
    Buffer.compare(downloadedContentAAfterB, testPdfContent) === 0,
    'Tenant A object remains completely intact and unaffected by Tenant B upload'
  );

  // =================================================================================
  // SECTION E: IN-MEMORY STORAGE DELETE TESTS
  // =================================================================================
  console.log('\n[6] Testing In-Memory Storage Delete & Tenant Isolation...');
  // Delete non-existent path
  const deleteFakeRes = await provider.delete(TENANT_A, 'non-existent-path.pdf');
  assert(
    deleteFakeRes === false,
    'delete(tenantId, nonExistentPath) returns false'
  );

  // Tenant B attempting to delete Tenant A object at a path unique to Tenant A
  await provider.upload({
    tenantId: TENANT_A,
    storagePath: 'documents/2026/tenant-a-only.pdf',
    content: Buffer.from('Tenant A Unique File', 'utf-8'),
  });

  const crossTenantDeleteRes = await provider.delete(TENANT_B, 'documents/2026/tenant-a-only.pdf');
  assert(
    crossTenantDeleteRes === false,
    'Tenant B calling delete(tenantB, path) returns false and CANNOT delete Tenant A object'
  );

  const stillExistsA = await provider.download(TENANT_A, 'documents/2026/tenant-a-only.pdf');
  assert(
    stillExistsA.length > 0,
    'Tenant A object remains intact after unauthorized Tenant B delete attempt'
  );

  // Tenant A deletes its own object at shared path
  const deleteResA = await provider.delete(TENANT_A, 'documents/2026/proposal-001.pdf');
  assert(
    deleteResA === true,
    'delete(tenantId, storagePath) returns true when deleting existing object in tenant space'
  );

  // Deleted object cannot be downloaded
  let downloadAfterDeleteFailed = false;
  try {
    await provider.download(TENANT_A, 'documents/2026/proposal-001.pdf');
  } catch {
    downloadAfterDeleteFailed = true;
  }
  assert(
    downloadAfterDeleteFailed,
    'Deleted object cannot be downloaded afterward'
  );

  // Tenant B object was NOT deleted when Tenant A deleted its own same-path object
  const downloadedContentBAfterADelete = await provider.download(TENANT_B, 'documents/2026/proposal-001.pdf');
  assert(
    Buffer.compare(downloadedContentBAfterADelete, tenantBContent) === 0,
    'Tenant B object remains fully accessible after Tenant A deleted its same-path object'
  );

  console.log(`\n=====================================================`);
  console.log(` RESULT: All ${passCount}/${testCount} Object Storage & SHA-256 tests PASSED `);
  console.log(`=====================================================\n`);
}

runObjectStorageTests().catch((err) => {
  console.error('Fatal Object Storage Test Runner Error:', err);
  process.exit(1);
});
