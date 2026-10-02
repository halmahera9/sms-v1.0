-- Migration: add_workflow_persistence_fields
-- Adds optimistic concurrency (version) and transition persistence (event, idempotency, correlation).
-- P0-K.3: Workflow Persistence Contract.

-- Step 1: Add version field to workflow_instances for optimistic concurrency
ALTER TABLE "workflow_instances" ADD COLUMN IF NOT EXISTS "version" INT DEFAULT 0;

-- Step 2: Add new transition fields to workflow_transitions
ALTER TABLE "workflow_transitions" ADD COLUMN IF NOT EXISTS "event" VARCHAR(50);
ALTER TABLE "workflow_transitions" ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(255);
ALTER TABLE "workflow_transitions" ADD COLUMN IF NOT EXISTS "correlation_id" VARCHAR(255);

-- Step 3: Backfill idempotency_key for existing transitions
-- Strategy: deterministic SHA256 hash of (workflowInstanceId | fromState | toState | createdAt)
-- This ensures uniqueness per transition and is reproducible.
UPDATE "workflow_transitions"
SET "idempotency_key" = encode(
  digest(
    "workflow_instance_id"::text || '|' || "from_state"::text || '|' || "to_state"::text || '|' || "created_at"::text,
    'sha256'
  ),
  'hex'
)
WHERE "idempotency_key" IS NULL;

-- Step 4: Make idempotency_key NOT NULL after backfill
ALTER TABLE "workflow_transitions" ALTER COLUMN "idempotency_key" SET NOT NULL;

-- Step 5: Add unique constraint for replay protection
-- Database-level guarantee: same (tenantId, workflowInstanceId, idempotencyKey) can only exist once
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'workflow_transitions_tenant_id_workflow_instance_id_idempotency_key_key'
  ) THEN
    ALTER TABLE "workflow_transitions"
      ADD CONSTRAINT "workflow_transitions_tenant_id_workflow_instance_id_idempotency_key_key"
      UNIQUE ("tenant_id", "workflow_instance_id", "idempotency_key");
  END IF;
END $$;
