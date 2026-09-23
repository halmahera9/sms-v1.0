import type { ExtractedEntity } from '@/platform/types/document-intelligence';

export interface DocumentEntityExtractionResult {
  entities: ExtractedEntity[];
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function addEntity(
  entities: ExtractedEntity[],
  entityType: ExtractedEntity['entityType'],
  rawValue: string,
  confidence: number,
  identifierType?: ExtractedEntity['identifierType'],
): void {
  const value = normalize(rawValue);

  if (!value) return;

  if (
    entities.some(
      (entity) =>
        entity.entityType === entityType &&
        entity.normalizedValue === value,
    )
  ) {
    return;
  }

  entities.push({
    entityType,
    identifierType,
    rawValue: value,
    normalizedValue: value,
    confidence,
  });
}

export function extractDocumentEntities(
  rawText: string,
): DocumentEntityExtractionResult {
  const entities: ExtractedEntity[] = [];

  if (!rawText.trim()) {
    return { entities };
  }

  // NIP: 18 digit ASN identifier.
  for (const match of rawText.matchAll(/\b\d{18}\b/g)) {
    addEntity(entities, 'EMPLOYEE', match[0], 0.98, 'NIP');
  }

  // NRK: commonly 6–10 digit employee identifier.
  for (const match of rawText.matchAll(
    /\b(?:NRK|No\.?\s*NRK)\s*[:\-]?\s*(\d{6,10})\b/gi,
  )) {
    addEntity(entities, 'EMPLOYEE', match[1], 0.95, 'NRK');
  }

  // NISN: 10 digit student identifier.
  for (const match of rawText.matchAll(
    /\b(?:NISN)\s*[:\-]?\s*(\d{10})\b/gi,
  )) {
    addEntity(entities, 'STUDENT', match[1], 0.98, 'NISN');
  }

  // NIS: shorter student identifier, only when explicitly labelled.
  for (const match of rawText.matchAll(
    /\b(?:NIS)\s*[:\-]?\s*(\d{4,12})\b/gi,
  )) {
    addEntity(entities, 'STUDENT', match[1], 0.92, 'NIS');
  }

  // Indonesian date forms.
  for (const match of rawText.matchAll(
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
  )) {
    addEntity(entities, 'DATE', match[0], 0.9);
  }

  return { entities };
}
