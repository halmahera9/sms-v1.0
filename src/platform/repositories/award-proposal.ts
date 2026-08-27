import { AwardProposal, ProposalStatus, AwardType, AwardValue } from '@/domains/employee/awards/types';
import { ProposalStatus as PrismaProposalStatus, AwardType as PrismaAwardType } from '@prisma/client';
import { TenantTransactionClient } from '../db/tenant-context';
import { BasePostgresRepository } from './postgres-base';

export type AwardProposalPersistenceModel = AwardProposal & { tenantId: string };

export interface IAwardProposalRepository {
  findByIdTx(
    tx: TenantTransactionClient,
    id: string
  ): Promise<AwardProposal | null>;

  findByEmployeeAndAwardAndYearTx(
    tx: TenantTransactionClient,
    tenantId: string,
    employeeId: string,
    jenisPenghargaan: AwardType,
    tahunUsulan: number
  ): Promise<AwardProposal | null>;

  findByStatusTx(
    tx: TenantTransactionClient,
    status: ProposalStatus
  ): Promise<AwardProposal[]>;

  findAllTx(
    tx: TenantTransactionClient
  ): Promise<AwardProposal[]>;

  saveTx(
    tx: TenantTransactionClient,
    tenantId: string,
    proposal: AwardProposal
  ): Promise<AwardProposal>;

  saveAllTx(
    tx: TenantTransactionClient,
    tenantId: string,
    proposals: AwardProposal[]
  ): Promise<AwardProposal[]>;

  deleteTx(
    tx: TenantTransactionClient,
    id: string
  ): Promise<boolean>;
}

export class PostgresAwardProposalRepository
  extends BasePostgresRepository<AwardProposalPersistenceModel>
  implements IAwardProposalRepository
{
  public async findByIdTx(tx: TenantTransactionClient, id: string): Promise<AwardProposalPersistenceModel | null> {
    const record = await tx.awardProposal.findUnique({
      where: { id },
      include: {
        employee: true,
        documents: {
          include: {
            document: true,
          },
        },
      },
    });

    if (!record) return null;
    return this.mapToDomain(record);
  }

  public async findByEmployeeAndAwardAndYearTx(
    tx: TenantTransactionClient,
    tenantId: string,
    employeeId: string,
    jenisPenghargaan: AwardType,
    tahunUsulan: number
  ): Promise<AwardProposalPersistenceModel | null> {
    const record = await tx.awardProposal.findFirst({
      where: {
        tenantId,
        employeeId,
        jenisPenghargaan: jenisPenghargaan as unknown as PrismaAwardType,
        tahunUsulan,
      },
      include: {
        employee: true,
        documents: {
          include: {
            document: true,
          },
        },
      },
    });

    if (!record) return null;
    return this.mapToDomain(record);
  }

  public async findByStatusTx(tx: TenantTransactionClient, status: ProposalStatus): Promise<AwardProposalPersistenceModel[]> {
    const records = await tx.awardProposal.findMany({
      where: {
        status: status as unknown as PrismaProposalStatus,
      },
      include: {
        employee: true,
        documents: {
          include: {
            document: true,
          },
        },
      },
    });

    return records.map((r) => this.mapToDomain(r));
  }

  public async findAllTx(tx: TenantTransactionClient): Promise<AwardProposalPersistenceModel[]> {
    const records = await tx.awardProposal.findMany({
      include: {
        employee: true,
        documents: {
          include: {
            document: true,
          },
        },
      },
    });

    return records.map((r) => this.mapToDomain(r));
  }

  public async saveTx(
    tx: TenantTransactionClient,
    tenantId: string,
    proposal: AwardProposal
  ): Promise<AwardProposalPersistenceModel> {
    // Application-level invariant check if proposal carries tenantId
    if (proposal.tenantId) {
      this.assertTenantConsistency(proposal, tenantId);
    }

    // Create payload includes tenantId
    const createPayload = {
      id: proposal.id,
      tenantId,
      employeeId: proposal.employeeId,
      jenisPenghargaan: proposal.jenisPenghargaan as unknown as PrismaAwardType,
      tahunUsulan: proposal.tahunUsulan,
      masaKerjaTahun: proposal.masaKerjaTahun,
      masaKerjaBulan: proposal.masaKerjaBulan,
      nilaiUsulan: proposal.nilaiUsulan || null,
      status: proposal.status as unknown as PrismaProposalStatus,
      catatan: proposal.catatan || null,
    };

    // Update payload EXCLUDES tenantId to ensure tenantId immutability during update
    const updatePayload = {
      employeeId: proposal.employeeId,
      jenisPenghargaan: proposal.jenisPenghargaan as unknown as PrismaAwardType,
      tahunUsulan: proposal.tahunUsulan,
      masaKerjaTahun: proposal.masaKerjaTahun,
      masaKerjaBulan: proposal.masaKerjaBulan,
      nilaiUsulan: proposal.nilaiUsulan || null,
      status: proposal.status as unknown as PrismaProposalStatus,
      catatan: proposal.catatan || null,
    };

    const saved = await tx.awardProposal.upsert({
      where: { id: proposal.id },
      create: createPayload,
      update: updatePayload,
      include: {
        employee: true,
        documents: {
          include: {
            document: true,
          },
        },
      },
    });

    return this.mapToDomain(saved);
  }

  public async saveAllTx(
    tx: TenantTransactionClient,
    tenantId: string,
    proposals: AwardProposal[]
  ): Promise<AwardProposalPersistenceModel[]> {
    const savedList: AwardProposalPersistenceModel[] = [];
    for (const proposal of proposals) {
      const saved = await this.saveTx(tx, tenantId, proposal);
      savedList.push(saved);
    }
    return savedList;
  }

  public async deleteTx(tx: TenantTransactionClient, id: string): Promise<boolean> {
    try {
      await tx.awardProposal.delete({
        where: { id },
      });
      return true;
    } catch (err: unknown) {
      // Prisma code P2025 = Record to delete does not exist
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2025'
      ) {
        return false;
      }
      // Security, FK violation, DB error, or trigger error MUST be thrown
      throw err;
    }
  }

  private mapToDomain(record: Record<string, any>): AwardProposalPersistenceModel {
    const emp = record.employee || {};
    return {
      id: record.id,
      tenantId: record.tenantId,
      employeeId: record.employeeId,
      employee: {
        id: emp.id || record.employeeId,
        nip: emp.nip || '',
        nrk: emp.nrk || '',
        nama: emp.fullName || '',
        gelar: [emp.gelarDepan, emp.gelarBelakang].filter(Boolean).join(' ') || undefined,
        jabatan: emp.jabatan || '',
        unitKerja: emp.unitKerja || '',
        perangkatDaerah: emp.instansi || '',
        ukpd: emp.unitKerja || '',
        wilayah: '',
      },
      jenisPenghargaan: record.jenisPenghargaan as AwardType,
      nilaiUsulan: record.nilaiUsulan ? (record.nilaiUsulan as AwardValue) : undefined,
      tahunUsulan: record.tahunUsulan,
      masaKerjaTahun: record.masaKerjaTahun ?? 0,
      masaKerjaBulan: record.masaKerjaBulan ?? 0,
      status: record.status as ProposalStatus,
      catatan: record.catatan || undefined,
      createdAt: record.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: record.updatedAt ? new Date(record.updatedAt).toISOString() : new Date().toISOString(),
      documents: (record.documents || []).map((doc: any) => ({
        id: doc.id,
        proposalId: doc.proposalId,
        requirementCode: doc.requirementCode,
        fileName: doc.document?.title || `${doc.requirementCode}.pdf`,
        fileSize: 1024 * 100,
        fileType: 'application/pdf',
        fileUrl: '#',
        uploadedAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
        verificationStatus: doc.status === 'PASSED' ? 'verified' : doc.status === 'FAILED' ? 'rejected' : 'pending',
        verifiedBy: doc.verifiedByUserId || undefined,
        verifiedAt: doc.verifiedAt ? new Date(doc.verifiedAt).toISOString() : undefined,
        catatan: doc.catatan || undefined,
      })),
    };
  }
}
