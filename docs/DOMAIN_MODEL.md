# Domain Model Specification: Banyubiru Platform

## 1. Core Platform Entities (Domain-Agnostic)

### User & Authentication
- `User`: `id`, `email`, `name`, `roleId`, `organizationId`, `status`, `createdAt`
- `Role`: `id`, `code` (`ADMIN`, `VERIFIER`, `OPERATOR`, `VIEWER`), `name`, `permissions`
- `Organization`: `id`, `name`, `code`, `type` (`GOVERNMENT`, `SCHOOL_DISTRICT`, `SCHOOL`), `settings`

### Core Processing Entities
- `AdministrativeEntity`: Generic interface for domain records subject to administrative workflow.
- `WorkflowInstance`: `id`, `domainType`, `entityId`, `currentState`, `assignedRoleId`, `history`
- `ValidationResult`: `id`, `entityId`, `ruleCode`, `status` (`PASSED`, `FAILED`, `WARNING`), `message`
- `ExceptionItem`: `id`, `entityId`, `exceptionType`, `severity`, `description`, `resolutionStatus`
- `DocumentArtifact`: `id`, `entityId`, `requirementCode`, `fileUrl`, `mimeType`, `verificationStatus`
- `AuditEvent`: `id`, `timestamp`, `actorId`, `actorName`, `action`, `entityType`, `entityId`, `metadata`

## 2. Employee Administration Domain Models (Phase 1)
- `Employee`: `id`, `nip`, `nrk`, `nama`, `gelar`, `jabatan`, `pangkat`, `tmtPangkat`, `ukpd`, `wilayah`, `perangkatDaerah`
- `AwardProposal`: `id`, `employeeId`, `jenisPenghargaan` (`MASA_KERJA` | `SATYALANCANA`), `nilaiUsulan` (`10`|`20`|`30` | `X`|`XX`|`XXX`), `status`

## 3. Student Administration Domain Models (Phase 2)
- `Student`: `id`, `nisn`, `nis`, `name`, `class`, `gender`, `status`
- `AbsenceRecord`: `id`, `studentId`, `date`, `status` (`Sakit`, `Izin`, `Alpha`), `ocrDocumentId`, `verificationStatus`
- `OCRDocumentPayload`: `id`, `fileName`, `imageUrl`, `extractedCount`, `verifiedCount`, `items`
