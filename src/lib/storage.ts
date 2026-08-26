import {
  StudentLocalStorageRepository,
  OCRDocumentLocalStorageRepository,
} from '@/domains/student/repository';
import { Student, OCRDocument } from '@/domains/student/types';
import { PlatformAuditEngine } from '@/platform/audit/engine';
import { PlatformExceptionQueue } from '@/platform/exceptions/queue';
import { ocrItemValidationEngine } from '@/domains/student/rules';
import { AuditLog } from '@/types/sms';

const studentRepo = new StudentLocalStorageRepository();
const docRepo = new OCRDocumentLocalStorageRepository();
const auditEngine = new PlatformAuditEngine();
const exceptionQueue = new PlatformExceptionQueue();

export function getStoredStudents(): Student[] {
  const raw = studentRepo['getRawItems']();
  if (raw.length === 0) {
    const initial = studentRepo.generateInitialMockStudents();
    studentRepo['saveRawItems'](initial);
    return initial;
  }
  return raw;
}

export function saveStoredStudents(students: Student[]): void {
  studentRepo['saveRawItems'](students);
}

export const saveStudents = saveStoredStudents;

export function getStoredDocuments(): OCRDocument[] {
  const raw = docRepo['getRawItems']();
  if (raw.length === 0) {
    const initial = docRepo.generateInitialMockDocuments();
    docRepo['saveRawItems'](initial);
    return initial;
  }
  return raw;
}

export function saveStoredDocuments(documents: OCRDocument[]): void {
  docRepo['saveRawItems'](documents);

  documents.forEach((doc) => {
    (doc.items || []).forEach((item) => {
      const results = ocrItemValidationEngine.validateEntity(item);
      const invalid = results.filter((r) => !r.valid);
      if (invalid.length > 0) {
        exceptionQueue.createFromValidationResults('ExtractedItem', item.id, invalid);
      }
    });
  });
}

export const saveDocuments = saveStoredDocuments;

export function getStoredAuditLogs(): AuditLog[] {
  return auditEngine.getAllEvents().map((e) => ({
    id: e.id,
    timestamp: e.timestamp,
    operator: e.actor,
    action: e.action,
    target: e.entityType || e.entityId,
    details: e.metadata?.details || e.action,
  }));
}

export function addAuditLog(
  operatorOrObj: string | { operator: string; action: string; target: string; details: string },
  actionArg?: string,
  targetArg?: string,
  detailsArg?: string
): void {
  let operator: string;
  let action: string;
  let target: string;
  let details: string;

  if (typeof operatorOrObj === 'object') {
    operator = operatorOrObj.operator;
    action = operatorOrObj.action;
    target = operatorOrObj.target;
    details = operatorOrObj.details;
  } else {
    operator = operatorOrObj;
    action = actionArg || '';
    target = targetArg || '';
    details = detailsArg || '';
  }

  auditEngine.recordEvent({
    actor: operator,
    action: action,
    entityType: target,
    entityId: target,
    metadata: { details: details },
  });
}
