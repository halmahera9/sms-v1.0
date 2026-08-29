# Banyubiru AI Context Package

## What is Banyubiru?

**Banyubiru** is a multi-tenant Indonesian government administrative intelligence platform built with Next.js 16 / React 19. It automates two primary administrative workflows:

1. **Employee Award Processing** (`employee/awards` domain) — PNS/PPPK award nominations under SE BKD 22/SE/2026 (completeness check, multi-stage approval, PDF generation readiness, signing, sending, archiving).
2. **Student Absence Document Processing** (`student` domain) — OCR-extracted absence records, identity resolution against student registry, human verification, validation exception bridge, and record persistence.

Shared platform infrastructure: PostgreSQL RLS multi-tenancy, Server Action boundary, generic workflow engine, validation/exceptions/audit, and operational dashboard.

---

## Baseline State & Reading Guide

This context package reflects the synchronized `main` branch.

### 1. Committed Baseline
- **HEAD Commit:** `9b4aaf9f8d8ee6fa9beaa3d567c9c0dc11ea9eb2`
- **Branch:** `main`

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
| 8 | `NEXT_TASK.md` | Recommended next tasks and roadmap tracks |
| 9 | `AI_REVIEW_PROMPT.md` | Reusable audit prompt for independent agents |
