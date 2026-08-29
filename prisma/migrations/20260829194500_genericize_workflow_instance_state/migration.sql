-- AlterTable: workflow_instances
ALTER TABLE "workflow_instances" 
  ALTER COLUMN "current_state" TYPE VARCHAR(50) USING "current_state"::text;

-- AlterTable: workflow_transitions
ALTER TABLE "workflow_transitions" 
  ALTER COLUMN "from_state" TYPE VARCHAR(50) USING "from_state"::text,
  ALTER COLUMN "to_state" TYPE VARCHAR(50) USING "to_state"::text;
