import { ExceptionItem, ExceptionStatus, ValidationResult } from '../types';

export class PlatformExceptionQueue {
  private items: Map<string, ExceptionItem> = new Map();

  constructor(initialItems: ExceptionItem[] = []) {
    initialItems.forEach((item) => this.items.set(item.id, item));
  }

  public createException(params: {
    entityType: string;
    entityId: string;
    ruleId: string;
    severity?: ExceptionItem['severity'];
    message: string;
    metadata?: Record<string, unknown>;
  }): ExceptionItem {
    const id = `exc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const item: ExceptionItem = {
      id,
      entityType: params.entityType,
      entityId: params.entityId,
      ruleId: params.ruleId,
      severity: params.severity || 'ERROR',
      status: 'OPEN',
      message: params.message,
      createdAt: new Date().toISOString(),
      metadata: params.metadata,
    };

    this.items.set(id, item);
    return item;
  }

  public createFromValidationResults(
    entityType: string,
    entityId: string,
    results: ValidationResult[]
  ): ExceptionItem[] {
    const created: ExceptionItem[] = [];
    const invalidResults = results.filter((r) => !r.valid);

    for (const res of invalidResults) {
      const item = this.createException({
        entityType,
        entityId,
        ruleId: res.ruleId,
        severity: res.severity,
        message: res.message,
        metadata: res.metadata,
      });
      created.push(item);
    }
    return created;
  }

  public updateStatus(
    id: string,
    status: ExceptionStatus,
    resolvedBy?: string,
    resolutionNote?: string
  ): ExceptionItem | null {
    const item = this.items.get(id);
    if (!item) return null;

    const updated: ExceptionItem = {
      ...item,
      status,
      resolvedBy: resolvedBy || item.resolvedBy,
      resolutionNote: resolutionNote || item.resolutionNote,
      resolvedAt: status === 'RESOLVED' || status === 'DISMISSED' ? new Date().toISOString() : item.resolvedAt,
    };

    this.items.set(id, updated);
    return updated;
  }

  public getById(id: string): ExceptionItem | undefined {
    return this.items.get(id);
  }

  public getByEntity(entityType: string, entityId: string): ExceptionItem[] {
    return Array.from(this.items.values()).filter(
      (item) => item.entityType === entityType && item.entityId === entityId
    );
  }

  public getAll(): ExceptionItem[] {
    return Array.from(this.items.values());
  }

  public getOpenExceptions(): ExceptionItem[] {
    return Array.from(this.items.values()).filter(
      (item) => item.status === 'OPEN' || item.status === 'IN_REVIEW'
    );
  }
}
