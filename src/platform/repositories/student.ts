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

  // --- P0-J: Identity lookup methods (always tenant-scoped) ---

  /** Exact match by NISN within tenant. */
  public async findByNisnTx(
    tx: TenantTransactionClient,
    tenantId: string,
    nisn: string
  ): Promise<Student | null> {
    return await tx.student.findUnique({
      where: { tenantId_nisn: { tenantId, nisn } },
    });
  }

  /** Exact match by NIS within tenant. */
  public async findByNisTx(
    tx: TenantTransactionClient,
    tenantId: string,
    nis: string
  ): Promise<Student | null> {
    return await tx.student.findUnique({
      where: { tenantId_nis: { tenantId, nis } },
    });
  }

  /**
   * Lookup by normalized full name within tenant.
   * Returns all students whose normalized name matches the given value.
   * Normalization (trim + lowercase + collapse whitespace) is applied in-memory
   * to avoid DB-specific function dependencies.
   */
  public async findByNameTx(
    tx: TenantTransactionClient,
    tenantId: string,
    normalizedName: string
  ): Promise<Student[]> {
    const candidates = await tx.student.findMany({
      where: { tenantId },
    });
    return candidates.filter(
      (s) => normalizeIdentifierName(s.fullName) === normalizedName
    );
  }

  // --- CRUD methods ---

  public async saveTx(tx: TenantTransactionClient, tenantId: string, entity: Student): Promise<Student> {
    // Application-level invariant check
    this.assertTenantConsistency(entity, tenantId);

    // Create payload includes tenantId
    const createPayload = {
      id: entity.id,
      tenantId: entity.tenantId,
      nisn: entity.nisn,
      nis: entity.nis,
      nik: entity.nik,
      noKk: entity.noKk,
      jenisKelamin: entity.jenisKelamin,
      tingkatKelas: entity.tingkatKelas,
      agama: entity.agama,
      tanggalMasuk: entity.tanggalMasuk,
      fullName: entity.fullName,
      className: entity.className,
      status: entity.status,
    };

    // Update payload EXCLUDES tenantId to ensure tenantId immutability during update
    const updatePayload = {
      nisn: entity.nisn,
      nis: entity.nis,
      nik: entity.nik,
      noKk: entity.noKk,
      jenisKelamin: entity.jenisKelamin,
      tingkatKelas: entity.tingkatKelas,
      agama: entity.agama,
      tanggalMasuk: entity.tanggalMasuk,
      fullName: entity.fullName,
      className: entity.className,
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

/**
 * Normalize a name for deterministic matching.
 * Applied to both the extracted value and the DB value before comparison.
 * Rule: trim, lowercase, collapse internal whitespace.
 * Exported so it can be imported by document-identity-matcher.
 */
export function normalizeIdentifierName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
