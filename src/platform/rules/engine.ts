import { ValidationRule, ValidationResult } from '../types';

export class PlatformValidationEngine<T = any> {
  private rules: Map<string, ValidationRule<T>> = new Map();

  constructor(rules: ValidationRule<T>[] = []) {
    rules.forEach((r) => this.registerRule(r));
  }

  public registerRule(rule: ValidationRule<T>): void {
    this.rules.set(rule.id, rule);
  }

  public removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  public getRules(): ValidationRule<T>[] {
    return Array.from(this.rules.values());
  }

  public validateEntity(entity: T, context?: any): ValidationResult[] {
    const results: ValidationResult[] = [];
    for (const rule of this.rules.values()) {
      try {
        const res = rule.validate(entity, context);
        results.push(res);
      } catch (err: any) {
        results.push({
          valid: false,
          ruleId: rule.id,
          severity: 'ERROR',
          message: `Rule execution error: ${err?.message || String(err)}`,
        });
      }
    }
    return results;
  }

  public isFullyValid(results: ValidationResult[]): boolean {
    return results.every((r) => r.severity !== 'ERROR' || r.valid);
  }

  public getErrors(results: ValidationResult[]): ValidationResult[] {
    return results.filter((r) => !r.valid && r.severity === 'ERROR');
  }

  public getWarnings(results: ValidationResult[]): ValidationResult[] {
    return results.filter((r) => !r.valid && r.severity === 'WARNING');
  }
}
