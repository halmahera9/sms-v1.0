# 14 - Repository Contracts & Operation Specifications

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4B Repository Interfaces, Methods & Operation Matrix  
**Status**: NON-CODE SPECIFICATION DESIGN  

---

## 1. Repository Operation Matrix

| Repository Interface | Target Entity | Allowed Operations | Forbidden Operations |
|---|---|---|---|
| **`ITenantRepository`** | `Tenant` | `findById`, `findByCode`, `save`, `findAll` | Hard Delete |
| **`IUserActorRepository`** | `UserActor` | `findById`, `findByUsername`, `save`, `findByTenantId` | Hard Delete |
| **`IEmployeeRepository`** | `Employee` | `findById`, `findByNip`, `save`, `saveAll`, `findByTenantId` | Hard Delete |
| **`IAwardProposalRepository`**| `AwardProposal` | `findById`, `findByNipAndYear`, `save`, `saveAll`, `findByStatus` | Direct Document Bypass |
| **`IStudentRepository`** | `Student` | `findById`, `findByNisn`, `save`, `saveAll`, `findByClass` | Hard Delete |
| **`IAbsenceRecordRepository`**| `AbsenceRecord` | `findById`, `findByStudentId`, `findByDateRange`, `save` | Unverified Manual Injection |
| **`IDocumentRepository`** | `Document` | `findById`, `save`, `findByCategory` | Hard Delete if Attached |
| **`IOCRExtractionRepository`**| `OCRExtraction` | `findById`, `findByDocumentId`, `save` | Delete without Cascade Items |
| **`IWorkflowInstanceRepository`**| `WorkflowInstance` | `findByEntity`, `save` | Direct State Overwrite without Ledger |
| **`IExceptionItemRepository`**| `ExceptionItem` | `findById`, `findByStatus`, `save`, `findByEntity` | Hard Delete |
| **`IAuditEventRepository`** | `AuditEvent` | `findById`, `save` (**APPEND-ONLY**), `findByTenantId`, `findByEntity` | **`UPDATE` (MUTATION FORBIDDEN)**<br/>**`DELETE` (PURGE FORBIDDEN)** |

---

## 2. Interface Contract Specification Blueprint

### A. Append-Only Audit Event Repository Contract
```typescript
// NON-CODE SPECIFICATION BLUEPRINT
export interface IAuditEventRepository {
  findById(id: string): Promise<AuditEvent | null>;
  findByTenantId(tenantId: string, limit?: number, offset?: number): Promise<AuditEvent[]>;
  findByEntity(entityType: string, entityId: string): Promise<AuditEvent[]>;
  
  // APPEND-ONLY: ONLY INSERT IS ALLOWED
  append(event: AuditEvent): Promise<AuditEvent>;
  
  // DILARANG MENYEDIAKAN:
  // update(event: AuditEvent): NEVER;
  // delete(id: string): NEVER;
}
```

### B. Student & Absence Record Repository Contracts
```typescript
// NON-CODE SPECIFICATION BLUEPRINT
export interface IStudentRepository {
  findById(id: string): Promise<Student | null>;
  findByNisn(tenantId: string, nisn: string): Promise<Student | null>;
  findAllByTenant(tenantId: string): Promise<Student[]>;
  save(student: Student): Promise<Student>;
  saveAll(students: Student[]): Promise<Student[]>;
}

export interface IAbsenceRecordRepository {
  findById(id: string): Promise<AbsenceRecord | null>;
  findByStudentId(studentId: string): Promise<AbsenceRecord[]>;
  findByDateRange(tenantId: string, startDate: string, endDate: string): Promise<AbsenceRecord[]>;
  save(record: AbsenceRecord): Promise<AbsenceRecord>;
}
```

### C. Document & Version Repository Contracts
```typescript
// NON-CODE SPECIFICATION BLUEPRINT
export interface IDocumentRepository {
  findById(id: string): Promise<Document | null>;
  save(document: Document): Promise<Document>;
  addVersion(documentId: string, version: DocumentVersion): Promise<DocumentVersion>;
  findLatestVersion(documentId: string): Promise<DocumentVersion | null>;
}
```

### D. Award Proposal Repository Contract
```typescript
// NON-CODE SPECIFICATION BLUEPRINT
export interface IAwardProposalRepository {
  findById(id: string): Promise<AwardProposal | null>;
  findByNipAndYear(tenantId: string, nip: string, year: number): Promise<AwardProposal | null>;
  findByStatus(tenantId: string, status: string): Promise<AwardProposal[]>;
  save(proposal: AwardProposal): Promise<AwardProposal>;
  saveAll(proposals: AwardProposal[]): Promise<AwardProposal[]>;
}
```
