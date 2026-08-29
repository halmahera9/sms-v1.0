import crypto from 'crypto';
import { Employee as PrismaEmployee } from '@prisma/client';
import {
  AwardProposal,
  ProposalStatus,
  ProposalDocument,
  VerificationStatus,
  ImportAwardProposalItemDTO,
  ImportAwardProposalsResult,
} from './types';
import { employeeAwardWorkflowEngine, EmployeeAwardWorkflowEvent } from './workflow';
import { getRequirementsForType } from './rules';
import { IAwardProposalRepository, PostgresAwardProposalRepository } from '@/platform/repositories/award-proposal';
import { PostgresEmployeeRepository } from '@/platform/repositories/employee';
import { IAuditEventRepository, PostgresAuditEventRepository } from '@/platform/repositories/audit-event';
import { PlatformWorkflowEngine } from '@/platform/workflow/engine';
import { TenantTransactionClient, runInTenantContext } from '@/platform/db/tenant-context';

export class AwardProposalApplicationService {
  constructor(
    private readonly proposalRepo: IAwardProposalRepository = new PostgresAwardProposalRepository(),
    private readonly workflowEngine: PlatformWorkflowEngine<
      ProposalStatus,
      EmployeeAwardWorkflowEvent
    > = employeeAwardWorkflowEngine,
    private readonly auditRepo: IAuditEventRepository = new PostgresAuditEventRepository(),
    private readonly employeeRepo: PostgresEmployeeRepository = new PostgresEmployeeRepository()
  ) {}

  // ==========================================
  // TRANSACTION-BOUND USE CASES (*Tx)
  // ==========================================

  public async submitNominativeTx(
    tx: TenantTransactionClient,
    tenantId: string,
    proposalId: string,
    actorId: string
  ): Promise<AwardProposal> {
    const proposal = await this.proposalRepo.findByIdTx(tx, proposalId);
    if (!proposal) {
      throw new Error(`AwardProposal not found: ${proposalId}`);
    }

    const result = this.workflowEngine.transition(
      proposal.status,
      'SUBMIT_NOMINATIVE',
      {},
      actorId
    );

    if (!result.success) {
      throw new Error(`Workflow transition failed: ${result.reason || 'Invalid transition'}`);
    }

    const updatedProposal: AwardProposal = {
      ...proposal,
      status: result.toState,
      updatedAt: new Date().toISOString(),
    };

    const saved = await this.proposalRepo.saveTx(tx, tenantId, updatedProposal);

    // Atomic transaction-bound persistent audit log
    await this.auditRepo.recordTx(tx, tenantId, {
      actor: actorId,
      actorUserId: actorId,
      action: 'SUBMIT_NOMINATIVE',
      entityType: 'AwardProposal',
      entityId: proposalId,
      beforeState: { status: proposal.status },
      afterState: { status: saved.status },
      metadata: { transitionResult: result },
    });

    return saved;
  }

  public async uploadDocumentTx(
    tx: TenantTransactionClient,
    tenantId: string,
    proposalId: string,
    document: ProposalDocument,
    actorId: string
  ): Promise<AwardProposal> {
    const proposal = await this.proposalRepo.findByIdTx(tx, proposalId);
    if (!proposal) {
      throw new Error(`AwardProposal not found: ${proposalId}`);
    }

    // Persist document mutation through repository abstraction
    await this.proposalRepo.saveDocumentTx(tx, tenantId, proposalId, document);

    // Reload authoritative proposal with updated document relations
    const currentProposal = await this.proposalRepo.findByIdTx(tx, proposalId);
    if (!currentProposal) {
      throw new Error(`AwardProposal not found after document save: ${proposalId}`);
    }

    const mandatoryReqs = getRequirementsForType(currentProposal.jenisPenghargaan).filter((r) => r.isMandatory);
    const uploadedCodes = new Set((currentProposal.documents || []).map((d) => d.requirementCode));
    const allMandatoryUploaded = mandatoryReqs.every((r) => uploadedCodes.has(r.code));

    let nextStatus = currentProposal.status;
    let eventDispatched: EmployeeAwardWorkflowEvent | null = null;

    // Transition workflow state if applicable
    if (currentProposal.status === 'NOMINATIF' || currentProposal.status === 'BELUM_UPLOAD' || currentProposal.status === 'SEBAGIAN') {
      const eventToDispatch: EmployeeAwardWorkflowEvent = allMandatoryUploaded
        ? 'COMPLETE_DOCUMENTS'
        : 'UPLOAD_DOCUMENT';

      const result = this.workflowEngine.transition(
        currentProposal.status,
        eventToDispatch,
        {},
        actorId
      );

      if (result.success) {
        nextStatus = result.toState;
        eventDispatched = eventToDispatch;
      }
    }

    const updatedProposal: AwardProposal = {
      ...currentProposal,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };

    const saved = await this.proposalRepo.saveTx(tx, tenantId, updatedProposal);

    // Atomic transaction-bound persistent audit log
    if (eventDispatched) {
      await this.auditRepo.recordTx(tx, tenantId, {
        actor: actorId,
        actorUserId: actorId,
        action: eventDispatched,
        entityType: 'AwardProposal',
        entityId: proposalId,
        beforeState: { status: currentProposal.status },
        afterState: { status: nextStatus },
        metadata: { documentCode: document.requirementCode },
      });
    }

    return saved;
  }

  public async verifyDocumentTx(
    tx: TenantTransactionClient,
    tenantId: string,
    proposalId: string,
    requirementCode: string,
    status: VerificationStatus,
    actorId: string,
    notes?: string
  ): Promise<AwardProposal> {
    const proposal = await this.proposalRepo.findByIdTx(tx, proposalId);
    if (!proposal) {
      throw new Error(`AwardProposal not found: ${proposalId}`);
    }

    // Persist verification through repository abstraction
    await this.proposalRepo.verifyDocumentTx(
      tx,
      tenantId,
      proposalId,
      requirementCode,
      status,
      actorId,
      notes
    );

    // Reload authoritative proposal with updated document relations
    const currentProposal = await this.proposalRepo.findByIdTx(tx, proposalId);
    if (!currentProposal) {
      throw new Error(`AwardProposal not found after verification: ${proposalId}`);
    }

    let nextStatus = currentProposal.status;
    let transitionSuccessful = false;

    // Transition to DIVERIFIKASI if eligible
    if (currentProposal.status === 'SEBAGIAN' || currentProposal.status === 'LENGKAP') {
      const result = this.workflowEngine.transition(
        currentProposal.status,
        'VERIFY_DOCUMENTS',
        {},
        actorId
      );

      if (result.success) {
        nextStatus = result.toState;
        transitionSuccessful = true;
      }
    }

    const updatedProposal: AwardProposal = {
      ...currentProposal,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };

    const saved = await this.proposalRepo.saveTx(tx, tenantId, updatedProposal);

    // Atomic transaction-bound persistent audit log
    if (transitionSuccessful) {
      await this.auditRepo.recordTx(tx, tenantId, {
        actor: actorId,
        actorUserId: actorId,
        action: 'VERIFY_DOCUMENTS',
        entityType: 'AwardProposal',
        entityId: proposalId,
        beforeState: { status: currentProposal.status },
        afterState: { status: nextStatus },
        metadata: { requirementCode, verificationStatus: status },
      });
    }

    return saved;
  }

  public async approveGenerationTx(
    tx: TenantTransactionClient,
    tenantId: string,
    proposalId: string,
    actorId: string
  ): Promise<AwardProposal> {
    const proposal = await this.proposalRepo.findByIdTx(tx, proposalId);
    if (!proposal) {
      throw new Error(`AwardProposal not found: ${proposalId}`);
    }

    // Authoritative calculation of fact: Are all mandatory documents verified?
    const mandatoryReqs = getRequirementsForType(proposal.jenisPenghargaan).filter((r) => r.isMandatory);
    const verifiedCodes = new Set(
      (proposal.documents || [])
        .filter((d) => d.verificationStatus === 'verified')
        .map((d) => d.requirementCode)
    );

    const allMandatoryVerified = mandatoryReqs.every((req) => verifiedCodes.has(req.code));

    // Request formal state transition from workflow engine with authoritative context
    const result = this.workflowEngine.transition(
      proposal.status,
      'APPROVE_GENERATION',
      { allMandatoryVerified },
      actorId
    );

    if (!result.success) {
      throw new Error(`Workflow transition failed: ${result.reason || 'Guard check failed'}`);
    }

    const updatedProposal: AwardProposal = {
      ...proposal,
      status: result.toState,
      updatedAt: new Date().toISOString(),
    };

    const saved = await this.proposalRepo.saveTx(tx, tenantId, updatedProposal);

    // Atomic transaction-bound persistent audit log
    await this.auditRepo.recordTx(tx, tenantId, {
      actor: actorId,
      actorUserId: actorId,
      action: 'APPROVE_GENERATION',
      entityType: 'AwardProposal',
      entityId: proposalId,
      beforeState: { status: proposal.status },
      afterState: { status: saved.status },
      metadata: { allMandatoryVerified },
    });

    return saved;
  }

  public async markGeneratedTx(
    tx: TenantTransactionClient,
    tenantId: string,
    proposalId: string,
    actorId: string
  ): Promise<AwardProposal> {
    const proposal = await this.proposalRepo.findByIdTx(tx, proposalId);
    if (!proposal) {
      throw new Error(`AwardProposal not found: ${proposalId}`);
    }

    const result = this.workflowEngine.transition(
      proposal.status,
      'MARK_GENERATED',
      {},
      actorId
    );

    if (!result.success) {
      throw new Error(`Workflow transition failed: ${result.reason || 'Invalid transition'}`);
    }

    const updatedProposal: AwardProposal = {
      ...proposal,
      status: result.toState,
      updatedAt: new Date().toISOString(),
    };

    const saved = await this.proposalRepo.saveTx(tx, tenantId, updatedProposal);

    // Atomic transaction-bound persistent audit log
    await this.auditRepo.recordTx(tx, tenantId, {
      actor: actorId,
      actorUserId: actorId,
      action: 'MARK_GENERATED',
      entityType: 'AwardProposal',
      entityId: proposalId,
      beforeState: { status: proposal.status },
      afterState: { status: saved.status },
      metadata: { transitionResult: result },
    });

    return saved;
  }

  public async batchMarkGeneratedTx(
    tx: TenantTransactionClient,
    tenantId: string,
    proposalIds: string[],
    actorId: string
  ): Promise<AwardProposal[]> {
    const updatedList: AwardProposal[] = [];
    for (const proposalId of proposalIds) {
      const updated = await this.markGeneratedTx(tx, tenantId, proposalId, actorId);
      updatedList.push(updated);
    }
    return updatedList;
  }

  public async signProposalTx(
    tx: TenantTransactionClient,
    tenantId: string,
    proposalId: string,
    actorId: string
  ): Promise<AwardProposal> {
    const proposal = await this.proposalRepo.findByIdTx(tx, proposalId);
    if (!proposal) {
      throw new Error(`AwardProposal not found: ${proposalId}`);
    }

    const result = this.workflowEngine.transition(
      proposal.status,
      'SIGN',
      {},
      actorId
    );

    if (!result.success) {
      throw new Error(`Workflow transition failed: ${result.reason || 'Invalid transition'}`);
    }

    const updatedProposal: AwardProposal = {
      ...proposal,
      status: result.toState,
      updatedAt: new Date().toISOString(),
    };

    const saved = await this.proposalRepo.saveTx(tx, tenantId, updatedProposal);

    // Atomic transaction-bound persistent audit log
    await this.auditRepo.recordTx(tx, tenantId, {
      actor: actorId,
      actorUserId: actorId,
      action: 'SIGN',
      entityType: 'AwardProposal',
      entityId: proposalId,
      beforeState: { status: proposal.status },
      afterState: { status: saved.status },
      metadata: { transitionResult: result },
    });

    return saved;
  }

  public async sendProposalTx(
    tx: TenantTransactionClient,
    tenantId: string,
    proposalId: string,
    actorId: string
  ): Promise<AwardProposal> {
    const proposal = await this.proposalRepo.findByIdTx(tx, proposalId);
    if (!proposal) {
      throw new Error(`AwardProposal not found: ${proposalId}`);
    }

    const result = this.workflowEngine.transition(
      proposal.status,
      'SEND',
      {},
      actorId
    );

    if (!result.success) {
      throw new Error(`Workflow transition failed: ${result.reason || 'Invalid transition'}`);
    }

    const updatedProposal: AwardProposal = {
      ...proposal,
      status: result.toState,
      updatedAt: new Date().toISOString(),
    };

    const saved = await this.proposalRepo.saveTx(tx, tenantId, updatedProposal);

    // Atomic transaction-bound persistent audit log
    await this.auditRepo.recordTx(tx, tenantId, {
      actor: actorId,
      actorUserId: actorId,
      action: 'SEND',
      entityType: 'AwardProposal',
      entityId: proposalId,
      beforeState: { status: proposal.status },
      afterState: { status: saved.status },
      metadata: { transitionResult: result },
    });

    return saved;
  }

  public async archiveCompleteProposalTx(
    tx: TenantTransactionClient,
    tenantId: string,
    proposalId: string,
    actorId: string
  ): Promise<AwardProposal> {
    const proposal = await this.proposalRepo.findByIdTx(tx, proposalId);
    if (!proposal) {
      throw new Error(`AwardProposal not found: ${proposalId}`);
    }

    const result = this.workflowEngine.transition(
      proposal.status,
      'ARCHIVE_COMPLETE',
      {},
      actorId
    );

    if (!result.success) {
      throw new Error(`Workflow transition failed: ${result.reason || 'Invalid transition'}`);
    }

    const updatedProposal: AwardProposal = {
      ...proposal,
      status: result.toState,
      updatedAt: new Date().toISOString(),
    };

    const saved = await this.proposalRepo.saveTx(tx, tenantId, updatedProposal);

    // Atomic transaction-bound persistent audit log
    await this.auditRepo.recordTx(tx, tenantId, {
      actor: actorId,
      actorUserId: actorId,
      action: 'ARCHIVE_COMPLETE',
      entityType: 'AwardProposal',
      entityId: proposalId,
      beforeState: { status: proposal.status },
      afterState: { status: saved.status },
      metadata: { transitionResult: result },
    });

    return saved;
  }

  public async importProposalsTx(
    tx: TenantTransactionClient,
    tenantId: string,
    items: ImportAwardProposalItemDTO[],
    actorId: string
  ): Promise<ImportAwardProposalsResult> {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('VALIDATION_ERROR: Data import tidak boleh kosong.');
    }

    let createdCount = 0;
    let updatedCount = 0;
    const savedProposals: AwardProposal[] = [];

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const rowNum = idx + 1;

      // 1. Validation
      if (!item.nip || typeof item.nip !== 'string' || item.nip.trim() === '') {
        throw new Error(`VALIDATION_ERROR (Baris ${rowNum}): NIP wajib diisi.`);
      }
      if (!item.nrk || typeof item.nrk !== 'string' || item.nrk.trim() === '') {
        throw new Error(`VALIDATION_ERROR (Baris ${rowNum}): NRK wajib diisi.`);
      }
      if (!item.nama || typeof item.nama !== 'string' || item.nama.trim() === '') {
        throw new Error(`VALIDATION_ERROR (Baris ${rowNum}): Nama pegawai wajib diisi.`);
      }
      if (!item.tahunUsulan || typeof item.tahunUsulan !== 'number' || item.tahunUsulan < 1900 || item.tahunUsulan > 2100) {
        throw new Error(`VALIDATION_ERROR (Baris ${rowNum}): Tahun usulan tidak valid.`);
      }
      if (item.masaKerjaBulan !== undefined && (typeof item.masaKerjaBulan !== 'number' || item.masaKerjaBulan < 0 || item.masaKerjaBulan > 11)) {
        throw new Error(`VALIDATION_ERROR (Baris ${rowNum}): Masa kerja bulan harus bernilai 0 hingga 11.`);
      }
      if (item.masaKerjaTahun !== undefined && (typeof item.masaKerjaTahun !== 'number' || item.masaKerjaTahun < 0)) {
        throw new Error(`VALIDATION_ERROR (Baris ${rowNum}): Masa kerja tahun tidak boleh negatif.`);
      }
      if (!['MASA_KERJA', 'SATYALANCANA'].includes(item.jenisPenghargaan)) {
        throw new Error(`VALIDATION_ERROR (Baris ${rowNum}): Jenis penghargaan tidak valid.`);
      }
      if (item.nilaiUsulan !== undefined && !['10', '20', '30', 'X', 'XX', 'XXX'].includes(item.nilaiUsulan)) {
        throw new Error(`VALIDATION_ERROR (Baris ${rowNum}): Nilai usulan tidak valid.`);
      }

      // 2. Identity Resolution
      const nipMatch = await this.employeeRepo.findByNipTx(tx, tenantId, item.nip.trim());
      const nrkMatch = await this.employeeRepo.findByNrkTx(tx, tenantId, item.nrk.trim());

      let resolvedEmployeeId: string;
      let employeeRecord: PrismaEmployee;

      if (nipMatch === null && nrkMatch === null) {
        // CASE 1: New Employee
        const newId = crypto.randomUUID();
        const newEmployee: PrismaEmployee = {
          id: newId,
          tenantId,
          nip: item.nip.trim(),
          nrk: item.nrk.trim(),
          fullName: item.nama.trim(),
          gelarDepan: null,
          gelarBelakang: item.gelar?.trim() || null,
          jabatan: item.jabatan.trim(),
          unitKerja: item.unitKerja.trim(),
          instansi: item.perangkatDaerah.trim() || item.unitKerja.trim(),
          statusKepegawaian: 'PNS',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        employeeRecord = await this.employeeRepo.saveTx(tx, tenantId, newEmployee);
        resolvedEmployeeId = employeeRecord.id;
      } else if (nipMatch !== null && nrkMatch === null) {
        // CASE 2: Match by NIP only -> update employee
        const updatedEmployee: PrismaEmployee = {
          ...nipMatch,
          nrk: item.nrk.trim() || nipMatch.nrk,
          fullName: item.nama.trim() || nipMatch.fullName,
          gelarBelakang: item.gelar?.trim() || nipMatch.gelarBelakang,
          jabatan: item.jabatan.trim() || nipMatch.jabatan,
          unitKerja: item.unitKerja.trim() || nipMatch.unitKerja,
          instansi: item.perangkatDaerah.trim() || nipMatch.instansi,
          updatedAt: new Date(),
        };
        employeeRecord = await this.employeeRepo.saveTx(tx, tenantId, updatedEmployee);
        resolvedEmployeeId = employeeRecord.id;
      } else if (nipMatch === null && nrkMatch !== null) {
        // CASE 3: Match by NRK only -> update employee
        const updatedEmployee: PrismaEmployee = {
          ...nrkMatch,
          nip: item.nip.trim() || nrkMatch.nip,
          fullName: item.nama.trim() || nrkMatch.fullName,
          gelarBelakang: item.gelar?.trim() || nrkMatch.gelarBelakang,
          jabatan: item.jabatan.trim() || nrkMatch.jabatan,
          unitKerja: item.unitKerja.trim() || nrkMatch.unitKerja,
          instansi: item.perangkatDaerah.trim() || nrkMatch.instansi,
          updatedAt: new Date(),
        };
        employeeRecord = await this.employeeRepo.saveTx(tx, tenantId, updatedEmployee);
        resolvedEmployeeId = employeeRecord.id;
      } else if (nipMatch !== null && nrkMatch !== null && nipMatch.id === nrkMatch.id) {
        // CASE 4: Both match the same Employee ID -> update employee
        const updatedEmployee: PrismaEmployee = {
          ...nipMatch,
          fullName: item.nama.trim() || nipMatch.fullName,
          gelarBelakang: item.gelar?.trim() || nipMatch.gelarBelakang,
          jabatan: item.jabatan.trim() || nipMatch.jabatan,
          unitKerja: item.unitKerja.trim() || nipMatch.unitKerja,
          instansi: item.perangkatDaerah.trim() || nipMatch.instansi,
          updatedAt: new Date(),
        };
        employeeRecord = await this.employeeRepo.saveTx(tx, tenantId, updatedEmployee);
        resolvedEmployeeId = employeeRecord.id;
      } else {
        // CASE 5: Identity collision (different employee IDs)
        throw new Error(
          `IDENTITY_COLLISION: Konflik identitas pegawai pada baris ${rowNum}. NIP '${item.nip}' terdaftar pada Employee (${nipMatch!.id}) dan NRK '${item.nrk}' terdaftar pada Employee (${nrkMatch!.id}). Keduanya merujuk pada pegawai berbeda.`
        );
      }

      // 3. Proposal Idempotency & Workflow State Preservation
      const existingProposal = await this.proposalRepo.findByEmployeeAndAwardAndYearTx(
        tx,
        tenantId,
        resolvedEmployeeId,
        item.jenisPenghargaan,
        item.tahunUsulan
      );

      let savedProposal: AwardProposal;

      if (!existingProposal) {
        // Fresh proposal -> initial status NOMINATIF
        const newProposal: AwardProposal = {
          id: crypto.randomUUID(),
          tenantId,
          employeeId: resolvedEmployeeId,
          employee: {
            id: resolvedEmployeeId,
            nip: employeeRecord.nip,
            nrk: employeeRecord.nrk,
            nama: employeeRecord.fullName,
            gelar: [employeeRecord.gelarDepan, employeeRecord.gelarBelakang].filter(Boolean).join(' ') || undefined,
            jabatan: employeeRecord.jabatan,
            unitKerja: employeeRecord.unitKerja,
            perangkatDaerah: employeeRecord.instansi,
            ukpd: item.ukpd || employeeRecord.unitKerja,
            wilayah: item.wilayah || '',
          },
          jenisPenghargaan: item.jenisPenghargaan,
          nilaiUsulan: item.nilaiUsulan,
          tahunUsulan: item.tahunUsulan,
          masaKerjaTahun: item.masaKerjaTahun ?? 0,
          masaKerjaBulan: item.masaKerjaBulan ?? 0,
          status: 'NOMINATIF',
          catatan: item.catatan,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          documents: [],
        };
        savedProposal = await this.proposalRepo.saveTx(tx, tenantId, newProposal);
        createdCount++;
      } else {
        // Existing proposal -> preserve existing ID, status, and documents
        const updatedProposal: AwardProposal = {
          ...existingProposal,
          employee: {
            ...existingProposal.employee,
            nama: employeeRecord.fullName,
            nip: employeeRecord.nip,
            nrk: employeeRecord.nrk,
            jabatan: employeeRecord.jabatan,
            unitKerja: employeeRecord.unitKerja,
            perangkatDaerah: employeeRecord.instansi,
            ukpd: item.ukpd || existingProposal.employee.ukpd,
            wilayah: item.wilayah || existingProposal.employee.wilayah,
          },
          nilaiUsulan: item.nilaiUsulan !== undefined ? item.nilaiUsulan : existingProposal.nilaiUsulan,
          masaKerjaTahun: item.masaKerjaTahun !== undefined ? item.masaKerjaTahun : existingProposal.masaKerjaTahun,
          masaKerjaBulan: item.masaKerjaBulan !== undefined ? item.masaKerjaBulan : existingProposal.masaKerjaBulan,
          catatan: item.catatan !== undefined ? item.catatan : existingProposal.catatan,
          updatedAt: new Date().toISOString(),
        };
        savedProposal = await this.proposalRepo.saveTx(tx, tenantId, updatedProposal);
        updatedCount++;
      }

      savedProposals.push(savedProposal);
    }

    // 4. Single Aggregate Audit Event for the Batch
    await this.auditRepo.recordTx(tx, tenantId, {
      actorUserId: actorId,
      actor: actorId,
      action: 'IMPORT_AWARD_PROPOSALS',
      entityType: 'Tenant',
      entityId: tenantId,
      metadata: {
        targetScope: 'AWARD_EXCEL_IMPORT',
        rowCount: items.length,
        createdCount,
        updatedCount,
        tahunUsulanSet: Array.from(new Set(items.map((i) => i.tahunUsulan))),
        awardTypes: Array.from(new Set(items.map((i) => i.jenisPenghargaan))),
      },
    });

    return {
      importedCount: items.length,
      createdCount,
      updatedCount,
      proposals: savedProposals,
    };
  }

  // ==========================================
  // CONTEXT-BOUND ENTRYPOINTS (*InContext)
  // ==========================================

  public async submitNominativeInContext(
    actorId: string,
    tenantId: string,
    proposalId: string
  ): Promise<AwardProposal> {
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.submitNominativeTx(tx, tenantId, proposalId, actorId);
    });
  }

  public async uploadDocumentInContext(
    actorId: string,
    tenantId: string,
    proposalId: string,
    document: ProposalDocument
  ): Promise<AwardProposal> {
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.uploadDocumentTx(tx, tenantId, proposalId, document, actorId);
    });
  }

  public async verifyDocumentInContext(
    actorId: string,
    tenantId: string,
    proposalId: string,
    requirementCode: string,
    status: VerificationStatus,
    notes?: string
  ): Promise<AwardProposal> {
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.verifyDocumentTx(tx, tenantId, proposalId, requirementCode, status, actorId, notes);
    });
  }

  public async approveGenerationInContext(
    actorId: string,
    tenantId: string,
    proposalId: string
  ): Promise<AwardProposal> {
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.approveGenerationTx(tx, tenantId, proposalId, actorId);
    });
  }

  public async markGeneratedInContext(
    actorId: string,
    tenantId: string,
    proposalId: string
  ): Promise<AwardProposal> {
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.markGeneratedTx(tx, tenantId, proposalId, actorId);
    });
  }

  public async batchMarkGeneratedInContext(
    actorId: string,
    tenantId: string,
    proposalIds: string[]
  ): Promise<AwardProposal[]> {
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.batchMarkGeneratedTx(tx, tenantId, proposalIds, actorId);
    });
  }

  public async signProposalInContext(
    actorId: string,
    tenantId: string,
    proposalId: string
  ): Promise<AwardProposal> {
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.signProposalTx(tx, tenantId, proposalId, actorId);
    });
  }

  public async sendProposalInContext(
    actorId: string,
    tenantId: string,
    proposalId: string
  ): Promise<AwardProposal> {
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.sendProposalTx(tx, tenantId, proposalId, actorId);
    });
  }

  public async archiveCompleteProposalInContext(
    actorId: string,
    tenantId: string,
    proposalId: string
  ): Promise<AwardProposal> {
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.archiveCompleteProposalTx(tx, tenantId, proposalId, actorId);
    });
  }

  public async importProposalsInContext(
    actorId: string,
    tenantId: string,
    items: ImportAwardProposalItemDTO[]
  ): Promise<ImportAwardProposalsResult> {
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.importProposalsTx(tx, tenantId, items, actorId);
    });
  }

  public async getAllInContext(
    actorId: string,
    tenantId: string
  ): Promise<AwardProposal[]> {
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.proposalRepo.findAllTx(tx);
    });
  }
}
