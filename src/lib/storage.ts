import { Student, OCRDocument, AuditLog, ExtractedItem } from '@/types/sms';
import { findBestStudentMatch } from './fuzzy';

const STORAGE_KEYS = {
  STUDENTS: 'banyubiru_sms_students',
  DOCUMENTS: 'banyubiru_sms_documents',
  AUDIT_LOGS: 'banyubiru_sms_audit_logs',
};

// Initial Seed Master Data Siswa (Indonesian School Context)
export const SEED_STUDENTS: Student[] = [
  { id: 'std-1', nisn: '0054819201', nis: '21221001', name: 'Ahmad Fauzan', class: '9A', gender: 'L', status: 'Aktif' },
  { id: 'std-2', nisn: '0054819202', nis: '21221002', name: 'Anisa Rahmawati', class: '9A', gender: 'P', status: 'Aktif' },
  { id: 'std-3', nisn: '0054819203', nis: '21221003', name: 'Budi Santoso', class: '9A', gender: 'L', status: 'Aktif' },
  { id: 'std-4', nisn: '0054819204', nis: '21221004', name: 'Citra Dewi Permata', class: '9A', gender: 'P', status: 'Aktif' },
  { id: 'std-5', nisn: '0054819205', nis: '21221005', name: 'Dini Supriatin', class: '9B', gender: 'P', status: 'Aktif' },
  { id: 'std-6', nisn: '0054819206', nis: '21221006', name: 'Eko Prasetyo', class: '9B', gender: 'L', status: 'Aktif' },
  { id: 'std-7', nisn: '0054819207', nis: '21221007', name: 'Fikri Haikal', class: '9B', gender: 'L', status: 'Aktif' },
  { id: 'std-8', nisn: '0054819208', nis: '21221008', name: 'Gita Gutawa', class: '9B', gender: 'P', status: 'Aktif' },
  { id: 'std-9', nisn: '0054819209', nis: '21221009', name: 'Hendra Setiawan', class: '9C', gender: 'L', status: 'Aktif' },
  { id: 'std-10', nisn: '0054819210', nis: '21221010', name: 'Indah Kusuma', class: '9C', gender: 'P', status: 'Aktif' },
];

export const SEED_DOCUMENTS: OCRDocument[] = [
  {
    id: 'doc-101',
    fileName: 'Daftar_Hadir_Kelas9A_21Aug.jpg',
    fileSize: 1420500,
    uploadedAt: '2026-08-21T08:30:00Z',
    imageUrl: 'https://images.unsplash.com/photo-1584697964400-2af6a2f6204c?auto=format&fit=crop&w=800&q=80',
    status: 'needs_verification',
    extractedCount: 4,
    verifiedCount: 1,
    items: [
      {
        id: 'item-1',
        ocrText: 'Ahmad Fausan',
        matchedStudentId: 'std-1',
        matchedStudentName: 'Ahmad Fauzan',
        matchedNisn: '0054819201',
        confidence: 94,
        class: '9A',
        date: '2026-08-21',
        status: 'Sakit',
        notes: 'Demam berdarah (surat dokter)',
        verificationStatus: 'verified',
      },
      {
        id: 'item-2',
        ocrText: 'Annisa Rahma',
        matchedStudentId: 'std-2',
        matchedStudentName: 'Anisa Rahmawati',
        matchedNisn: '0054819202',
        confidence: 78,
        class: '9A',
        date: '2026-08-21',
        status: 'Izin',
        notes: 'Acara keluarga',
        verificationStatus: 'pending',
      },
      {
        id: 'item-3',
        ocrText: 'Budi Santos',
        matchedStudentId: 'std-3',
        matchedStudentName: 'Budi Santoso',
        matchedNisn: '0054819203',
        confidence: 91,
        class: '9A',
        date: '2026-08-21',
        status: 'Alpha',
        notes: 'Tanpa keterangan',
        verificationStatus: 'pending',
      },
      {
        id: 'item-4',
        ocrText: 'Citra Dewi P',
        matchedStudentId: 'std-4',
        matchedStudentName: 'Citra Dewi Permata',
        matchedNisn: '0054819204',
        confidence: 72,
        class: '9A',
        date: '2026-08-21',
        status: 'Izin',
        notes: 'Lomba pramuka',
        verificationStatus: 'pending',
      }
    ]
  }
];

export const SEED_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    timestamp: '2026-08-21 08:31:12',
    operator: 'Operator TU - Budi',
    action: 'UPLOAD_DOCUMENT',
    target: 'Daftar_Hadir_Kelas9A_21Aug.jpg',
    details: 'Berhasil mengekstraksi 4 nama baris dari foto scan.',
  },
  {
    id: 'log-2',
    timestamp: '2026-08-21 08:35:40',
    operator: 'Operator TU - Budi',
    action: 'VERIFY_ITEM',
    target: 'Ahmad Fauzan (9A)',
    details: 'Verifikasi konfirmasi match 94% status Sakit.',
  }
];

// LocalStorage helpers with SSR safety
export function getStoredStudents(): Student[] {
  if (typeof window === 'undefined') return SEED_STUDENTS;
  const stored = localStorage.getItem(STORAGE_KEYS.STUDENTS);
  if (!stored) {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(SEED_STUDENTS));
    return SEED_STUDENTS;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return SEED_STUDENTS;
  }
}

export function saveStudents(students: Student[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
}

export function getStoredDocuments(): OCRDocument[] {
  if (typeof window === 'undefined') return SEED_DOCUMENTS;
  const stored = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
  if (!stored) {
    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(SEED_DOCUMENTS));
    return SEED_DOCUMENTS;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return SEED_DOCUMENTS;
  }
}

export function saveDocuments(docs: OCRDocument[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
}

export function getStoredAuditLogs(): AuditLog[] {
  if (typeof window === 'undefined') return SEED_AUDIT_LOGS;
  const stored = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
  if (!stored) {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(SEED_AUDIT_LOGS));
    return SEED_AUDIT_LOGS;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return SEED_AUDIT_LOGS;
  }
}

export function addAuditLog(operator: string, action: string, target: string, details: string): void {
  const logs = getStoredAuditLogs();
  const newLog: AuditLog = {
    id: `log-${Date.now()}`,
    timestamp: new Date().toLocaleString('id-ID'),
    operator,
    action,
    target,
    details,
  };
  const updated = [newLog, ...logs];
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(updated));
  }
}
