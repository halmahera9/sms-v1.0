import { LocalStorageRepository } from '@/platform/repositories/base';
import { Student, OCRDocument } from './types';

const STORAGE_KEY_STUDENTS = 'banyubiru_sms_students_v1';
const STORAGE_KEY_DOCUMENTS = 'banyubiru_sms_documents_v1';

export class StudentLocalStorageRepository extends LocalStorageRepository<Student> {
  constructor() {
    super(STORAGE_KEY_STUDENTS);
  }

  public generateInitialMockStudents(): Student[] {
    return [
      { id: 'std-1', nisn: '0051234567', nis: '21221001', name: 'Ahmad Dahlan', class: 'X IPA 1', gender: 'L', status: 'Aktif' },
      { id: 'std-2', nisn: '0051234568', nis: '21221002', name: 'Budi Santoso', class: 'X IPA 1', gender: 'L', status: 'Aktif' },
      { id: 'std-3', nisn: '0051234569', nis: '21221003', name: 'Citra Dewi', class: 'X IPA 1', gender: 'P', status: 'Aktif' },
      { id: 'std-4', nisn: '0051234570', nis: '21221004', name: 'Dewi Lestari', class: 'X IPA 2', gender: 'P', status: 'Aktif' },
      { id: 'std-5', nisn: '0051234571', nis: '21221005', name: 'Eko Prasetyo', class: 'X IPA 2', gender: 'L', status: 'Aktif' },
      { id: 'std-6', nisn: '0051234572', nis: '21221006', name: 'Farah Salsabila', class: 'XI IPS 1', gender: 'P', status: 'Aktif' },
      { id: 'std-7', nisn: '0051234573', nis: '21221007', name: 'Gilang Ramadhan', class: 'XI IPS 1', gender: 'L', status: 'Aktif' },
      { id: 'std-8', nisn: '0051234574', nis: '21221008', name: 'Hani Rahmawati', class: 'XII IPA 3', gender: 'P', status: 'Aktif' },
    ];
  }

  public async findAll(): Promise<Student[]> {
    const raw = this.getRawItems();
    if (raw.length === 0) {
      const initial = this.generateInitialMockStudents();
      this.saveRawItems(initial);
      return initial;
    }
    return raw;
  }
}

export class OCRDocumentLocalStorageRepository extends LocalStorageRepository<OCRDocument> {
  constructor() {
    super(STORAGE_KEY_DOCUMENTS);
  }

  public generateInitialMockDocuments(): OCRDocument[] {
    return [
      {
        id: 'doc-ocr-1',
        fileName: 'Surat_Izin_Sakit_Ahmad_Dahlan.png',
        fileSize: 1024 * 650,
        uploadedAt: '2026-08-21T08:30:00Z',
        imageUrl: '/placeholder-doc.png',
        status: 'needs_verification',
        workflowState: 'NEEDS_VERIFICATION',
        extractedCount: 2,
        verifiedCount: 1,
        items: [
          {
            id: 'item-1',
            ocrText: 'Ahmad Dahlan - X IPA 1 - Sakit demam tinggi',
            matchedStudentId: 'std-1',
            matchedStudentName: 'Ahmad Dahlan',
            matchedNisn: '0051234567',
            confidence: 95,
            class: 'X IPA 1',
            date: '2026-08-21',
            status: 'Sakit',
            notes: 'Demam tinggi selama 2 hari',
            verificationStatus: 'verified',
          },
          {
            id: 'item-2',
            ocrText: 'Budi S - X IPA 1 - Izin keluarga',
            matchedStudentId: 'std-2',
            matchedStudentName: 'Budi Santoso',
            matchedNisn: '0051234568',
            confidence: 65, // Below 70% threshold -> Error/Exception trigger
            class: 'X IPA 1',
            date: '2026-08-21',
            status: 'Izin',
            notes: 'Acara keluarga',
            verificationStatus: 'pending',
          },
        ],
      },
    ];
  }

  public async findAll(): Promise<OCRDocument[]> {
    const raw = this.getRawItems();
    if (raw.length === 0) {
      const initial = this.generateInitialMockDocuments();
      this.saveRawItems(initial);
      return initial;
    }
    return raw;
  }
}
