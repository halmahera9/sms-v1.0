import 'server-only';

import { TenantTransactionClient } from '@/platform/db/tenant-context';
import { MatchingResult, MatchingCandidate, Prisma } from '@prisma/client';
import type {
  MatchingResultDTO,
  MatchingCandidateDTO,
  MatchingResultWithCandidatesDTO,
  StudentCandidateInfo,
  EmployeeCandidateInfo,
  CandidateInfo,
} from '@/platform/types/matching';

/**
 * Repository interface for MatchingResult persistence and queries.
 */
export interface IMatchingResultRepository {
  /**
   * Get a matching result by ID with tenant scoping.
   */
  getByIdTx(
    tx: TenantTransactionClient,
    tenantId: string,
    matchingResultId: string
  ): Promise<MatchingResult | null>;

  /**
   * Get a matching result by its unique composite key.
   * Used to check if a result already exists.
   */
  getByCompositeTx(
    tx: TenantTransactionClient,
    tenantId: string,
    documentVersionId: string,
    extractionResultId: string,
    entityType: string
  ): Promise<MatchingResult | null>;

  /**
   * Update matching result with manual confirmation.
   */
  updateConfirmationTx(
    tx: TenantTransactionClient,
    tenantId: string,
    matchingResultId: string,
    update: {
      status: string;
      manuallyConfirmed: boolean;
      confirmedCandidateId: string | null;
      confirmedByUserId: string;
      confirmedAt: Date;
    }
  ): Promise<MatchingResult>;
}

/**
 * Repository interface for MatchingCandidate persistence and queries.
 */
export interface IMatchingCandidateRepository {
  /**
   * Get all candidates for a matching result.
   */
  getByMatchingResultTx(
    tx: TenantTransactionClient,
    tenantId: string,
    matchingResultId: string
  ): Promise<MatchingCandidate[]>;

  /**
   * Get a single candidate by ID with tenant scoping.
   */
  getByIdTx(
    tx: TenantTransactionClient,
    tenantId: string,
    candidateId: string
  ): Promise<MatchingCandidate | null>;

  /**
   * Verify that a candidate belongs to a specific matching result.
   * Used for security validation before confirmation.
   */
  verifyOwnershipTx(
    tx: TenantTransactionClient,
    tenantId: string,
    matchingResultId: string,
    candidateId: string
  ): Promise<boolean>;
}

/**
 * PostgreSQL implementation of MatchingResultRepository.
 */
export class PostgresMatchingResultRepository implements IMatchingResultRepository {
  async getByIdTx(
    tx: TenantTransactionClient,
    tenantId: string,
    matchingResultId: string
  ): Promise<MatchingResult | null> {
    return await tx.matchingResult.findFirst({
      where: {
        tenantId,
        id: matchingResultId,
      },
    });
  }

  async getByCompositeTx(
    tx: TenantTransactionClient,
    tenantId: string,
    documentVersionId: string,
    extractionResultId: string,
    entityType: string
  ): Promise<MatchingResult | null> {
    return await tx.matchingResult.findUnique({
      where: {
        tenantId_documentVersionId_extractionResultId_entityType: {
          tenantId,
          documentVersionId,
          extractionResultId,
          entityType,
        },
      },
    });
  }

  async updateConfirmationTx(
    tx: TenantTransactionClient,
    tenantId: string,
    matchingResultId: string,
    update: {
      status: string;
      manuallyConfirmed: boolean;
      confirmedCandidateId: string | null;
      confirmedByUserId: string;
      confirmedAt: Date;
    }
  ): Promise<MatchingResult> {
    return await tx.matchingResult.update({
      where: {
        tenantId_id: { tenantId, id: matchingResultId },
      },
      data: {
        status: update.status as any,
        manuallyConfirmed: update.manuallyConfirmed,
        confirmedCandidateId: update.confirmedCandidateId,
        confirmedByUserId: update.confirmedByUserId,
        confirmedAt: update.confirmedAt,
      },
    });
  }
}

/**
 * PostgreSQL implementation of MatchingCandidateRepository.
 */
export class PostgresMatchingCandidateRepository implements IMatchingCandidateRepository {
  async getByMatchingResultTx(
    tx: TenantTransactionClient,
    tenantId: string,
    matchingResultId: string
  ): Promise<MatchingCandidate[]> {
    return await tx.matchingCandidate.findMany({
      where: {
        tenantId,
        matchingResultId,
      },
      orderBy: {
        ranking: 'asc',
      },
    });
  }

  async getByIdTx(
    tx: TenantTransactionClient,
    tenantId: string,
    candidateId: string
  ): Promise<MatchingCandidate | null> {
    return await tx.matchingCandidate.findFirst({
      where: {
        tenantId,
        id: candidateId,
      },
    });
  }

  async verifyOwnershipTx(
    tx: TenantTransactionClient,
    tenantId: string,
    matchingResultId: string,
    candidateId: string
  ): Promise<boolean> {
    const candidate = await tx.matchingCandidate.findFirst({
      where: {
        tenantId,
        id: candidateId,
        matchingResultId,
      },
      select: { id: true },
    });
    return !!candidate;
  }
}

/**
 * Service for loading and enriching matching results with entity data.
 * Combines database records with Student/Employee info for UI display.
 */
export class MatchingResultService {
  constructor(
    private resultRepo: IMatchingResultRepository,
    private candidateRepo: IMatchingCandidateRepository,
    private tx: TenantTransactionClient
  ) {}

  /**
   * Load a complete matching result with candidates and entity details.
   */
  async loadWithCandidates(
    tenantId: string,
    matchingResultId: string
  ): Promise<MatchingResultWithCandidatesDTO | null> {
    const result = await this.resultRepo.getByIdTx(this.tx, tenantId, matchingResultId);
    if (!result) return null;

    const candidates = await this.candidateRepo.getByMatchingResultTx(
      this.tx,
      tenantId,
      matchingResultId
    );

    // Enrich candidates with entity data
    const enrichedCandidates: MatchingCandidateDTO[] = await Promise.all(
      candidates.map((c) => this.enrichCandidate(tenantId, c))
    );

    return {
      id: result.id,
      documentId: result.documentId,
      documentVersionId: result.documentVersionId,
      extractionResultId: result.extractionResultId,
      entityType: result.entityType as 'STUDENT' | 'EMPLOYEE',
      extractedValue: result.extractedValue,
      status: result.status,
      confidenceScore: result.confidenceScore ? Number(result.confidenceScore) : null,
      matchingReason: result.matchingReason,
      manuallyConfirmed: result.manuallyConfirmed,
      confirmedCandidateId: result.confirmedCandidateId,
      confirmedByUserId: result.confirmedByUserId,
      confirmedAt: result.confirmedAt?.toISOString() || null,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      candidates: enrichedCandidates,
    };
  }

  private async enrichCandidate(
    tenantId: string,
    candidate: MatchingCandidate
  ): Promise<MatchingCandidateDTO> {
    let candidateInfo: CandidateInfo;

    if (candidate.entityType === 'STUDENT') {
      const student = await this.tx.student.findFirst({
        where: {
          tenantId,
          id: candidate.matchedEntityId,
        },
        select: {
          id: true,
          fullName: true,
          nisn: true,
          nis: true,
          className: true,
        },
      });
      if (!student) {
        throw new Error(`SECURITY ERROR: Student ${candidate.matchedEntityId} not found in tenant`);
      }
      candidateInfo = student as StudentCandidateInfo;
    } else {
      const employee = await this.tx.employee.findFirst({
        where: {
          tenantId,
          id: candidate.matchedEntityId,
        },
        select: {
          id: true,
          fullName: true,
          nip: true,
          nik: true,
          nrk: true,
          jabatan: true,
          unitKerja: true,
        },
      });
      if (!employee) {
        throw new Error(`SECURITY ERROR: Employee ${candidate.matchedEntityId} not found in tenant`);
      }
      candidateInfo = employee as EmployeeCandidateInfo;
    }

    return {
      id: candidate.id,
      matchingResultId: candidate.matchingResultId,
      matchedEntityId: candidate.matchedEntityId,
      entityType: candidate.entityType as 'STUDENT' | 'EMPLOYEE',
      matchedField: candidate.matchedField,
      candidateScore: candidate.candidateScore ? Number(candidate.candidateScore) : null,
      candidateReason: candidate.candidateReason,
      ranking: candidate.ranking,
      candidateInfo,
    };
  }
}
