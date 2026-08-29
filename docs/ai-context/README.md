# Banyubiru AI Context Package

## What is Banyubiru?

**Banyubiru** is a multi-tenant Indonesian government administrative intelligence platform built with Next.js 16 / React 19. It automates two primary administrative workflows:

1. **Employee Award Processing** (`employee/awards` domain) — PNS/PPPK award nominations under SE BKD 22/SE/2026 (completeness check, multi-stage approval, PDF generation readiness).
2. **Student Absence Document Processing** (`student` domain) — OCR-extracted absence records, identity resolution against student registry, human verification, and record persistence.

Shared platform infrastructure: PostgreSQL RLS multi-tenancy, Server Action boundary, generic workflow engine, validation/exceptions/audit, and operational dashboard.

---

## Snapshot Context & Reading Guide

This context package reflects a **working snapshot** taken while the working tree contained pre-existing uncommitted work.

### 1. Committed Baseline
- **HEAD Commit:** `1a8222da584d27913ec0d5522c9e3e6a9b3cee29`
- **Branch:** `main`

### 2. Working Snapshot (Uncommitted)
- **Modified (unstaged):** `src/platform/types/index.ts` (re-export of document intelligence contracts)
- **Untracked:** `src/platform/types/document-intelligence.ts` (orchestration type definitions)
- **Untracked Docs:** `docs/ai-context/`

All statements in this package distinguish between:
- **[COMMITTED]**: Verified against committed HEAD source.
- **[SNAPSHOT]**: Present in local working tree / untracked types.
- **[INFERRED]**: Derived from patterns or partial evidence.

### Recommended Reading Order

| # | File | Purpose |
|---|------|---------|
| 1 | `CURRENT_STATE.md` | Baseline vs. snapshot state, verified facts, inferences |
| 2 | `ARCHITECTURE.md` | Layering, dependency direction, security boundaries |
| 3 | `DOMAIN_MAP.md` | Domain entities, services, repositories, API boundaries |
| 4 | `DATA_FLOW.md` | Core execution pipelines with stage statuses |
| 5 | `DOCUMENT_INTELLIGENCE.md` | Stage-by-stage document pipeline audit |
| 6 | `DECISIONS_AND_CONTRACTS.md` | Established architectural contracts |
| 7 | `KNOWN_GAPS.md` | Confirmed gaps, risks, and unknowns |
| 8 | `NEXT_TASK.md` | Next immediate investigation task |
| 9 | `AI_REVIEW_PROMPT.md` | Reusable audit prompt for independent agents |
