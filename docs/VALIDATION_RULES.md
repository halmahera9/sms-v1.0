# Validation & Policy Engine Specification

## 1. Core Principles
- **Decoupled Business Rules**: Validation rules are declared as static/configurable policy sets, separate from UI components.
- **Rule Resolution Engine**: Given an entity (e.g. Employee Proposal or Student Absence), the validation engine evaluates all registered rules for that domain.

## 2. Policy Rule Registry Example

### Employee Award Domain Rules (SE BKD 22/SE/2026)
- `RULE_MK_REQ_DOCS`: All 6 mandatory documents must be present and verified for `MASA_KERJA` proposals.
- `RULE_SL_REQ_DOCS`: All 6 mandatory documents must be present and verified for `SATYALANCANA` proposals.
- `RULE_NO_HUKDIS`: Surat Keterangan Bebas Hukdis must be verified as valid.

### Student Administration Domain Rules
- `RULE_NISN_FORMAT`: NISN must be a 10-digit numerical string.
- `RULE_OCR_CONFIDENCE_THRESHOLD`: OCR extraction confidence must be >= 70%; below this threshold, the item is queued in the Exception Queue.
