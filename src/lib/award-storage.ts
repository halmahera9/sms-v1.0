import { EmployeeAwardLocalStorageRepository } from '@/domains/employee/awards/repository';
import { AwardProposal } from '@/domains/employee/awards/types';
import { AuditEvent } from '@/platform/types';
import { SignatoryConfig } from '@/types/award';

const repo = new EmployeeAwardLocalStorageRepository();

const STORAGE_KEYS = {
  SIGNATORY: 'banyubiru_award_signatory_v2',
  AUDIT_LOGS: 'banyubiru_award_audit_logs_v2',
};

export const DEFAULT_SIGNATORY: SignatoryConfig = {
  seNumber: '22/SE/2026',
  seDate: '18 Agustus 2026',
  officialSignatoryName: 'Dra. Maria Ulfah, M.Si',
  officialSignatoryNip: '197405121998032001',
  officialSignatoryTitle: 'Kepala Bidang Pengembangan Pegawai BKD Provinsi DKI Jakarta',
  bkdHeadName: 'Chaidir, M.Si',
  bkdHeadNip: '196808151992031004',
  bkdHeadTitle: 'Kepala Badan Kepegawaian Daerah Provinsi DKI Jakarta',
};

export function loadProposals(): AwardProposal[] {
  if (typeof window === 'undefined') return repo.generateInitialMockProposals();
  const raw = repo['getRawItems']();
  if (raw.length === 0) {
    const initial = repo.generateInitialMockProposals();
    repo['saveRawItems'](initial);
    return initial;
  }
  return raw;
}

export function saveProposals(proposals: AwardProposal[]): void {
  repo['saveRawItems'](proposals);
}

export function loadSignatoryConfig(): SignatoryConfig {
  if (typeof window === 'undefined') return DEFAULT_SIGNATORY;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SIGNATORY);
    return raw ? JSON.parse(raw) : DEFAULT_SIGNATORY;
  } catch {
    return DEFAULT_SIGNATORY;
  }
}

export function saveSignatoryConfig(config: SignatoryConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.SIGNATORY, JSON.stringify(config));
}

export function loadAuditLogs(): AuditEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addAuditLog(log: { actor: string; action: string; entity: string; entityId: string; details: string }): void {
  if (typeof window === 'undefined') return;
  const current = loadAuditLogs();
  const newLog: AuditEvent = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    actor: log.actor || 'system',
    action: log.action,
    entityType: log.entity,
    entityId: log.entityId,
    metadata: { details: log.details },
  };
  localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify([newLog, ...current]));
}
