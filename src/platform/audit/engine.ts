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
          const loaded: AuditEvent[] = parsed.map((item: any) => ({
            id: item.id || `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            timestamp: item.timestamp || new Date().toISOString(),
            actor: item.actor || item.operator || 'system',
            action: item.action || 'UNKNOWN',
            entityType: item.entityType || item.target || 'General',
            entityId: item.entityId || item.target || 'N/A',
            metadata: item.metadata || (item.details ? { details: item.details } : undefined),
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
    beforeState?: any;
    afterState?: any;
    metadata?: Record<string, any>;
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
