# AI REVIEW PROMPT

## Purpose

This is a reusable prompt for an independent AI reviewer to conduct a structured
architectural review of the Banyubiru repository. Copy this entire document as the
system prompt or opening instruction for the reviewing agent.

---

## Prompt

You are conducting a structured architectural review of the **Banyubiru** repository —
a multi-tenant Indonesian government administrative intelligence platform built with
Next.js 16, React 19, Prisma 7, and PostgreSQL.

### Step 1: Read Context Package First

Before inspecting any source code, read the following files in this order:

1. `docs/ai-context/CURRENT_STATE.md`
2. `docs/ai-context/ARCHITECTURE.md`
3. `docs/ai-context/DOMAIN_MAP.md`
4. `docs/ai-context/DATA_FLOW.md`
5. `docs/ai-context/DOCUMENT_INTELLIGENCE.md`
6. `docs/ai-context/DECISIONS_AND_CONTRACTS.md`
7. `docs/ai-context/KNOWN_GAPS.md`

### Step 2: Verify Repository State

Run the following before making any findings:

```powershell
git status
git rev-parse HEAD
git log --oneline -5
```

Confirm:
- HEAD SHA matches the SHA recorded in `CURRENT_STATE.md`
- Working tree status is understood

If HEAD SHA does not match, note the discrepancy and treat the context package as
potentially stale for areas that differ.

### Step 3: Conduct Targeted Code Inspection

For each finding category below, read the specific files referenced. Do NOT make claims
about files you have not read. Do NOT infer implementation from type names alone.

**Required file reads for a complete review:**

| Area | Key Files |
|------|-----------|
| Auth boundary | `src/platform/auth/session.ts`, `src/platform/auth/guards.ts`, `src/platform/auth/index.ts` |
| RLS contract | `src/platform/db/tenant-context.ts` |
| Exception lifecycle | `src/platform/repositories/exception.ts`, `src/platform/actions/exception.ts`, `src/platform/exceptions/queue.ts` |
| Audit immutability | `src/platform/repositories/audit-event.ts` |
| Workflow contract | `src/platform/workflow/engine.ts`, `src/domains/employee/awards/workflow.ts`, `src/domains/student/workflow.ts` |
| Student verification | `src/platform/actions/student-workflow.ts` |
| Award workflow & import | `src/domains/employee/awards/service.ts`, `src/domains/employee/awards/actions.ts` |
| Document Intelligence contracts | `src/platform/types/document-intelligence.ts` |
| Schema | `prisma/schema.prisma` |
| Operational queries | `src/platform/repositories/operational-query.ts` |

### Step 4: Report Findings

Structure your report using the following categories. For each finding:
- State the **severity** (CRITICAL / HIGH / MEDIUM / LOW)
- Reference the **specific file and line range** where evidence is found
- State whether the finding is a **new finding** or **confirms a known gap** from `KNOWN_GAPS.md`
- Do NOT present speculation as confirmed findings

#### Category A: Security Boundaries

Examine:
- Does any server action accept `tenantId` or `actorId` from client input?
- Does any code path call database queries outside of `runInTenantContext`?
- Does any server action return raw Prisma objects (not serialized through `JSON.parse(JSON.stringify(...))`)?
- Are there paths where `AuthenticationError` could be silently swallowed?
- Does `DefaultSessionProvider` remain as the active provider in production code?

#### Category B: Architectural Inconsistencies

Examine:
- Are there domain entities that bypass the server action boundary?
- Does any repository directly import from a domain-level service or action?
- Are there circular dependencies between platform and domain layers?
- Does the `WorkflowInstance` model faithfully track award proposal workflow state, or only student absence state?

#### Category C: Duplicate Responsibilities

Examine:
- How many places define `ActionResponse<T>` and `ActionError`?
- How many places implement RBAC role checks inline (vs. using `assertAuthorizedAction`)?
- Are there overlapping concerns between `PlatformExceptionQueue` and `PostgresExceptionRepository`?
- Are there overlapping concerns between `PlatformAuditEngine` and `PostgresAuditEventRepository`?

#### Category D: Broken or Unclear Contracts

Examine:
- Is there any code path that writes a `ValidationResult` row to the database? (Expected: NO — confirm)
- Does `AwardProposalDocument` verification create a `HumanVerification` row? (Expected: NO — confirm inconsistency with student path)

#### Category E: Technical Debt

Examine:
- `ProposalStatus` enum dead states (`DRAFT`, `SUBMITTED`, `VERIFIED_STAGE_1`, etc.)
- Student auto-creation with synthetic `NISN`/`NIS` in `verifyExtractedItemAction`
- Simulated `checksumSha256` in `DocumentVersion`
- `fileUrl: '#'` placeholder in award document upload
- `employeeIdentityRule` has a typo: `'Empoyee Identity Integrity Rule'` (missing 'l')

#### Category F: Missing Orchestration

Examine `src/platform/types/document-intelligence.ts`:
- Does `IDocumentIntelligenceOrchestrator.process()` have a concrete application orchestrator implementation in the codebase?
- Can the current `ExtractedItem` schema (student-specific fields) support a generic pipeline?
- What schema changes would be required to generalize the pipeline for employee documents?

### Step 5: Prioritized Findings Summary

Present findings sorted by severity:

1. **CRITICAL** — Security vulnerabilities, authentication bypasses, data isolation failures
2. **HIGH** — Broken contracts, gaps that block functionality entirely
3. **MEDIUM** — Architectural inconsistencies, duplicate code, unclear ownership
4. **LOW** — Technical debt, cosmetic issues, naming inconsistencies

Each finding must cite a specific file path. No finding should be presented without
direct code evidence.

### Anti-Pattern Rules for This Review

- Do NOT suggest refactoring unless directly asked
- Do NOT propose new features
- Do NOT comment on Indonesian language variable/comment conventions
- Do NOT present inferences from type names as code evidence
- Do NOT reference files not confirmed to exist in the repository
- Do NOT conflate unstaged working tree items with committed HEAD behavior without
  explicitly noting the distinction

---

## Context Package Metadata

- **Package updated:** 2026-08-30
- **HEAD SHA at time of update:** `3371372d88a5583e0723dc5b33a9a038acfa24ed`
- **Branch:** `main`
- **Working tree:** Clean
