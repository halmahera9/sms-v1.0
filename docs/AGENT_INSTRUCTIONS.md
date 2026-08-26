# Engineering Agent Guidelines & Instructions

## 1. Architectural Guardrails
When maintaining or extending the Banyubiru Administrative Intelligence codebase, engineering agents MUST strictly adhere to the following safety rules:

1. **Domain Isolation**: Core infrastructure services (`workflow`, `validation`, `rbac`, `audit`, `document_generation`) MUST remain domain-agnostic.
2. **No Hardcoded Business Rules in UI**: Never embed domain-specific validation logic or regulatory requirements directly inside generic UI components.
3. **No Unnecessary Dependencies**: Do not introduce heavy ORMs or state managers without architectural justification.
4. **Preserve Existing Working Architecture**: Never delete or rewrite existing functional modules without empirical evidence and user approval.
5. **Hydration Mismatch Prevention**: All client-only state initialization (e.g. `localStorage`, `Date.now()`, random ID generation) MUST be properly guarded with `useEffect` or server hydration guards (`isClient` state pattern).
6. **Immutable Audit Logs**: Every administrative state change or document verification MUST emit an auditable event record.
7. **Human-in-the-Loop Safeguard**: Automated pipelines (OCR, Excel parsing) extract and validate data, but MUST NOT automatically approve final administrative outcomes without human verification.
