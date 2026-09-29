-- Migration: remove_award_proposal_domain
-- Removes all award proposal domain tables and enums.

-- 1. Drop award_proposal_documents (child of award_proposals and documents)
DROP TABLE IF EXISTS "award_proposal_documents";

-- 2. Drop award_proposals (parent, child of employees and tenants)
DROP TABLE IF EXISTS "award_proposals";

-- 3. Drop enums exclusively used by award domain
DROP TYPE IF EXISTS "AwardType";
DROP TYPE IF EXISTS "ProposalStatus";
DROP TYPE IF EXISTS "ChecklistStatus";
