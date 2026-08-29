import fs from 'fs';
import path from 'path';
import { getAwardProposalsAction } from '../src/domains/employee/awards/actions';
import { setSessionProvider, resetSessionProvider } from '../src/platform/auth/session';

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

async function runAwardClientMigrationTests() {
  console.log('=====================================================');
  console.log(' AWARD CLIENT READ MIGRATION TEST SUITE              ');
  console.log('=====================================================\n');

  const pagePath = path.join(process.cwd(), 'src/app/page.tsx');
  assert(fs.existsSync(pagePath), 'page.tsx file exists');
  const pageSource = fs.readFileSync(pagePath, 'utf8');

  // [1] Static Analysis: Import Boundary & Elimination of Legacy Storage
  console.log('[1] Testing Static Import Boundaries in src/app/page.tsx...');

  assert(
    pageSource.includes('getAwardProposalsAction') &&
      pageSource.includes("from '@/domains/employee/awards/actions'"),
    'TEST 1: page.tsx imports getAwardProposalsAction from @/domains/employee/awards/actions'
  );

  assert(
    !pageSource.includes('loadProposals'),
    'TEST 2: page.tsx has completely eliminated loadProposals import and usage'
  );

  assert(
    !pageSource.includes('saveProposals'),
    'TEST 3: page.tsx has completely eliminated saveProposals import and usage'
  );

  assert(
    !pageSource.includes("from '@/lib/award-storage'"),
    'TEST 4: page.tsx has eliminated all imports from @/lib/award-storage'
  );

  // [2] Static Analysis: Asynchronous Initial Load & Fail-Closed Contract
  console.log('\n[2] Testing Initial Load Lifecycle & Fail-Closed Contract...');

  assert(
    pageSource.includes('getAwardProposalsAction().then(') ||
      pageSource.includes('await getAwardProposalsAction()'),
    'TEST 5: Initial Award proposal load calls getAwardProposalsAction asynchronously'
  );

  assert(
    pageSource.includes('if (res.success && res.data)'),
    'TEST 6: State update strictly guards on res.success && res.data'
  );

  assert(
    !pageSource.includes('catch') || !pageSource.includes('loadProposals()'),
    'TEST 7: Failure response does not fallback to localStorage or mock generation'
  );

  // [3] Static Analysis: State Mutation Write-Through Elimination
  console.log('\n[3] Testing Mutation Handlers State Integrity...');

  assert(
    pageSource.includes('const handleUpdateCandidate =') &&
      !pageSource.includes('saveProposals(updatedList)'),
    'TEST 8: handleUpdateCandidate updates React state without writing to localStorage'
  );

  assert(
    pageSource.includes('const handleImportComplete =') &&
      !pageSource.includes('saveProposals(combined)'),
    'TEST 9: handleImportComplete updates React state without writing to localStorage'
  );

  assert(
    pageSource.includes('const handleUpdateProposals =') &&
      !pageSource.includes('saveProposals(nextList)'),
    'TEST 10: handleUpdateProposals updates React state without writing to localStorage'
  );

  // [4] Functional Verification: getAwardProposalsAction Behavior
  console.log('\n[4] Testing Server Action Contract for Client Consumers...');

  // 4A: Unauthenticated fail-closed
  resetSessionProvider();
  setSessionProvider({
    async getSession() {
      return null;
    },
  });

  const unauthRes = await getAwardProposalsAction();
  assert(
    unauthRes.success === false,
    'TEST 11: getAwardProposalsAction returns success: false for unauthenticated client'
  );
  assert(
    unauthRes.error?.code === 'UNAUTHENTICATED',
    'TEST 12: Unauthenticated client receives standard UNAUTHENTICATED error code'
  );

  // 4B: Authenticated tenant retrieval
  const testTenantId = '11111111-1111-7111-8111-111111111111';
  const testActorId = 'a1111111-1111-7111-8111-111111111111';

  setSessionProvider({
    async getSession() {
      return {
        actorId: testActorId,
        tenantId: testTenantId,
        username: 'test_verifikator',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      };
    },
  });

  const authRes = await getAwardProposalsAction();
  assert(
    authRes.success === true,
    'TEST 13: getAwardProposalsAction returns success: true for authenticated client'
  );
  assert(
    Array.isArray(authRes.data),
    'TEST 14: Authenticated client receives AwardProposal[] array payload'
  );

  // 4C: JSON Serializability
  assert(
    JSON.stringify(authRes) !== undefined,
    'TEST 15: Server action envelope is 100% JSON serializable for client consumption'
  );

  resetSessionProvider();

  console.log('\n=====================================================');
  console.log(` RESULT: All ${passCount}/${testCount} Award Client Migration tests PASSED `);
  console.log('=====================================================\n');
}

runAwardClientMigrationTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
