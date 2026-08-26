import { PlatformExceptionQueue } from '../exceptions/queue';
import { PlatformAuditEngine } from '../audit/engine';
import { ExceptionItem, AuditEvent } from '../types';
import { EmployeeAwardLocalStorageRepository } from '@/domains/employee/awards/repository';
import { StudentLocalStorageRepository, OCRDocumentLocalStorageRepository } from '@/domains/student/repository';
import { AwardProposal } from '@/domains/employee/awards/types';
import { Student, OCRDocument } from '@/domains/student/types';

export interface WorkQueueItem {
  id: string;
  domain: 'EMPLOYEE' | 'STUDENT';
  entityId: string;
  title: string;
  subtitle: string;
  status: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  createdAt: string;
  actionRequired: string;
}

export interface OperationalMetrics {
  totalOpenExceptions: number;
  exceptionsBySeverity: {
    error: number;
    warning: number;
    info: number;
  };
  pendingVerifications: number;
  pendingApprovals: number;
  requiresCorrection: number;
  totalEmployees: number;
  totalStudents: number;
  totalDocumentsProcessed: number;
}

export class PlatformOperationalService {
  private employeeRepo = new EmployeeAwardLocalStorageRepository();
  private studentRepo = new StudentLocalStorageRepository();
  private docRepo = new OCRDocumentLocalStorageRepository();
  private auditEngine = new PlatformAuditEngine();
  private exceptionQueue = new PlatformExceptionQueue();

  public async getOperationalMetrics(): Promise<OperationalMetrics> {
    const proposals = await this.employeeRepo.findAll();
    const students = await this.studentRepo.findAll();
    const docs = await this.docRepo.findAll();
    const exceptions = this.exceptionQueue.getOpenExceptions();

    const pendingEmployeeVerif = proposals.filter(
      (p) => p.status === 'LENGKAP' || p.status === 'SEBAGIAN'
    ).length;

    const pendingEmployeeApproval = proposals.filter((p) => p.status === 'SIAP_GENERATE').length;

    const pendingStudentVerif = docs.reduce(
      (acc, d) => acc + (d.items || []).filter((i) => i.verificationStatus === 'pending').length,
      0
    );

    const errorExc = exceptions.filter((e) => e.severity === 'ERROR').length;
    const warningExc = exceptions.filter((e) => e.severity === 'WARNING').length;
    const infoExc = exceptions.filter((e) => e.severity === 'INFO').length;

    return {
      totalOpenExceptions: exceptions.length,
      exceptionsBySeverity: {
        error: errorExc,
        warning: warningExc,
        info: infoExc,
      },
      pendingVerifications: pendingEmployeeVerif + pendingStudentVerif,
      pendingApprovals: pendingEmployeeApproval,
      requiresCorrection: errorExc,
      totalEmployees: proposals.length,
      totalStudents: students.length,
      totalDocumentsProcessed: docs.length,
    };
  }

  public async getWorkQueueItems(): Promise<WorkQueueItem[]> {
    const proposals = await this.employeeRepo.findAll();
    const docs = await this.docRepo.findAll();
    const exceptions = this.exceptionQueue.getOpenExceptions();

    const items: WorkQueueItem[] = [];

    // 1. Employee Work Items
    proposals.forEach((p) => {
      if (p.status === 'SIAP_GENERATE') {
        items.push({
          id: `wq-emp-${p.id}`,
          domain: 'EMPLOYEE',
          entityId: p.id,
          title: p.employee.nama,
          subtitle: `Usulan ${p.jenisPenghargaan} (${p.nilaiUsulan}) - ${p.employee.ukpd}`,
          status: p.status,
          severity: 'HIGH',
          createdAt: p.updatedAt,
          actionRequired: 'Persetujuan Siap Cetak PDF',
        });
      } else if (p.status === 'LENGKAP' || p.status === 'SEBAGIAN') {
        items.push({
          id: `wq-emp-${p.id}`,
          domain: 'EMPLOYEE',
          entityId: p.id,
          title: p.employee.nama,
          subtitle: `Verifikasi Berkas ${p.jenisPenghargaan} (${p.employee.nrk})`,
          status: p.status,
          severity: 'MEDIUM',
          createdAt: p.updatedAt,
          actionRequired: 'Verifikasi Kelengkapan Dokumen',
        });
      }
    });

    // 2. Student Work Items
    docs.forEach((d) => {
      (d.items || []).forEach((item) => {
        if (item.verificationStatus === 'pending') {
          items.push({
            id: `wq-std-${item.id}`,
            domain: 'STUDENT',
            entityId: item.id,
            title: item.matchedStudentName || item.ocrText,
            subtitle: `Akurasi OCR ${item.confidence}% | Class ${item.class}`,
            status: item.verificationStatus,
            severity: item.confidence < 70 ? 'CRITICAL' : 'MEDIUM',
            createdAt: d.uploadedAt,
            actionRequired: 'Verifikasi Manual Ekstraksi Ketidakhadiran',
          });
        }
      });
    });

    // 3. Exception Work Items
    exceptions.forEach((e) => {
      items.push({
        id: `wq-exc-${e.id}`,
        domain: e.entityType === 'AwardProposal' ? 'EMPLOYEE' : 'STUDENT',
        entityId: e.entityId,
        title: `Pengecualian: ${e.ruleId}`,
        subtitle: e.message,
        status: e.status,
        severity: e.severity === 'ERROR' ? 'CRITICAL' : 'HIGH',
        createdAt: e.createdAt,
        actionRequired: 'Penyelesaian Pengecualian Aturan',
      });
    });

    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getExceptionQueue(): PlatformExceptionQueue {
    return this.exceptionQueue;
  }

  public getAuditEngine(): PlatformAuditEngine {
    return this.auditEngine;
  }
}
