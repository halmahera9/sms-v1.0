import { Employee } from '@prisma/client';
import { TenantTransactionClient } from '../db/tenant-context';
import { BasePostgresRepository } from './postgres-base';

export class PostgresEmployeeRepository extends BasePostgresRepository<Employee> {
  public async findByIdTx(tx: TenantTransactionClient, id: string): Promise<Employee | null> {
    return await tx.employee.findUnique({
      where: { id },
    });
  }

  public async findByNipTx(
    tx: TenantTransactionClient,
    tenantId: string,
    nip: string
  ): Promise<Employee | null> {
    return await tx.employee.findUnique({
      where: {
        tenantId_nip: {
          tenantId,
          nip,
        },
      },
    });
  }

  public async findByNrkTx(
    tx: TenantTransactionClient,
    tenantId: string,
    nrk: string
  ): Promise<Employee | null> {
    return await tx.employee.findUnique({
      where: {
        tenantId_nrk: {
          tenantId,
          nrk,
        },
      },
    });
  }

  public async findByNikTx(
    tx: TenantTransactionClient,
    tenantId: string,
    nik: string
  ): Promise<Employee | null> {
    return await tx.employee.findUnique({
      where: {
        tenantId_nik: {
          tenantId,
          nik,
        },
      },
    });
  }

  /**
   * Lookup by normalized full name within tenant.
   * Returns all employees whose normalized name matches the given value.
   * Note: Employee.nip is nullable — do not assume all employees have NIP.
   */
  public async findByNameTx(
    tx: TenantTransactionClient,
    tenantId: string,
    normalizedName: string
  ): Promise<Employee[]> {
    const candidates = await tx.employee.findMany({
      where: { tenantId },
    });
    return candidates.filter(
      (e) => normalizeEmployeeName(e.fullName) === normalizedName
    );
  }

  // --- CRUD methods ---

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
      nip: entity.nip ?? null,
      nrk: entity.nrk,
      nik: entity.nik ?? null,
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
      nip: entity.nip ?? null,
      nrk: entity.nrk,
      nik: entity.nik ?? null,
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

/**
 * Normalize an employee name for deterministic matching.
 * Rule: trim, lowercase, collapse internal whitespace.
 * Exported so it can be imported by document-identity-matcher.
 */
export function normalizeEmployeeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
