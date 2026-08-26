import { PlatformWorkflowEngine } from '@/platform/workflow/engine';
import { WorkflowDefinition } from '@/platform/types';
import { ProposalStatus } from './types';

export type EmployeeAwardWorkflowEvent =
  | 'SUBMIT_NOMINATIVE'
  | 'UPLOAD_DOCUMENT'
  | 'COMPLETE_DOCUMENTS'
  | 'VERIFY_DOCUMENTS'
  | 'APPROVE_GENERATION'
  | 'MARK_GENERATED'
  | 'SIGN'
  | 'SEND'
  | 'ARCHIVE_COMPLETE';

export const EMPLOYEE_AWARD_WORKFLOW_DEF: WorkflowDefinition<ProposalStatus, EmployeeAwardWorkflowEvent> = {
  id: 'employee-award-workflow',
  name: 'Employee Award Processing Workflow (SE BKD 22/SE/2026)',
  initialState: 'NOMINATIF',
  transitions: [
    {
      from: 'NOMINATIF',
      to: 'BELUM_UPLOAD',
      event: 'SUBMIT_NOMINATIVE',
      name: 'Submit Nominatif',
    },
    {
      from: ['NOMINATIF', 'BELUM_UPLOAD'],
      to: 'SEBAGIAN',
      event: 'UPLOAD_DOCUMENT',
      name: 'Upload Dokumen Sebagian',
    },
    {
      from: ['NOMINATIF', 'BELUM_UPLOAD', 'SEBAGIAN'],
      to: 'LENGKAP',
      event: 'COMPLETE_DOCUMENTS',
      name: 'Lengkapi Seluruh Berkas',
    },
    {
      from: ['LENGKAP', 'SEBAGIAN'],
      to: 'DIVERIFIKASI',
      event: 'VERIFY_DOCUMENTS',
      name: 'Verifikasi Berkas',
    },
    {
      from: ['DIVERIFIKASI', 'LENGKAP'],
      to: 'SIAP_GENERATE',
      event: 'APPROVE_GENERATION',
      name: 'Persetujuan Siap Generate PDF',
      guard: (context: unknown) => {
        const ctx = context as { allMandatoryVerified?: boolean } | undefined;
        if (!ctx?.allMandatoryVerified) {
          return { allowed: false, reason: 'Seluruh dokumen wajib harus diverifikasi sebelum disetujui.' };
        }
        return true;
      },
    },
    {
      from: 'SIAP_GENERATE',
      to: 'GENERATED',
      event: 'MARK_GENERATED',
      name: 'Generate Berkas PDF',
    },
    {
      from: 'GENERATED',
      to: 'DITANDATANGANI',
      event: 'SIGN',
      name: 'Penandatanganan Dokumen',
    },
    {
      from: 'DITANDATANGANI',
      to: 'DIKIRIM',
      event: 'SEND',
      name: 'Pengiriman Berkas Final',
    },
    {
      from: 'DIKIRIM',
      to: 'SELESAI',
      event: 'ARCHIVE_COMPLETE',
      name: 'Arsip & Selesai',
    },
  ],
};

export const employeeAwardWorkflowEngine = new PlatformWorkflowEngine<
  ProposalStatus,
  EmployeeAwardWorkflowEvent
>(EMPLOYEE_AWARD_WORKFLOW_DEF);
