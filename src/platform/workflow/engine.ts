import {
  WorkflowDefinition,
  WorkflowEvent,
  WorkflowState,
  WorkflowTransitionResult,
} from '../types';

export class PlatformWorkflowEngine<S extends WorkflowState, E extends WorkflowEvent> {
  constructor(private definition: WorkflowDefinition<S, E>) {}

  public getDefinition(): WorkflowDefinition<S, E> {
    return this.definition;
  }

  public getAvailableTransitions(currentState: S): E[] {
    return this.definition.transitions
      .filter((t) => (Array.isArray(t.from) ? t.from.includes(currentState) : t.from === currentState))
      .map((t) => t.event);
  }

  public canTransition(
    currentState: S,
    event: E,
    context?: unknown
  ): { allowed: boolean; reason?: string; targetState?: S } {
    const transitionDef = this.definition.transitions.find((t) => {
      const matchFrom = Array.isArray(t.from) ? t.from.includes(currentState) : t.from === currentState;
      return matchFrom && t.event === event;
    });

    if (!transitionDef) {
      return {
        allowed: false,
        reason: `Transition from '${currentState}' with event '${event}' is not allowed in workflow '${this.definition.name}'.`,
      };
    }

    if (transitionDef.guard) {
      const guardResult = transitionDef.guard(context);
      if (typeof guardResult === 'boolean') {
        if (!guardResult) {
          return { allowed: false, reason: `Guard check failed for transition event '${event}'.` };
        }
      } else if (!guardResult.allowed) {
        return { allowed: false, reason: guardResult.reason || `Guard check failed for event '${event}'.` };
      }
    }

    return { allowed: true, targetState: transitionDef.to };
  }

  public transition(
    currentState: S,
    event: E,
    context?: unknown,
    actor: string = 'system'
  ): WorkflowTransitionResult<S> {
    const check = this.canTransition(currentState, event, context);
    const timestamp = new Date().toISOString();

    if (!check.allowed || !check.targetState) {
      return {
        success: false,
        fromState: currentState,
        toState: currentState,
        eventId: event,
        reason: check.reason || 'Invalid transition.',
        timestamp,
        actor,
      };
    }

    return {
      success: true,
      fromState: currentState,
      toState: check.targetState,
      eventId: event,
      timestamp,
      actor,
    };
  }
}
