# ARCHITECTURE

## Overview

Banyubiru is a **Next.js 16 / React 19 full-stack application** with a layered architecture enforcing a strict server/client boundary. Database access, transaction boundaries, and authorization checks execute exclusively server-side.

---

## Layered Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  CLIENT BOUNDARY                                                 │
│  src/app/**           Next.js App Router pages                   │
│  src/components/**    Shared UI components                       │
│  src/platform/ui/**   Platform UI (Dashboard, Exceptions, Audit) │
├──────────────────────────────────────────────────────────────────┤
│  SERVER ACTION BOUNDARY  ('use server')                          │
│  src/platform/actions/   Platform actions (audit, exception,     │
│                          operational, student, student-workflow) │
│  src/domains/employee/awards/actions.ts  Award proposal actions  │
├──────────────────────────────────────────────────────────────────┤
│  APPLICATION SERVICE LAYER                                       │
│  src/domains/employee/awards/service.ts                          │
│    AwardProposalApplicationService                               │
│    - Orchestrates workflow engine, proposal repo, audit repo     │
├──────────────────────────────────────────────────────────────────┤
│  PLATFORM INFRASTRUCTURE & REPOSITORIES                          │
│  src/platform/                                                   │
│    auth/          Session resolution, RBAC policy guards         │
│    db/            Prisma client, runInTenantContext()            │
│    workflow/      PlatformWorkflowEngine (generic FSM)           │
│    rules/         PlatformValidationEngine (rule registry)       │
│    repositories/  Postgres repos (audit, award, exception, etc.) │
├──────────────────────────────────────────────────────────────────┤
│  DATABASE LAYER                                                  │
│  PostgreSQL + Prisma ORM (RLS via set_tenant_context)            │
└──────────────────────────────────────────────────────────────────┘
```

---

## Dependency Direction & Boundaries

```
Client Components → Server Actions ('use server') → Services / Repositories → Platform DB (RLS)
```

1. **Server / Client Boundary:**
   - Server-side only: Prisma client, `TenantTransactionClient`, `AuthenticatedActorContext`, `runInTenantContext()`.
   - Client receives only: Serialized plain JSON (`JSON.parse(JSON.stringify(...))`) wrapped in `ActionResponse<T>`.

2. **Domain Boundaries:**
   - `src/domains/employee/awards/`: Owns types, workflow definitions, validation rules, service, and actions.
   - `src/domains/student/`: Owns domain types and workflow definitions; actions currently reside in `src/platform/actions/`.
   - `src/platform/`: Provides shared cross-cutting mechanisms (auth, tenant context, generic FSM, audit persistence).

3. **Domain Coupling in Platform Layer:**
   - *Note on architectural purity:* Platform repositories are not entirely domain-agnostic. For example, `src/platform/repositories/exception.ts` hardcodes `EMPLOYEE_ENTITY_TYPES`, `STUDENT_ENTITY_TYPES`, and `RULE_MESSAGE_CATALOG` to support domain classification and messaging.

---

## Multi-Tenancy Security Contract

Every database transaction MUST be wrapped in `runInTenantContext`:

```typescript
// src/platform/db/tenant-context.ts
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT set_tenant_context(${actorId}::uuid, ${tenantId}::uuid);`;
  return await queryBlock(tx);
});
```

- PostgreSQL GUCs (`app.current_tenant_id`, `app.current_actor_id`) enforce Row-Level Security (RLS).
- All queries inside a transaction callback MUST execute against `tx` (never the global `prisma` singleton).

---

## Architectural Inconsistencies & Gaps

For verified implementation gaps and architectural risks (such as RBAC policy fragmentation, `ActionResponse` duplication, and `WorkflowInstance` lifecycle issues), see [KNOWN_GAPS.md](file:///d:/banyubiru-next/docs/ai-context/KNOWN_GAPS.md).
