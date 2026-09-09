-- =============================================================================
-- BANYUBIRU - CANONICAL ENUM RECONCILIATION
-- Reconcile PostgreSQL enum types with prisma/schema.prisma.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. StudentAbsenceWorkflowState
-- ---------------------------------------------------------------------------
-- No table column currently depends on this enum. Workflow state columns
-- remain VARCHAR by design. Recreate the enum type only.

ALTER TYPE "StudentAbsenceWorkflowState"
  RENAME TO "StudentAbsenceWorkflowState_old";

CREATE TYPE "StudentAbsenceWorkflowState" AS ENUM (
  'DRAFT',
  'NEEDS_VERIFICATION',
  'REQUIRES_CORRECTION',
  'VERIFIED',
  'COMPLETED'
);

DROP TYPE "StudentAbsenceWorkflowState_old";


-- ---------------------------------------------------------------------------
-- 2. VerificationStatus
-- ---------------------------------------------------------------------------
-- No table column currently depends on this enum. Recreate the enum type.

ALTER TYPE "VerificationStatus"
  RENAME TO "VerificationStatus_old";

CREATE TYPE "VerificationStatus" AS ENUM (
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'NEEDS_CORRECTION'
);

DROP TYPE "VerificationStatus_old";


-- ---------------------------------------------------------------------------
-- 3. StudentStatus
-- ---------------------------------------------------------------------------
-- Preserve existing students.status values and ACTIVE default.

CREATE TYPE "StudentStatus_new" AS ENUM (
  'ACTIVE',
  'GRADUATED',
  'TRANSFERRED'
);

ALTER TABLE "students"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "students"
  ALTER COLUMN "status" TYPE "StudentStatus_new"
  USING ("status"::text::"StudentStatus_new");

ALTER TYPE "StudentStatus"
  RENAME TO "StudentStatus_old";

ALTER TYPE "StudentStatus_new"
  RENAME TO "StudentStatus";

DROP TYPE "StudentStatus_old";

ALTER TABLE "students"
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE';


-- ---------------------------------------------------------------------------
-- 4. TenantStatus
-- ---------------------------------------------------------------------------
-- Preserve existing tenants.status values and ACTIVE default.

CREATE TYPE "TenantStatus_new" AS ENUM (
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED'
);

ALTER TABLE "tenants"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "tenants"
  ALTER COLUMN "status" TYPE "TenantStatus_new"
  USING ("status"::text::"TenantStatus_new");

ALTER TYPE "TenantStatus"
  RENAME TO "TenantStatus_old";

ALTER TYPE "TenantStatus_new"
  RENAME TO "TenantStatus";

DROP TYPE "TenantStatus_old";

ALTER TABLE "tenants"
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE';


-- ---------------------------------------------------------------------------
-- 5. UserStatus
-- ---------------------------------------------------------------------------
-- Preserve existing user_actors.status values and ACTIVE default.

CREATE TYPE "UserStatus_new" AS ENUM (
  'ACTIVE',
  'INACTIVE'
);

ALTER TABLE "user_actors"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "user_actors"
  ALTER COLUMN "status" TYPE "UserStatus_new"
  USING ("status"::text::"UserStatus_new");

ALTER TYPE "UserStatus"
  RENAME TO "UserStatus_old";

ALTER TYPE "UserStatus_new"
  RENAME TO "UserStatus";

DROP TYPE "UserStatus_old";

ALTER TABLE "user_actors"
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE';


-- ---------------------------------------------------------------------------
-- 6. UserRole
-- ---------------------------------------------------------------------------
-- Existing values are already canonical. Add only missing Prisma values.

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PEGAWAI';

COMMIT;
