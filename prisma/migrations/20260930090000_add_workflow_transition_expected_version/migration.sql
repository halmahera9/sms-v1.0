-- Persist the exact workflow version supplied by each transition request.
-- No historical expectedVersion can be derived safely. Adding NOT NULL
-- without a default intentionally fails if rows exist.
ALTER TABLE "workflow_transitions"
  ADD COLUMN "expected_version" INTEGER NOT NULL;