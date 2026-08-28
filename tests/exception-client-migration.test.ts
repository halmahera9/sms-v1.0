import fs from 'fs';
import path from 'path';

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

async function runExceptionClientMigrationTests() {
  console.log('=====================================================');
  console.log(' EXCEPTION CLIENT MIGRATION TEST SUITE               ');
  console.log('=====================================================\n');

  const componentPath = path.join(process.cwd(), 'src/platform/ui/UnifiedExceptionCenter.tsx');
  const pagePath = path.join(process.cwd(), 'src/app/page.tsx');

  assert(fs.existsSync(componentPath), 'UnifiedExceptionCenter.tsx file exists');
  const componentSource = fs.readFileSync(componentPath, 'utf8');
  const pageSource = fs.readFileSync(pagePath, 'utf8');

  // TEST 1: UnifiedExceptionCenter imports getExceptionsAction
  assert(
    componentSource.includes('getExceptionsAction'),
    'UnifiedExceptionCenter imports getExceptionsAction server action'
  );

  // TEST 2: UnifiedExceptionCenter imports updateExceptionStatusAction
  assert(
    componentSource.includes('updateExceptionStatusAction'),
    'UnifiedExceptionCenter imports updateExceptionStatusAction server action'
  );

  // TEST 3: UnifiedExceptionCenter does NOT import PlatformExceptionQueue
  assert(
    !componentSource.includes("import { PlatformExceptionQueue }") &&
    !componentSource.includes("from '../exceptions/queue'") &&
    !componentSource.includes("from '@/platform/exceptions/queue'"),
    'UnifiedExceptionCenter does NOT import PlatformExceptionQueue'
  );

  // TEST 4: UnifiedExceptionCenter does NOT instantiate PlatformExceptionQueue
  assert(
    !componentSource.includes('new PlatformExceptionQueue'),
    'UnifiedExceptionCenter does NOT instantiate PlatformExceptionQueue'
  );

  // TEST 5: Legacy queue mutation/read APIs are not used
  assert(
    !componentSource.includes('exceptionQueue.getAll') &&
    !componentSource.includes('exceptionQueue.updateStatus') &&
    !componentSource.includes('exceptionQueue.createFromValidationResults'),
    'UnifiedExceptionCenter does NOT call legacy PlatformExceptionQueue methods'
  );

  // TEST 6: UI consumes canonical server DTO fields
  assert(
    componentSource.includes('exc.ruleCode') &&
    componentSource.includes('exc.message') &&
    componentSource.includes('exc.domain') &&
    componentSource.includes('exc.entityType') &&
    componentSource.includes('exc.entityId') &&
    componentSource.includes('exc.severity') &&
    componentSource.includes('exc.status'),
    'UnifiedExceptionCenter consumes canonical server DTO fields'
  );

  // TEST 7: resolutionNotes is not used as message and is independently rendered
  assert(
    componentSource.includes('exc.resolutionNotes') &&
    componentSource.includes('exc.message') &&
    componentSource.includes('Catatan:'),
    'UnifiedExceptionCenter displays message and resolutionNotes independently'
  );

  // TEST 8: Mutation invokes updateExceptionStatusAction
  assert(
    componentSource.includes('await updateExceptionStatusAction(') &&
    componentSource.includes('exceptionId:') &&
    componentSource.includes('resolutionNote:'),
    'UnifiedExceptionCenter mutation handler calls updateExceptionStatusAction with valid payload'
  );

  // TEST 9: Server Action error and loading states are handled
  assert(
    componentSource.includes('res.error') &&
    componentSource.includes('setMutationError') &&
    componentSource.includes('setError') &&
    componentSource.includes('isSubmitting') &&
    componentSource.includes('loading'),
    'UnifiedExceptionCenter surfaces server action errors and manages loading/submission states'
  );

  // TEST 10: src/app/page.tsx does not instantiate PlatformExceptionQueue for exception center
  assert(
    !pageSource.includes("import { PlatformExceptionQueue }") &&
    !pageSource.includes("new PlatformExceptionQueue"),
    'src/app/page.tsx has completely eliminated PlatformExceptionQueue instantiation'
  );

  // TEST 11: PlatformOperationalService is not reintroduced
  assert(
    !componentSource.includes('PlatformOperationalService') &&
    !componentSource.includes('getExceptionQueue'),
    'UnifiedExceptionCenter does NOT reintroduce PlatformOperationalService'
  );

  console.log(`\n=====================================================`);
  console.log(` RESULT: ${passCount}/${testCount} Exception Client Migration tests PASSED `);
  console.log(`=====================================================\n`);
}

runExceptionClientMigrationTests().catch((err) => {
  console.error('Fatal Exception Client Migration Test Runner Error:', err);
  process.exit(1);
});
