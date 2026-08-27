import { prisma } from '@/platform/db/prisma';
import { AwardProposal, ProposalStatus, AwardType, AwardValue } from './types';
import { ProposalStatus as PrismaProposalStatus, AwardType as PrismaAwardType, Prisma } from '@prisma/client';

export type TxClient = Prisma.TransactionClient | typeof prisma;

export interface IAwardProposalRepository {
  findById(tenantId: string, id: string, tx?: TxClient): Promise<AwardProposal | null>;
  findByNipAndYear(tenantId: string, nip: string, year: number, tx?: TxClient): Promise<AwardProposal | null>;
  findByStatus(tenantId: string, status: ProposalStatus, tx?: TxClient): Promise<AwardProposal[]>;
  findAll(tenantId: string, tx?: TxClient): Promise<AwardProposal[]>;
  save(tenantId: string, proposal: AwardProposal, tx?: TxClient): Promise<AwardProposal>;
  saveAll(tenantId: string, proposals: AwardProposal[], tx?: TxClient): Promise<AwardProposal[]>;
  delete(tenantId: string, id: string, tx?: TxClient): Promise<boolean>;
}

export class PrismaAwardProposalRepository implements IAwardProposalRepository {
  public async findById(tenantId: string, id: string, tx: TxClient = prisma): Promise<AwardProposal | null> {
    const execute = async (client: TxClient) => {
      const record = await client.awardProposal.findUnique({
        where: {
          tenantId_id: {
            tenantId,
            id,
          },
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
    };

    if (tx === prisma) {
      return await prisma.$transaction(async (innerTx) => {
        await innerTx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', '${tenantId}', true)`);
        return execute(innerTx);
      });
    }
    return execute(tx);
  }

  public async findByNipAndYear(
    tenantId: string,
    nip: string,
    year: number,
    tx: TxClient = prisma
  ): Promise<AwardProposal | null> {
    const execute = async (client: TxClient) => {
      const record = await client.awardProposal.findFirst({
        where: {
          tenantId,
          tahunUsulan: year,
          employee: {
            nip,
          },
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
    };

    if (tx === prisma) {
      return await prisma.$transaction(async (innerTx) => {
        await innerTx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', '${tenantId}', true)`);
        return execute(innerTx);
      });
    }
    return execute(tx);
  }

  public async findByStatus(tenantId: string, status: ProposalStatus, tx: TxClient = prisma): Promise<AwardProposal[]> {
    const execute = async (client: TxClient) => {
      const records = await client.awardProposal.findMany({
        where: {
          tenantId,
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
    };

    if (tx === prisma) {
      return await prisma.$transaction(async (innerTx) => {
        await innerTx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', '${tenantId}', true)`);
        return execute(innerTx);
      });
    }
    return execute(tx);
  }

  public async findAll(tenantId: string, tx: TxClient = prisma): Promise<AwardProposal[]> {
    const execute = async (client: TxClient) => {
      const records = await client.awardProposal.findMany({
        where: { tenantId },
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
    };

    if (tx === prisma) {
      return await prisma.$transaction(async (innerTx) => {
        await innerTx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', '${tenantId}', true)`);
        return execute(innerTx);
      });
    }
    return execute(tx);
  }

  public async save(tenantId: string, proposal: AwardProposal, tx: TxClient = prisma): Promise<AwardProposal> {
    const execute = async (client: TxClient) => {
      const saved = await client.awardProposal.upsert({
        where: {
          tenantId_id: {
            tenantId,
            id: proposal.id,
          },
        },
        create: {
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
        },
        update: {
          jenisPenghargaan: proposal.jenisPenghargaan as unknown as PrismaAwardType,
          tahunUsulan: proposal.tahunUsulan,
          masaKerjaTahun: proposal.masaKerjaTahun,
          masaKerjaBulan: proposal.masaKerjaBulan,
          nilaiUsulan: proposal.nilaiUsulan || null,
          status: proposal.status as unknown as PrismaProposalStatus,
          catatan: proposal.catatan || null,
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

      return this.mapToDomain(saved);
    };

    if (tx === prisma) {
      return await prisma.$transaction(async (innerTx) => {
        await innerTx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', '${tenantId}', true)`);
        return execute(innerTx);
      });
    }
    return execute(tx);
  }

  public async saveAll(tenantId: string, proposals: AwardProposal[], tx: TxClient = prisma): Promise<AwardProposal[]> {
    const savedList: AwardProposal[] = [];
    for (const proposal of proposals) {
      const saved = await this.save(tenantId, proposal, tx);
      savedList.push(saved);
    }
    return savedList;
  }

  public async delete(tenantId: string, id: string, tx: TxClient = prisma): Promise<boolean> {
    const execute = async (client: TxClient) => {
      try {
        await client.awardProposal.delete({
          where: {
            tenantId_id: {
              tenantId,
              id,
            },
          },
        });
        return true;
      } catch (err: unknown) {
        const errorObj = err as { code?: string; message?: string };
        if (
          errorObj?.code === 'P2025' ||
          errorObj?.message?.includes('Record to delete does not exist') ||
          errorObj?.message?.includes('No record was found for a delete')
        ) {
          return false;
        }
        throw err;
      }
    };

    if (tx === prisma) {
      return await prisma.$transaction(async (innerTx) => {
        await innerTx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', '${tenantId}', true)`);
        return execute(innerTx);
      });
    }
    return execute(tx);
  }

  private mapToDomain(record: Record<string, any>): AwardProposal {
    const emp = record.employee || {};
    return {
      id: record.id,
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
