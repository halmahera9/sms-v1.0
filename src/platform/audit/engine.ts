import { AuditEvent } from '../types';

export class PlatformAuditEngine {
  private events: AuditEvent[] = [];

  constructor(initialEvents: AuditEvent[] = []) {
    this.events = [...initialEvents];
    this.syncFromStorage();
  }

  private syncFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('banyubiru_sms_audit_logs');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const loaded: AuditEvent[] = parsed.map((item: Record<string, unknown>) => ({
            id: typeof item.id === 'string' ? item.id : `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            timestamp: typeof item.timestamp === 'string' ? item.timestamp : new Date().toISOString(),
            actor: typeof item.actor === 'string' ? item.actor : typeof item.operator === 'string' ? item.operator : 'system',
            action: typeof item.action === 'string' ? item.action : 'UNKNOWN',
            entityType: typeof item.entityType === 'string' ? item.entityType : typeof item.target === 'string' ? item.target : 'General',
            entityId: typeof item.entityId === 'string' ? item.entityId : typeof item.target === 'string' ? item.target : 'N/A',
            metadata: (item.metadata as Record<string, unknown>) || (item.details ? { details: item.details } : undefined),
          }));

          const existingIds = new Set(this.events.map((e) => e.id));
          loaded.forEach((e) => {
            if (!existingIds.has(e.id)) {
              this.events.push(e);
              existingIds.add(e.id);
            }
          });
        }
      }
    } catch (err) {
      console.warn('Failed to sync audit logs from localStorage', err);
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      const legacyLogs = this.events.map((e) => ({
        id: e.id,
        timestamp: e.timestamp,
        operator: e.actor,
        action: e.action,
        target: e.entityType || e.entityId,
        details: e.metadata?.details || e.action,
      }));
      localStorage.setItem('banyubiru_sms_audit_logs', JSON.stringify(legacyLogs));
    } catch (err) {
      console.warn('Failed to save audit logs to localStorage', err);
    }
  }

  public recordEvent(params: {
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
    this.saveToStorage();
    return event;
  }

  public getEvents(filter?: {
    entityType?: string;
    entityId?: string;
    actor?: string;
    action?: string;
  }): AuditEvent[] {
    this.syncFromStorage();
    if (!filter) return [...this.events];

    return this.events.filter((e) => {
      if (filter.entityType && e.entityType !== filter.entityType) return false;
      if (filter.entityId && e.entityId !== filter.entityId) return false;
      if (filter.actor && e.actor !== filter.actor) return false;
      if (filter.action && e.action !== filter.action) return false;
      return true;
    });
  }

  public getAllEvents(): AuditEvent[] {
    this.syncFromStorage();
    return [...this.events];
  }
}
