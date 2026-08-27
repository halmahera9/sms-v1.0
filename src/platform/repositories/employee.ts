import { Employee } from '@prisma/client';
import { TenantTransactionClient } from '../db/tenant-context';
import { BasePostgresRepository } from './postgres-base';

export class PostgresEmployeeRepository extends BasePostgresRepository<Employee> {
  public async findByIdTx(tx: TenantTransactionClient, id: string): Promise<Employee | null> {
    return await tx.employee.findUnique({
      where: { id },
    });
  }

  public async findAllTx(tx: TenantTransactionClient): Promise<Employee[]> {
    return await tx.employee.findMany();
  }

  public async saveTx(tx: TenantTransactionClient, tenantId: string, entity: Employee): Promise<Employee> {
    // Application-level invariant check
    this.assertTenantConsistency(entity, tenantId);

    // Create payload includes tenantId
    const createPayload = {
      id: entity.id,
      tenantId: entity.tenantId,
      nip: entity.nip,
      nrk: entity.nrk,
      fullName: entity.fullName,
      gelarDepan: entity.gelarDepan ?? null,
      gelarBelakang: entity.gelarBelakang ?? null,
      jabatan: entity.jabatan,
      unitKerja: entity.unitKerja,
      instansi: entity.instansi,
      statusKepegawaian: entity.statusKepegawaian,
    };

    // Update payload EXCLUDES tenantId to ensure tenantId immutability during update
    const updatePayload = {
      nip: entity.nip,
      nrk: entity.nrk,
      fullName: entity.fullName,
      gelarDepan: entity.gelarDepan ?? null,
      gelarBelakang: entity.gelarBelakang ?? null,
      jabatan: entity.jabatan,
      unitKerja: entity.unitKerja,
      instansi: entity.instansi,
      statusKepegawaian: entity.statusKepegawaian,
    };

    return await tx.employee.upsert({
      where: { id: entity.id },
      create: createPayload,
      update: updatePayload,
    });
  }

  public async saveAllTx(tx: TenantTransactionClient, tenantId: string, entities: Employee[]): Promise<Employee[]> {
    const savedEmployees: Employee[] = [];
    for (const entity of entities) {
      const saved = await this.saveTx(tx, tenantId, entity);
      savedEmployees.push(saved);
    }
    return savedEmployees;
  }

  public async deleteTx(tx: TenantTransactionClient, id: string): Promise<boolean> {
    try {
      await tx.employee.delete({
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
