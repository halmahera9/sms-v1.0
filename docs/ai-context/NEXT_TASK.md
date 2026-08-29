# NEXT TASK

## Task: WorkflowInstance Lifecycle & ExceptionItem Dependency Audit

### Context & Rationale

Before implementing automated exception creation (`createTx` on `PostgresExceptionRepository`), a critical schema dependency must be resolved:

- `ExceptionItem` in Prisma requires a non-nullable `workflowInstanceId` foreign key to `WorkflowInstance`.
- Currently, **no application code creates `WorkflowInstance` rows** (GAP-00 in [KNOWN_GAPS.md](file:///d:/banyubiru-next/docs/ai-context/KNOWN_GAPS.md)).
- If an exception creation path is added without a corresponding `WorkflowInstance` lifecycle or seeding mechanism, any insert will fail foreign key referential integrity at runtime.

Therefore, the immediate next engineering task is an **audit and architectural resolution** of how `WorkflowInstance` rows should be instantiated and linked to domain entities.

---

## Investigation Scope & Questions

1. **Entity-to-Workflow Linkage:**
   - In `schema.prisma`, what fields exist on `WorkflowInstance`? (`entityType`, `entityId`, `currentState`, `tenantId`, etc.)
   - Does `WorkflowInstance` need to be created when an `AwardProposal` is submitted or when an `OCRExtraction` / `Document` is uploaded?
2. **Repository Contract Definition:**
   - Should a `IWorkflowInstanceRepository` / `PostgresWorkflowInstanceRepository` be created with `createTx` and `transitionTx`?
   - Or should `WorkflowInstance` creation be integrated into the domain workflow transitions inside `PlatformWorkflowEngine`?
3. **Exception Creation Interface:**
   - Define `createTx` on `PostgresExceptionRepository` such that it accepts a valid `workflowInstanceId` or optionally resolves/creates one for the entity.

---

## Verification & Guardrails

- **Read-only investigation:** Do not alter `prisma/schema.prisma` or existing migrations until a clear workflow instance lifecycle design is approved.
- **Scope limitation:** Keep working tree clean. Do not commit unstaged type definitions or documentation files during the audit phase.
