# Role-Based Access Control (RBAC) Specification

## 1. Role Taxonomy
The Banyubiru Administrative Intelligence platform defines four primary system roles across all domains:

| Role | Access Level | Description |
|---|---|---|
| **ADMIN** | System Administrator | Full access to platform settings, signatory rules, user management, and data imports. |
| **VERIFIER** | Administrative Verifier | Can inspect document queues, perform verification/rejection, resolve exceptions, and approve proposals. |
| **OPERATOR** | Operational Staff | Can upload raw documents, run OCR parsing, initiate proposals, and view dashboard statuses. |
| **VIEWER / PEGAWAI** | Read-Only / Self-Service | Can view individual status, upload candidate self-service documents, and view audit history. |

## 2. Permission Matrix

| Capability / Action | ADMIN | VERIFIER | OPERATOR | VIEWER |
|---|:---:|:---:|:---:|:---:|
| `view_dashboard` | ✓ | ✓ | ✓ | ✓ |
| `import_excel_data` | ✓ | ✗ | ✓ | ✗ |
| `upload_document` | ✓ | ✓ | ✓ | ✓ (Self) |
| `verify_document` | ✓ | ✓ | ✗ | ✗ |
| `approve_proposal` | ✓ | ✓ | ✗ | ✗ |
| `generate_pdf` | ✓ | ✓ | ✓ | ✗ |
| `manage_settings` | ✓ | ✗ | ✗ | ✗ |
| `view_audit_trail` | ✓ | ✓ | ✗ | ✗ |
