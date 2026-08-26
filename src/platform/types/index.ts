/**
 * Banyubiru Core Platform Types (Domain-Agnostic)
 */

// Generic Workflow State & Transition
export type WorkflowState = string;
export type WorkflowEvent = string;

export interface WorkflowTransitionDefinition<S extends WorkflowState, E extends WorkflowEvent> {
  from: S | S[];
  to: S;
  event: E;
  name: string;
  description?: string;
  guard?: (context: any) => boolean | { allowed: boolean; reason?: string };
}

export interface WorkflowDefinition<S extends WorkflowState, E extends WorkflowEvent> {
  id: string;
  name: string;
  initialState: S;
  transitions: WorkflowTransitionDefinition<S, E>[];
}

export interface WorkflowTransitionResult<S extends WorkflowState> {
  success: boolean;
  fromState: S;
  toState: S;
  eventId: string;
  reason?: string;
  timestamp: string;
  actor?: string;
}

// Validation & Rule Engine
export type ValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface ValidationResult {
  valid: boolean;
  ruleId: string;
  severity: ValidationSeverity;
  message: string;
  field?: string;
  metadata?: Record<string, any>;
}

export interface ValidationRule<T = any> {
  id: string;
  name: string;
  description?: string;
  severity: ValidationSeverity;
  validate: (entity: T, context?: any) => ValidationResult;
}

// Exception Queue Engine
export type ExceptionStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED';

export interface ExceptionItem {
  id: string;
  entityType: string;
  entityId: string;
  ruleId: string;
  severity: ValidationSeverity;
  status: ExceptionStatus;
  message: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  metadata?: Record<string, any>;
}

// Audit Trail Engine
export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: any;
  afterState?: any;
  metadata?: Record<string, any>;
}

// Generic Repository Pattern
export interface IRepository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<T>;
  saveAll(entities: T[]): Promise<T[]>;
  delete(id: ID): Promise<boolean>;
}
