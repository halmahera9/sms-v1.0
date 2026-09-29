/**
 * P0-J.2 — Manual Matching Confirmation Foundation
 * Domain Type Contracts for Identity Matching Results and Manual Decision Flow
 */

import { MatchingStatus } from '@prisma/client';

/**
 * MatchingResultDTO — Read model for displaying matching results to administrator.
 * Contains extracted value, automatic determination, and manual confirmation state.
 */
export interface MatchingResultDTO {
  id: string;
  documentId: string;
  documentVersionId: string;
  extractionResultId: string;
  entityType: 'STUDENT' | 'EMPLOYEE';
  extractedValue: string;
  status: MatchingStatus;
  confidenceScore: number | null;
  matchingReason: string | null;
  manuallyConfirmed: boolean;
  confirmedCandidateId: string | null;
  confirmedByUserId: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * StudentCandidateInfo — Minimal info for displaying Student match candidate.
 */
export interface StudentCandidateInfo {
  id: string;
  fullName: string;
  nisn: string;
  nis: string;
  className: string;
}

/**
 * EmployeeCandidateInfo — Minimal info for displaying Employee match candidate.
 */
export interface EmployeeCandidateInfo {
  id: string;
  fullName: string;
  nip: string | null;
  nik: string | null;
  nrk: string | null;
  jabatan: string;
  unitKerja: string;
}

export type CandidateInfo = StudentCandidateInfo | EmployeeCandidateInfo;

/**
 * MatchingCandidateDTO — Read model for each candidate in a matching result.
 * Includes ranking, score, reason, and entity-specific info.
 */
export interface MatchingCandidateDTO {
  id: string;
  matchingResultId: string;
  matchedEntityId: string;
  entityType: 'STUDENT' | 'EMPLOYEE';
  matchedField: string;
  candidateScore: number | null;
  candidateReason: string | null;
  ranking: number;
  candidateInfo: CandidateInfo;
}

/**
 * MatchingResultWithCandidatesDTO — Full result including all candidates.
 * Used for reading the complete state of a matching decision.
 */
export interface MatchingResultWithCandidatesDTO extends MatchingResultDTO {
  candidates: MatchingCandidateDTO[];
}

/**
 * ConfirmMatchingCandidateInput — Server Action input for confirming a candidate.
 */
export interface ConfirmMatchingCandidateInput {
  matchingResultId: string;
  candidateId: string;
}

/**
 * ConfirmMatchingCandidateOutput — Server Action response after confirmation.
 */
export interface ConfirmMatchingCandidateOutput {
  matchingResultId: string;
  candidateId: string;
  status: MatchingStatus;
  manuallyConfirmed: boolean;
  confirmedAt: string;
}

/**
 * RejectAllCandidatesInput — Server Action input for rejecting all candidates.
 * ("Tidak Ada yang Cocok" — No matching candidate found)
 */
export interface RejectAllCandidatesInput {
  matchingResultId: string;
}

/**
 * RejectAllCandidatesOutput — Server Action response after rejection.
 */
export interface RejectAllCandidatesOutput {
  matchingResultId: string;
  status: MatchingStatus;
  manuallyConfirmed: boolean;
  confirmedAt: string;
}
