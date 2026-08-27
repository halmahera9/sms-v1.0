import { Student } from '@prisma/client';
import { TenantTransactionClient } from '../db/tenant-context';
import { BasePostgresRepository } from './postgres-base';

export class PostgresStudentRepository extends BasePostgresRepository<Student> {
  public async findByIdTx(tx: TenantTransactionClient, id: string): Promise<Student | null> {
    return await tx.student.findUnique({
      where: { id },
    });
  }

  public async findAllTx(tx: TenantTransactionClient): Promise<Student[]> {
    return await tx.student.findMany();
  }

  public async saveTx(tx: TenantTransactionClient, tenantId: string, entity: Student): Promise<Student> {
    // Application-level invariant check
    this.assertTenantConsistency(entity, tenantId);

    // Create payload includes tenantId
    const createPayload = {
      id: entity.id,
      tenantId: entity.tenantId,
      nisn: entity.nisn,
      nis: entity.nis,
      fullName: entity.fullName,
      className: entity.className,
      jurusan: entity.jurusan ?? null,
      status: entity.status,
    };

    // Update payload EXCLUDES tenantId to ensure tenantId immutability during update
    const updatePayload = {
      nisn: entity.nisn,
      nis: entity.nis,
      fullName: entity.fullName,
      className: entity.className,
      jurusan: entity.jurusan ?? null,
      status: entity.status,
    };

    return await tx.student.upsert({
      where: { id: entity.id },
      create: createPayload,
      update: updatePayload,
    });
  }

  public async saveAllTx(tx: TenantTransactionClient, tenantId: string, entities: Student[]): Promise<Student[]> {
    const savedStudents: Student[] = [];
    for (const entity of entities) {
      const saved = await this.saveTx(tx, tenantId, entity);
      savedStudents.push(saved);
    }
    return savedStudents;
  }

  public async deleteTx(tx: TenantTransactionClient, id: string): Promise<boolean> {
    try {
      await tx.student.delete({
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
}
