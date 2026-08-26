import { PlatformValidationEngine } from '@/platform/rules/engine';
import { ValidationRule } from '@/platform/types';
import { Student, ExtractedItem, OCRDocument } from './types';

// Rule 1: Student Identity Rule
export const studentIdentityRule: ValidationRule<Student> = {
  id: 'STUDENT_IDENTITY_RULE',
  name: 'Student Identity Validation Rule',
  severity: 'ERROR',
  validate: (student) => {
    if (!student.name || !student.nisn) {
      return {
        valid: false,
        ruleId: 'STUDENT_IDENTITY_RULE',
        severity: 'ERROR',
        message: 'Nama dan NISN siswa wajib diisi.',
      };
    }

    if (student.nisn.length !== 10 || !/^\d+$/.test(student.nisn)) {
      return {
        valid: false,
        ruleId: 'STUDENT_IDENTITY_RULE',
        severity: 'WARNING',
        message: `Format NISN '${student.nisn}' harus 10 digit angka.`,
      };
    }

    return {
      valid: true,
      ruleId: 'STUDENT_IDENTITY_RULE',
      severity: 'INFO',
      message: 'Identitas siswa valid.',
    };
  },
};

// Rule 2: OCR Extraction Confidence Rule
export const ocrConfidenceRule: ValidationRule<ExtractedItem> = {
  id: 'OCR_CONFIDENCE_RULE',
  name: 'OCR Confidence Threshold Rule',
  severity: 'ERROR',
  validate: (item) => {
    if (!item.matchedStudentId || item.confidence < 70) {
      return {
        valid: false,
        ruleId: 'OCR_CONFIDENCE_RULE',
        severity: 'ERROR',
        message: `Tingkat akurasi ekstraksi OCR (${item.confidence}%) di bawah ambang batas (70%) atau siswa tidak teridentifikasi. Membutuhkan verifikasi manual.`,
        metadata: { confidence: item.confidence, matchedStudentId: item.matchedStudentId },
      };
    }

    return {
      valid: true,
      ruleId: 'OCR_CONFIDENCE_RULE',
      severity: 'INFO',
      message: 'Hasil ekstraksi OCR valid dan terverifikasi otomatis.',
    };
  },
};

// Rule 3: Absence Document Integrity Rule
export const ocrDocumentRule: ValidationRule<OCRDocument> = {
  id: 'OCR_DOCUMENT_INTEGRITY_RULE',
  name: 'OCR Document Integrity Rule',
  severity: 'ERROR',
  validate: (doc) => {
    if (!doc.items || doc.items.length === 0) {
      return {
        valid: false,
        ruleId: 'OCR_DOCUMENT_INTEGRITY_RULE',
        severity: 'ERROR',
        message: 'Dokumen OCR tidak memiliki item ekstraksi ketidakhadiran.',
      };
    }

    const unverifiedItems = doc.items.filter((i) => i.verificationStatus !== 'verified');
    if (unverifiedItems.length > 0) {
      return {
        valid: false,
        ruleId: 'OCR_DOCUMENT_INTEGRITY_RULE',
        severity: 'WARNING',
        message: `Terdapat ${unverifiedItems.length} item ketidakhadiran yang belum terverifikasi.`,
        metadata: { unverifiedCount: unverifiedItems.length },
      };
    }

    return {
      valid: true,
      ruleId: 'OCR_DOCUMENT_INTEGRITY_RULE',
      severity: 'INFO',
      message: 'Seluruh item dalam dokumen terverifikasi.',
    };
  },
};

export const studentValidationEngine = new PlatformValidationEngine<Student>([studentIdentityRule]);
export const ocrItemValidationEngine = new PlatformValidationEngine<ExtractedItem>([ocrConfidenceRule]);
export const ocrDocumentValidationEngine = new PlatformValidationEngine<OCRDocument>([ocrDocumentRule]);
