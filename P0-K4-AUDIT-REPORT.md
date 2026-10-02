# P0-K.4 — Audit Report: Transition Service & Repository Boundary

**Date:** 2026-09-29  
**Baseline:** P0-K.3 commit `b14beb4` (schema + migration)  
**Status:** AUDIT COMPLETE — Ready for CONTRACT phase

---

## 1. Repository Layer Patterns

### No Existing WorkflowInstance/WorkflowTransition Repository
- ✅ Safe to create new repository without conflicts
- ✅ No overlapping implementations

### Existing Pattern: BasePostgresRepository
Location: [postgres-base.ts](file:///C:/Users/USER/Documents/sms-v1.0/src/platform/repositories/postgres-base.ts)

```typescript
abstract class BasePostgresRepository<T extends { id: string; tenantId: string }>
  implements ITenantRepository<T, string>
```

**Pattern:**
- `InContext(actorId, tenantId, entity)` — wraps transaction
- `Tx(tx: TenantTransactionClient, tenantId, entity)` — operates within transaction
- `assertTenantConsistency(entity, activeTenantId)` — validates tenant isolation

**Implication for P0-K.4:**
- Workflow repository should NOT extend BasePostgresRepository (WorkflowInstance is not generic entity)
- Instead, create `PostgresWorkflowRepository` with custom transaction boundary

---

## 2. Transaction Context Pattern

### runInTenantContext Pattern
Location: [tenant-context.ts](file:///C:/Users/USER/Documents/sms-v1.0/src/platform/db/tenant-context.ts)

```typescript
export async function runInTenantContext<T>(
  actorId: string,
  tenantId: string,
  queryBlock: (tx: TenantTransactionClient) => Promise<T>
): Promise<T>
```

**Contract:**
- Sets PostgreSQL GUCs: `app.current_tenant_id`, `app.current_actor_id`
- Runs queryBlock within interactive transaction
- Timeout: 300s max
- Fail-closed on auth error

**Implication for P0-K.4:**
- Use existing `runInTenantContext` wrapper (do not create new context mechanism)
- Pass `TenantTransactionClient` to all Tx methods
- Can stack transactions (nested calls reuse context)

---

## 3. Audit Pattern

### PostgresAuditEventRepository.recordTx
Location: [audit-event.ts](file:///C:/Users/USER/Documents/sms-v1.0/src/platform/repositories/audit-event.ts#L55-L116)

```typescript
public async recordTx(
  tx: TenantTransactionClient,
  tenantId: string,
  event: AuditEventInput
): Promise<AuditEventRecord>
```

**Pattern (from ExceptionRepository usage):**
1. Data mutation within tx (update/create)
2. Call `auditRepo.recordTx(tx, tenantId, { action, entityType, entityId, metadata, actorUserId })`
3. Both mutations happen in same transaction
4. If audit fails, entire transaction rolls back

**Implication for P0-K.4:**
- Use same `recordTx` approach for workflow transitions
- Audit MUST be atomic with transition persistence
- Do not call audit after transaction commits

---

## 4. WorkflowInstance Consumer: ExceptionRepository

Location: [exception.ts](file:///C:/Users/USER/Documents/sms-v1.0/src/platform/repositories/exception.ts#L329-L351)

**Current usage:**
```typescript
let workflowInstance = await tx.workflowInstance.findFirst({
  where: { tenantId, entityType: params.entityType, entityId: params.entityId }
});
if (!workflowInstance) {
  workflowInstance = await tx.workflowInstance.create({
    data: {
      id: crypto.randomUUID(),
      tenantId,
      entityType: params.entityType,
      entityId: params.entityId,
      currentState: initialWorkflowState,
    }
  });
}
```

**Pattern:**
- Idempotent findFirst + create
- Uses `(tenantId, entityType, entityId)` unique key
- Initializes `currentState` on creation
- No version field (pre-P0-K.3 schema; won't break after P0-K.3 adds default 0)

**Implication for P0-K.4:**
- Document workflow: `entityType = "DOCUMENT_VERSION"`, `entityId = documentVersionId`
- Existing ExceptionRepository will continue working (version field defaults to 0)
- P0-K.4 transition service must respect existing instance identity constraint

---

## 5. Tenant Isolation

### RLS Policies
From initial schema audit:
```sql
CREATE POLICY "workflow_instances_app_isolation" ON "workflow_instances"
  FOR ALL TO banyubiru_app
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
```

**Pattern:**
- Tenant context GUCs enforced at row level
- Every query scoped to current tenant automatically
- Cannot accidentally query cross-tenant data

**Implication for P0-K.4:**
- No explicit tenant filter needed (RLS handles it)
- `runInTenantContext` must always be used (to set GUCs)
- Tenant ID is included in all unique constraints for safety

---

## 6. Uniqueness Constraints

### WorkflowInstance
```sql
@@unique([tenantId, id])
@@unique([tenantId, entityType, entityId])
```

### WorkflowTransition (after P0-K.3)
```sql
@@unique([tenantId, id])
@@unique([tenantId, workflowInstanceId, idempotencyKey])
```

**Implication for P0-K.4:**
- Idempotency key must be unique per (tenant, instance, key) — enforced at DB
- Replay with same key will constraint-violate on INSERT attempt
- Recovery: catch unique violation, reload persisted transition

---

## 7. Known Gaps for P0-K.4

| Gap | Impact | Mitigation |
|---|---|---|
| `event` field is nullable | Allow-list cannot be enforced at schema | Contract must validate; runtime allow-list in P0-K.5 |
| No event enum | free-form strings | Use string literals; matrix defines canonical values |
| Existing WorkflowInstance instances have no version=0 after migration | Initial CAS might check version 0 on old instances | Migration backfill ensures version 0; be safe with version checks |
| correlationId is nullable | Optional correlation tracking | Accept as-is; not required for idempotensi |

---

## 8. Design Decisions for P0-K.4

### ✅ Do Create
- `PostgresWorkflowRepository` with explicit transaction contract
- Transition service `transitionDocumentWorkflow()` with CAS, idempotency, audit atomicity
- Types: `DocumentWorkflowTransitionInput`, `DocumentWorkflowTransitionResult`

### ❌ Do Not Create
- New workflow engine (use generic PlatformWorkflowEngine for validation only)
- New audit repository (reuse existing PostgresAuditEventRepository)
- Event allow-list (defer to P0-K.5)
- New transaction context (reuse runInTenantContext)

### ⚠️ Known Schema Issue
- `event` NOT NULL should be enforced but is nullable after P0-K.3 migration
- **Action:** P0-K.4 tests should validate event is non-empty string
- **Future:** Add migration to make event NOT NULL after P0-K.5 populates values

---

## 9. Ready for CONTRACT Phase

**Audit findings:**
- ✅ No repository conflicts
- ✅ Pattern consistency verified
- ✅ Tenant isolation confirmed
- ✅ Audit pattern understood
- ✅ ExceptionRepository compatibility confirmed
- ✅ Document workflow identity reserved ("DOCUMENT_VERSION")
- ⚠️ Event field nullable — schema gap but workable

**Next Phase:** Define `transitionDocumentWorkflow()` contract and types.
