import 'dotenv/config';
import pg from 'pg';
import crypto from 'crypto';
import { Severity, ExceptionStatus } from '@prisma/client';
import { PostgresExceptionRepository } from '../src/platform/repositories/exception';
import { runInTenantContext } from '../src/platform/db/tenant-context';
import { ValidationResult } from '../src/platform/types';

const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!migrationUrl) {
  throw new Error('SECURITY ERROR: MIGRATION_DATABASE_URL environment variable is missing.');
}
const migrationPool = new pg.Pool({ connectionString: migrationUrl });

const repository = new PostgresExceptionRepository();

const TENANT_A_ID = '66666666-6666-4666-8666-666666666666';
const TENANT_B_ID = '77777777-7777-4777-8777-777777777777';

const ACTOR_A_ID = 'a6666666-6666-4666-8666-666666666666';
const ACTOR_B_ID = 'b7777777-7777-4777-8777-777777777777';

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
    await migrationPool.query(`DELETE FROM exception_items WHERE tenant_id IN ('${TENANT_A_ID}', '${TENANT_B_ID}');`);
  } catch (err) {
    // Ignore cleanup warning
  }
  try {
    await migrationPool.query(`DELETE FROM workflow_instances WHERE tenant_id IN ('${TENANT_A_ID}', '${TENANT_B_ID}');`);
  } catch (err) {
    // Ignore cleanup warning
  }
}

async function setupFixtures() {
  await cleanupFixtures();

  await migrationPool.query(`
    INSERT INTO tenants (id, code, name, status, created_at, updated_at) VALUES
      ('${TENANT_A_ID}', 'EXC_REPO_TENANT_A', 'Exception Tenant A', 'ACTIVE', NOW(), NOW()),
      ('${TENANT_B_ID}', 'EXC_REPO_TENANT_B', 'Exception Tenant B', 'ACTIVE', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', code = EXCLUDED.code;
  `);

  await migrationPool.query(`
    INSERT INTO user_actors (id, tenant_id, username, email, full_name, role, status, created_at, updated_at) VALUES
      ('${ACTOR_A_ID}', '${TENANT_A_ID}', 'actor_exc_a', 'exc_a@test.local', 'Actor A', 'ADMIN_TENANT', 'ACTIVE', NOW(), NOW()),
      ('${ACTOR_B_ID}', '${TENANT_B_ID}', 'actor_exc_b', 'exc_b@test.local', 'Actor B', 'ADMIN_TENANT', 'ACTIVE', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';
  `);
}

async function runExceptionRepositoryTests() {
  console.log('=====================================================');
  console.log('       EXCEPTION REPOSITORY TEST SUITE               ');
  console.log('=====================================================\n');

  try {
    await setupFixtures();

    const entity1Id = crypto.randomUUID();
    const entity2Id = crypto.randomUUID();

    // ----------------------------------------------------
    // Test 1: createTx creates new WorkflowInstance + ExceptionItem + AuditEvent
    // ----------------------------------------------------
    console.log('[1] Testing createTx creates new WorkflowInstance + ExceptionItem + AuditEvent...');
    let created1 = await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      return await repository.createTx(tx, TENANT_A_ID, {
        entityType: 'AwardProposal',
        entityId: entity1Id,
        ruleCode: 'DOC_COMPLETENESS_RULE',
        severity: Severity.HIGH,
        actorUserId: ACTOR_A_ID,
        resolutionNotes: 'Initial completeness check missing files',
      });
    });

    assert(Boolean(created1.id), 'ExceptionItem created with valid ID');
    assert(created1.entityType === 'AwardProposal', 'EntityType matches input');
    assert(created1.entityId === entity1Id, 'EntityId matches input');
    assert(created1.ruleCode === 'DOC_COMPLETENESS_RULE', 'RuleCode matches input');
    assert(created1.severity === Severity.HIGH, 'Severity matches input');
    assert(created1.status === ExceptionStatus.OPEN, 'Default status is OPEN');
    assert(created1.domain === 'EMPLOYEE', 'Domain derived as EMPLOYEE');

    // Verify WorkflowInstance was created in DB
    const wfRes = await migrationPool.query(
      `SELECT * FROM workflow_instances WHERE tenant_id = '${TENANT_A_ID}' AND entity_type = 'AwardProposal' AND entity_id = '${entity1Id}';`
    );
    assert(wfRes.rows.length === 1, 'Exactly one WorkflowInstance was created in database');
    assert(wfRes.rows[0].current_state === 'NOMINATIF', 'AwardProposal WorkflowInstance defaulted to NOMINATIF state');

    // Verify AuditEvent was created in DB
    const auditRes = await migrationPool.query(
      `SELECT * FROM audit_events WHERE tenant_id = '${TENANT_A_ID}' AND entity_id = '${created1.id}';`
    );
    assert(auditRes.rows.length === 1, 'Exactly one AuditEvent was created for the new ExceptionItem');
    assert(auditRes.rows[0].action === 'CREATE_EXCEPTION', 'AuditEvent action is CREATE_EXCEPTION');

    // ----------------------------------------------------
    // Test 2: Existing WorkflowInstance reuse
    // ----------------------------------------------------
    console.log('\n[2] Testing existing WorkflowInstance reuse...');
    let created2 = await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      return await repository.createTx(tx, TENANT_A_ID, {
        entityType: 'AwardProposal',
        entityId: entity1Id, // Same entity ID!
        ruleCode: 'MASA_KERJA_ELIGIBILITY_RULE',
        severity: Severity.CRITICAL,
        actorUserId: ACTOR_A_ID,
      });
    });

    assert(created2.id !== created1.id, 'Second exception has distinct ID');
    const wfCountRes = await migrationPool.query(
      `SELECT count(*) FROM workflow_instances WHERE tenant_id = '${TENANT_A_ID}' AND entity_type = 'AwardProposal' AND entity_id = '${entity1Id}';`
    );
    assert(wfCountRes.rows[0].count === '1', 'Reused existing WorkflowInstance without creating a duplicate');

    // ----------------------------------------------------
    // Test 3: Student domain exception with custom state
    // ----------------------------------------------------
    console.log('\n[3] Testing student domain exception with explicit initial state...');
    let createdStudent = await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      return await repository.createTx(tx, TENANT_A_ID, {
        entityType: 'Student',
        entityId: entity2Id,
        ruleCode: 'STUDENT_NISN_FORMAT_RULE',
        severity: Severity.MEDIUM,
        initialWorkflowState: 'NEEDS_VERIFICATION',
      });
    });

    assert(createdStudent.domain === 'STUDENT', 'Domain derived as STUDENT');
    const wfStudentRes = await migrationPool.query(
      `SELECT * FROM workflow_instances WHERE tenant_id = '${TENANT_A_ID}' AND entity_type = 'Student' AND entity_id = '${entity2Id}';`
    );
    assert(wfStudentRes.rows.length === 1, 'Student WorkflowInstance created');
    assert(wfStudentRes.rows[0].current_state === 'NEEDS_VERIFICATION', 'Student WorkflowInstance has state NEEDS_VERIFICATION');

    // ----------------------------------------------------
    // Test 4: Tenant isolation
    // ----------------------------------------------------
    console.log('\n[4] Testing tenant isolation...');
    const tenantBItems = await runInTenantContext(ACTOR_B_ID, TENANT_B_ID, async (tx) => {
      return await repository.findManyTx(tx, TENANT_B_ID);
    });
    assert(tenantBItems.length === 0, 'Tenant B sees 0 exceptions from Tenant A');

    const tenantAItems = await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      return await repository.findManyTx(tx, TENANT_A_ID);
    });
    assert(tenantAItems.length === 3, 'Tenant A sees all 3 created exceptions');

    // ----------------------------------------------------
    // Test 5: Transaction atomicity and rollback
    // ----------------------------------------------------
    console.log('\n[5] Testing transaction atomicity & rollback...');
    const rollbackEntityId = crypto.randomUUID();
    let caught = false;

    try {
      await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
        await repository.createTx(tx, TENANT_A_ID, {
          entityType: 'AwardProposal',
          entityId: rollbackEntityId,
          ruleCode: 'DOC_COMPLETENESS_RULE',
          severity: Severity.LOW,
        });

        // Intentional rollback trigger
        throw new Error('SIMULATED_TRANSACTION_FAILURE');
      });
    } catch (err: any) {
      if (err.message === 'SIMULATED_TRANSACTION_FAILURE') {
        caught = true;
      }
    }

    assert(caught, 'Transaction threw simulated failure as expected');

    const rollbackWf = await migrationPool.query(
      `SELECT count(*) FROM workflow_instances WHERE entity_id = '${rollbackEntityId}';`
    );
    assert(rollbackWf.rows[0].count === '0', 'WorkflowInstance rolled back cleanly on error');

    const rollbackExc = await migrationPool.query(
      `SELECT count(*) FROM exception_items WHERE workflow_instance_id IN (SELECT id FROM workflow_instances WHERE entity_id = '${rollbackEntityId}');`
    );
    assert(rollbackExc.rows[0].count === '0', 'ExceptionItem rolled back cleanly on error');

    // ----------------------------------------------------
    // Test 6: Input validation checks
    // ----------------------------------------------------
    console.log('\n[6] Testing input validation guards...');
    let invalidEntityCaught = false;
    try {
      await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
        await repository.createTx(tx, TENANT_A_ID, {
          entityType: 'AwardProposal',
          entityId: 'not-a-uuid',
          ruleCode: 'DOC_COMPLETENESS_RULE',
          severity: Severity.LOW,
        });
      });
    } catch (err: any) {
      if (err.message.includes('Validation Error: Entity id must be a valid UUID')) {
        invalidEntityCaught = true;
      }
    }
    assert(invalidEntityCaught, 'createTx rejects non-UUID entityId');

    // ----------------------------------------------------
    // Test 7: createFromValidationResultsTx with single failure
    // ----------------------------------------------------
    console.log('\n[7] Testing createFromValidationResultsTx with single failure...');
    const entity3Id = crypto.randomUUID();
    const mockValidationFailure1: ValidationResult[] = [
      {
        valid: false,
        ruleId: 'DOC_COMPLETENESS_RULE',
        severity: 'ERROR',
        message: 'Berkas wajib SK CPNS belum diunggah',
      },
    ];

    const results7 = await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      return await repository.createFromValidationResultsTx(
        tx,
        TENANT_A_ID,
        'AwardProposal',
        entity3Id,
        mockValidationFailure1,
        ACTOR_A_ID
      );
    });

    assert(results7.length === 1, 'createFromValidationResultsTx returns 1 created exception');
    assert(results7[0].ruleCode === 'DOC_COMPLETENESS_RULE', 'Rule code matches validation failure');
    assert(results7[0].severity === Severity.HIGH, 'ValidationSeverity ERROR mapped canonically to Severity.HIGH');
    assert(results7[0].status === ExceptionStatus.OPEN, 'Exception created with OPEN status');
    assert(results7[0].resolutionNotes === null, 'Automated validation exception has empty/null resolutionNotes');
    assert(
      results7[0].message === 'Berkas persyaratan usulan penghargaan belum lengkap atau belum diunggah.',
      'Message derives from canonical RULE_MESSAGE_CATALOG rather than raw validation result message'
    );

    // ----------------------------------------------------
    // Test 8: createFromValidationResultsTx with valid and invalid INFO results
    // ----------------------------------------------------
    console.log('\n[8] Testing createFromValidationResultsTx ignores valid results and invalid INFO...');
    const entity4Id = crypto.randomUUID();
    const mockValidationSuccessAndInfo: ValidationResult[] = [
      {
        valid: true,
        ruleId: 'DOC_COMPLETENESS_RULE',
        severity: 'INFO',
        message: 'Semua berkas lengkap',
      },
      {
        valid: false,
        ruleId: 'DOC_FORMAT_RULE',
        severity: 'INFO',
        message: 'Informasi format dokumen (tidak boleh membuat exception)',
      },
    ];

    const results8 = await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      return await repository.createFromValidationResultsTx(
        tx,
        TENANT_A_ID,
        'AwardProposal',
        entity4Id,
        mockValidationSuccessAndInfo,
        ACTOR_A_ID
      );
    });

    assert(results8.length === 0, 'createFromValidationResultsTx ignores valid results and invalid INFO (0 created)');

    // ----------------------------------------------------
    // Test 9: Multiple failures, severity mapping, and null resolutionNotes
    // ----------------------------------------------------
    console.log('\n[9] Testing multiple failures, canonical severity mappings, and null resolutionNotes...');
    const entity5Id = crypto.randomUUID();
    const mockMultipleFailures: ValidationResult[] = [
      {
        valid: false,
        ruleId: 'DOC_COMPLETENESS_RULE',
        severity: 'ERROR',
        message: 'Error level rule failure',
      },
      {
        valid: false,
        ruleId: 'STUDENT_NISN_FORMAT_RULE',
        severity: 'WARNING',
        message: 'Warning level rule failure',
      },
      {
        valid: false,
        ruleId: 'OCR_CONFIDENCE_THRESHOLD_RULE',
        severity: 'ERROR',
        message: 'Explicit CRITICAL severity override in metadata',
        metadata: { severity: Severity.CRITICAL },
      },
      {
        valid: false,
        ruleId: 'DOC_FORMAT_RULE',
        severity: 'INFO',
        message: 'Invalid INFO rule strictly ignored',
      },
      {
        valid: true,
        ruleId: 'SE_BKD_22_2026_RULE',
        severity: 'INFO',
        message: 'Passing rule ignored',
      },
    ];

    const results9 = await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      return await repository.createFromValidationResultsTx(
        tx,
        TENANT_A_ID,
        'ExtractedItem',
        entity5Id,
        mockMultipleFailures,
        ACTOR_A_ID
      );
    });

    assert(results9.length === 3, 'Created exactly 3 exceptions for ERROR/WARNING failures (INFO excluded)');
    const docComp = results9.find((r) => r.ruleCode === 'DOC_COMPLETENESS_RULE');
    const nisnFormat = results9.find((r) => r.ruleCode === 'STUDENT_NISN_FORMAT_RULE');
    const ocrConf = results9.find((r) => r.ruleCode === 'OCR_CONFIDENCE_THRESHOLD_RULE');

    assert(docComp?.severity === Severity.HIGH, 'ERROR severity mapped to HIGH');
    assert(nisnFormat?.severity === Severity.MEDIUM, 'WARNING severity mapped to MEDIUM');
    assert(ocrConf?.severity === Severity.CRITICAL, 'Metadata explicit CRITICAL severity honored');
    assert(
      results9.every((r) => r.resolutionNotes === null),
      'All automated validation exceptions have null resolutionNotes'
    );

    // ----------------------------------------------------
    // Test 10: Duplicate active exception prevention (Idempotency)
    // ----------------------------------------------------
    console.log('\n[10] Testing duplicate active exception prevention (idempotency)...');
    const duplicateRunResults = await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      return await repository.createFromValidationResultsTx(
        tx,
        TENANT_A_ID,
        'ExtractedItem',
        entity5Id,
        mockMultipleFailures,
        ACTOR_A_ID
      );
    });

    assert(duplicateRunResults.length === 3, 'Returns 3 active exception records on re-run');
    assert(
      duplicateRunResults[0].id === results9[0].id &&
      duplicateRunResults[1].id === results9[1].id &&
      duplicateRunResults[2].id === results9[2].id,
      'Duplicate active exceptions avoided; existing open records returned'
    );

    // Verify DB count did not increase
    const countCheck = await migrationPool.query(
      `SELECT count(*) FROM exception_items WHERE workflow_instance_id IN (
        SELECT id FROM workflow_instances WHERE entity_id = '${entity5Id}'
      );`
    );
    assert(countCheck.rows[0].count === '3', 'Database contains exactly 3 records without duplicates');

    // ----------------------------------------------------
    // Test 11: Transaction rollback atomicity
    // ----------------------------------------------------
    console.log('\n[11] Testing bridge transaction rollback atomicity...');
    const rollbackEntity2Id = crypto.randomUUID();
    let bridgeRollbackCaught = false;

    try {
      await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
        await repository.createFromValidationResultsTx(
          tx,
          TENANT_A_ID,
          'AwardProposal',
          rollbackEntity2Id,
          mockValidationFailure1,
          ACTOR_A_ID
        );
        throw new Error('SIMULATED_BRIDGE_FAILURE');
      });
    } catch (err: any) {
      if (err.message === 'SIMULATED_BRIDGE_FAILURE') {
        bridgeRollbackCaught = true;
      }
    }

    assert(bridgeRollbackCaught, 'Simulated bridge error caught');
    const bridgeWfCheck = await migrationPool.query(
      `SELECT count(*) FROM workflow_instances WHERE entity_id = '${rollbackEntity2Id}';`
    );
    assert(bridgeWfCheck.rows[0].count === '0', 'WorkflowInstance rolled back cleanly on bridge error');

    // ----------------------------------------------------
    // Test 12: Tenant isolation
    // ----------------------------------------------------
    console.log('\n[12] Testing tenant isolation in bridge...');
    const tenantBQuery = await runInTenantContext(ACTOR_B_ID, TENANT_B_ID, async (tx) => {
      return await repository.findManyTx(tx, TENANT_B_ID);
    });
    assert(
      !tenantBQuery.some((e) => e.entityId === entity3Id || e.entityId === entity5Id),
      'Tenant B cannot observe exceptions generated in Tenant A by validation bridge'
    );

  } catch (err) {
    console.error('Test runner fatal error:', err);
  } finally {
    await cleanupFixtures();
    await migrationPool.end();
  }

  console.log('\n=====================================================');
  console.log(` SUMMARY: ${passCount} / ${testCount} TESTS PASSED `);
  console.log('=====================================================');

  if (passCount !== testCount) {
    process.exit(1);
  }
}

runExceptionRepositoryTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
