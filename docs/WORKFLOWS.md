# Core Workflow Engine & State Machine Specification

## 1. Domain-Agnostic Workflow Pipeline Architecture
Every administrative proposal or record follows a predictable, auditable state machine:

```
[NOMINATIF / DRAFT]
       │
       ▼
[BELUM_UPLOAD] ──(Upload Document)──► [SEBAGIAN] ──(Complete All Docs)──► [LENGKAP]
                                                                             │
                                                                             ▼
[REJECTED / EXCEPTION] ◄────────(Verification Failed)──────────────── [DIVERIFIKASI]
                                                                             │
                                                               (Verified 100%)
                                                                             ▼
[SELESAI] ◄──(Archive)── [DIKIRIM] ◄──(Sign)── [DITANDATANGANI] ◄── [SIAP_GENERATE / GENERATED]
```

## 2. State Transition Audit Rules
1. **Rule 1 (Immutability)**: No state transition may bypass mandatory verification rules.
2. **Rule 2 (Audit Log Trigger)**: Every transition generates an `AuditEvent` with actor ID, timestamp, prior state, and target state.
3. **Rule 3 (Human Verification Required)**: Transitions into `SIAP_GENERATE` or `APPROVED` require explicit verification by an authorized `VERIFIER` or `ADMIN`.
