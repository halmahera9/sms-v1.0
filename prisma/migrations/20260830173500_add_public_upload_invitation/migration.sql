-- =============================================================================
-- BANYUBIRU PLATFORM - PUBLIC UPLOAD INVITATION MIGRATION (PHASE 5A)
-- Target RDBMS: PostgreSQL 17
-- =============================================================================

-- 1. Create Enum Type
CREATE TYPE "PublicUploadInvitationStatus" AS ENUM ('PENDING', 'REVOKED', 'EXPIRED', 'SUBMITTED');

-- 2. Create Table
CREATE TABLE "public_upload_invitations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "recipient_email" VARCHAR(255) NOT NULL,
    "recipient_name" VARCHAR(255),
    "document_category" "DocumentCategory" NOT NULL,
    "target_entity_type" VARCHAR(50) NOT NULL,
    "target_entity_id" UUID NOT NULL,
    "status" "PublicUploadInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "document_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "max_upload_attempts" INTEGER NOT NULL DEFAULT 3,
    "upload_attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "public_upload_invitations_pkey" PRIMARY KEY ("id")
);

-- 3. Unique & Performance Indexes
CREATE UNIQUE INDEX "public_upload_invitations_token_hash_key" ON "public_upload_invitations"("token_hash");
CREATE UNIQUE INDEX "public_upload_invitations_tenant_id_id_key" ON "public_upload_invitations"("tenant_id", "id");
CREATE INDEX "public_upload_invitations_tenant_id_status_idx" ON "public_upload_invitations"("tenant_id", "status");
CREATE INDEX "public_upload_invitations_tenant_id_target_entity_type_targe_idx" ON "public_upload_invitations"("tenant_id", "target_entity_type", "target_entity_id");
CREATE INDEX "public_upload_invitations_token_hash_idx" ON "public_upload_invitations"("token_hash");

-- 4. Foreign Key Constraints (with Tenant Isolation)
ALTER TABLE "public_upload_invitations" ADD CONSTRAINT "public_upload_invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public_upload_invitations" ADD CONSTRAINT "public_upload_invitations_tenant_id_created_by_user_id_fkey" FOREIGN KEY ("tenant_id", "created_by_user_id") REFERENCES "user_actors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public_upload_invitations" ADD CONSTRAINT "public_upload_invitations_tenant_id_document_id_fkey" FOREIGN KEY ("tenant_id", "document_id") REFERENCES "documents"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Row-Level Security (RLS) Policy
ALTER TABLE "public_upload_invitations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_upload_invitations_app_isolation" ON "public_upload_invitations" FOR ALL TO banyubiru_app USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "public_upload_invitations_admin_access" ON "public_upload_invitations" FOR ALL TO banyubiru_admin_app USING (true) WITH CHECK (true);

-- 6. Role Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public_upload_invitations" TO banyubiru_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public_upload_invitations" TO banyubiru_admin_app;
GRANT SELECT ON TABLE "public_upload_invitations" TO banyubiru_readonly;
