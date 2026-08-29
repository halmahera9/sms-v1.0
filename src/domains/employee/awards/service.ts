import { AwardProposal, ProposalStatus, ProposalDocument, VerificationStatus } from './types';
import { employeeAwardWorkflowEngine, EmployeeAwardWorkflowEvent } from './workflow';
import { getRequirementsForType } from './rules';
import { IAwardProposalRepository, PostgresAwardProposalRepository } from '@/platform/repositories/award-proposal';
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
    private readonly auditRepo: IAuditEventRepository = new PostgresAuditEventRepository()
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

  public async getAllInContext(
    actorId: string,
    tenantId: string
  ): Promise<AwardProposal[]> {
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.proposalRepo.findAllTx(tx);
    });
  }
}
