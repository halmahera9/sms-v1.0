export type {
  Student,
  AbsenceStatus,
  ExtractedItem,
  OCRDocument,
  StudentAbsenceWorkflowState,
} from '@/domains/student/types';

export interface AuditLog {
  id: string;
  timestamp: string;
  operator: string;
  action: string;
  target: string;
  details: string;
}
