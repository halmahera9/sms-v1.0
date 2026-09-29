import { LetterTemplate, Prisma } from '@prisma/client';
import { TenantTransactionClient } from '../db/tenant-context';
import { BasePostgresRepository } from './postgres-base';

export class PostgresLetterTemplateRepository extends BasePostgresRepository<LetterTemplate> {
  public async findByIdTx(tx: TenantTransactionClient, id: string): Promise<LetterTemplate | null> {
    return await tx.letterTemplate.findUnique({
      where: { id },
    });
  }

  public async findByCodeTx(
    tx: TenantTransactionClient,
    tenantId: string,
    code: string
  ): Promise<LetterTemplate | null> {
    return await tx.letterTemplate.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code,
        },
      },
    });
  }

  public async findAllTx(
    tx: TenantTransactionClient,
    filter?: { isActive?: boolean; letterType?: string }
  ): Promise<LetterTemplate[]> {
    const where: Prisma.LetterTemplateWhereInput = {};
    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }
    if (filter?.letterType) {
      where.letterType = filter.letterType;
    }
    return await tx.letterTemplate.findMany({
      where,
      orderBy: { code: 'asc' },
    });
  }

  public async saveTx(
    tx: TenantTransactionClient,
    tenantId: string,
    entity: LetterTemplate
  ): Promise<LetterTemplate> {
    this.assertTenantConsistency(entity, tenantId);

    const createPayload = {
      id: entity.id,
      tenantId: entity.tenantId,
      code: entity.code,
      name: entity.name,
      letterType: entity.letterType,
      content: entity.content,
      variables: entity.variables as Prisma.InputJsonValue,
      isActive: entity.isActive,
    };

    const updatePayload = {
      code: entity.code,
      name: entity.name,
      letterType: entity.letterType,
      content: entity.content,
      variables: entity.variables as Prisma.InputJsonValue,
      isActive: entity.isActive,
    };

    return await tx.letterTemplate.upsert({
      where: { id: entity.id },
      create: createPayload,
      update: updatePayload,
    });
  }

  public async saveAllTx(
    tx: TenantTransactionClient,
    tenantId: string,
    entities: LetterTemplate[]
  ): Promise<LetterTemplate[]> {
    const savedTemplates: LetterTemplate[] = [];
    for (const entity of entities) {
      const saved = await this.saveTx(tx, tenantId, entity);
      savedTemplates.push(saved);
    }
    return savedTemplates;
  }

  public async deleteTx(tx: TenantTransactionClient, id: string): Promise<boolean> {
    try {
      await tx.letterTemplate.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }
}
