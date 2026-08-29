import 'server-only';
import { AuditEvent } from '../types';
import {
  IAuditEventRepository,
  PostgresAuditEventRepository,
  AuditEventInput,
} from '../repositories/audit-event';

/**
 * Isolated in-memory audit adapter for tests, client mock buffers, or non-persisted contexts.
 * Explicitly isolated: never silently activated in production database transactions.
 */
export class InMemoryAuditAdapter {
  private events: AuditEvent[] = [];

  constructor(initialEvents: AuditEvent[] = []) {
    this.events = [...initialEvents];
  }

  public record(params: {
    actor: string;
    action: string;
    entityType: string;
    entityId: string;
    beforeState?: unknown;
    afterState?: unknown;
    metadata?: Record<string, unknown>;
  }): AuditEvent {
    const event: AuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      actor: params.actor || 'system',
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      beforeState: params.beforeState ? JSON.parse(JSON.stringify(params.beforeState)) : undefined,
      afterState: params.afterState ? JSON.parse(JSON.stringify(params.afterState)) : undefined,
      metadata: params.metadata,
    };
    this.events.unshift(event);
    return event;
  }

  public getAll(): AuditEvent[] {
    return [...this.events];
  }

  public getFiltered(filter?: {
    entityType?: string;
    entityId?: string;
    actor?: string;
    action?: string;
  }): AuditEvent[] {
    if (!filter) return [...this.events];
    return this.events.filter((e) => {
      if (filter.entityType && e.entityType !== filter.entityType) return false;
      if (filter.entityId && e.entityId !== filter.entityId) return false;
      if (filter.actor && e.actor !== filter.actor) return false;
      if (filter.action && e.action !== filter.action) return false;
      return true;
    });
  }
}

/**
 * PlatformAuditEngine provides the platform-level audit interface.
 * Production persistence is backed by IAuditEventRepository (PostgreSQL audit_events).
 */
export class PlatformAuditEngine {
  private readonly memoryAdapter: InMemoryAuditAdapter;

  constructor(
    private readonly auditRepo: IAuditEventRepository = new PostgresAuditEventRepository(),
    initialEvents: AuditEvent[] = []
  ) {
    this.memoryAdapter = new InMemoryAuditAdapter(initialEvents);
  }

  // --- Synchronous in-memory accessors (for UI / client component buffers) ---

  public recordEvent(params: {
    actor: string;
    action: string;
    entityType: string;
    entityId: string;
    beforeState?: unknown;
    afterState?: unknown;
    metadata?: Record<string, unknown>;
  }): AuditEvent {
    return this.memoryAdapter.record(params);
  }

  public getEvents(filter?: {
    entityType?: string;
    entityId?: string;
    actor?: string;
    action?: string;
  }): AuditEvent[] {
    return this.memoryAdapter.getFiltered(filter);
  }

  public getAllEvents(): AuditEvent[] {
    return this.memoryAdapter.getAll();
  }

  // --- Context-bound Persistent Entrypoints (Production database path) ---

  public async recordEventInContext(
    actorId: string,
    tenantId: string,
    params: AuditEventInput
  ): Promise<AuditEvent> {
    const recordMethod =
      'recordInContext' in this.auditRepo && typeof (this.auditRepo as any).recordInContext === 'function'
        ? (this.auditRepo as PostgresAuditEventRepository).recordInContext.bind(this.auditRepo)
        : null;

    let recorded: AuditEvent;
    if (recordMethod) {
      recorded = await recordMethod(actorId, tenantId, params);
    } else {
      throw new Error('IAuditEventRepository implementation does not support context-bound recording');
    }

    this.memoryAdapter.record({
      actor: recorded.actor,
      action: recorded.action,
      entityType: recorded.entityType,
      entityId: recorded.entityId,
      beforeState: recorded.beforeState,
      afterState: recorded.afterState,
      metadata: recorded.metadata,
    });
    return recorded;
  }

  public async getRecentEventsInContext(
    actorId: string,
    tenantId: string,
    limit?: number
  ): Promise<AuditEvent[]> {
    if ('findRecentInContext' in this.auditRepo && typeof (this.auditRepo as any).findRecentInContext === 'function') {
      return await (this.auditRepo as PostgresAuditEventRepository).findRecentInContext(
        actorId,
        tenantId,
        limit
      );
    }
    return this.memoryAdapter.getAll().slice(0, limit || 50);
  }

  public async getEventsByEntityInContext(
    actorId: string,
    tenantId: string,
    entityType: string,
    entityId: string
  ): Promise<AuditEvent[]> {
    if ('findByEntityInContext' in this.auditRepo && typeof (this.auditRepo as any).findByEntityInContext === 'function') {
      return await (this.auditRepo as PostgresAuditEventRepository).findByEntityInContext(
        actorId,
        tenantId,
        entityType,
        entityId
      );
    }
    return this.memoryAdapter.getFiltered({ entityType, entityId });
  }
}
