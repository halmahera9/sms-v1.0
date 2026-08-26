import { PlatformWorkflowEngine } from '@/platform/workflow/engine';
import { WorkflowDefinition } from '@/platform/types';
import { StudentAbsenceWorkflowState } from './types';

export type StudentWorkflowEvent =
  | 'PROCESS_OCR'
  | 'SUBMIT_FOR_VERIFICATION'
  | 'VERIFY_ALL_ITEMS'
  | 'REQUEST_CORRECTION'
  | 'ARCHIVE_COMPLETE';

export const STUDENT_ABSENCE_WORKFLOW_DEF: WorkflowDefinition<
  StudentAbsenceWorkflowState,
  StudentWorkflowEvent
> = {
  id: 'student-absence-workflow',
  name: 'Student Absence Document Processing Workflow',
  initialState: 'DRAFT',
  transitions: [
    {
      from: 'DRAFT',
      to: 'NEEDS_VERIFICATION',
      event: 'PROCESS_OCR',
      name: 'Ekstraksi OCR Selesai',
    },
    {
      from: 'DRAFT',
      to: 'NEEDS_VERIFICATION',
      event: 'SUBMIT_FOR_VERIFICATION',
      name: 'Kirim Dokumen ke Antrean Verifikasi',
    },
    {
      from: ['NEEDS_VERIFICATION', 'REQUIRES_CORRECTION'],
      to: 'VERIFIED',
      event: 'VERIFY_ALL_ITEMS',
      name: 'Verifikasi Manual Seluruh Item',
      guard: (context: unknown) => {
        const ctx = context as { allItemsVerified?: boolean } | undefined;
        if (!ctx?.allItemsVerified) {
          return { allowed: false, reason: 'Seluruh item ekstraksi harus diverifikasi sebelum menyetujui dokumen.' };
        }
        return true;
      },
    },
    {
      from: ['NEEDS_VERIFICATION', 'VERIFIED'],
      to: 'REQUIRES_CORRECTION',
      event: 'REQUEST_CORRECTION',
      name: 'Minta Koreksi Item',
    },
    {
      from: 'VERIFIED',
      to: 'COMPLETED',
      event: 'ARCHIVE_COMPLETE',
      name: 'Selesaikan & Ekspor Data',
    },
  ],
};

export const studentAbsenceWorkflowEngine = new PlatformWorkflowEngine<
  StudentAbsenceWorkflowState,
  StudentWorkflowEvent
>(STUDENT_ABSENCE_WORKFLOW_DEF);
