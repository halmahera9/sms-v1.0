export interface Student {
  id: string;
  nisn: string;
  nis?: string;
  name: string;
  class: string;
  gender?: 'L' | 'P';
  status: 'Aktif' | 'Nonaktif';
}

export type AbsenceStatus = 'Sakit' | 'Izin' | 'Alpha' | 'Hadir';

export interface ExtractedItem {
  id: string;
  ocrText: string;
  matchedStudentId?: string;
  matchedStudentName?: string;
  matchedNisn?: string;
  confidence: number; // 0 to 100
  class: string;
  date: string;
  status: AbsenceStatus;
  notes?: string;
  verificationStatus: 'pending' | 'verified' | 'edited' | 'rejected';
}

export interface OCRDocument {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  imageUrl: string;
  status: 'processing' | 'needs_verification' | 'completed';
  extractedCount: number;
  verifiedCount: number;
  items: ExtractedItem[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  operator: string;
  action: string;
  target: string;
  details: string;
}
