import * as XLSX from 'xlsx';
import { getStoredDocuments, getStoredStudents, addAuditLog } from '@/lib/storage';

export interface StudentAbsenceExportRow {
  No: number;
  Tanggal: string;
  NISN: string;
  NIS: string;
  'Nama Siswa': string;
  Kelas: string;
  'Status Absen': string;
  'Catatan / Alasan': string;
  'Dokumen Referensi': string;
  'Status Verifikasi': string;
}

export function generateStudentAbsenceExportData(
  selectedClass: string = 'Semua',
  verifiedOnly: boolean = true
): { rows: StudentAbsenceExportRow[]; filename: string; totalVerifiedCount: number } {
  const docs = getStoredDocuments();
  const students = getStoredStudents();

  const rows: StudentAbsenceExportRow[] = [];

  docs.forEach((doc) => {
    (doc.items || []).forEach((item) => {
      const isVerified = item.verificationStatus === 'verified' || item.verificationStatus === 'edited';

      if (verifiedOnly && !isVerified) {
        return; // Exclude unverified records per business rule
      }

      if (selectedClass !== 'Semua' && item.class !== selectedClass) {
        return;
      }

      const matchedStudent = students.find(
        (s) => s.id === item.matchedStudentId || s.nisn === item.matchedNisn
      );

      rows.push({
        No: rows.length + 1,
        Tanggal: item.date,
        NISN: matchedStudent?.nisn || item.matchedNisn || '—',
        NIS: matchedStudent?.nis || '—',
        'Nama Siswa': matchedStudent?.name || item.matchedStudentName || item.ocrText,
        Kelas: matchedStudent?.class || item.class,
        'Status Absen': item.status,
        'Catatan / Alasan': item.notes || '—',
        'Dokumen Referensi': doc.fileName,
        'Status Verifikasi': isVerified ? 'Terverifikasi' : 'Belum Verifikasi',
      });
    });
  });

  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `Rekap_SMS_Ketidakhadiran_${dateStr}.xlsx`;

  return { rows, filename, totalVerifiedCount: rows.length };
}

export function createStudentAbsenceWorkbook(
  rows: StudentAbsenceExportRow[]
): XLSX.WorkBook {
  const ws = XLSX.utils.json_to_sheet(rows);

  // Set explicit column widths for clean readability across viewers
  ws['!cols'] = [
    { wch: 6 },  // No
    { wch: 14 }, // Tanggal
    { wch: 16 }, // NISN
    { wch: 12 }, // NIS
    { wch: 28 }, // Nama Siswa
    { wch: 12 }, // Kelas
    { wch: 16 }, // Status Absen
    { wch: 32 }, // Catatan / Alasan
    { wch: 36 }, // Dokumen Referensi
    { wch: 18 }, // Status Verifikasi
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap_Ketidakhadiran');
  return wb;
}

export function exportStudentAbsenceExcel(selectedClass: string = 'Semua'): boolean {
  const { rows, filename } = generateStudentAbsenceExportData(selectedClass, true);

  if (rows.length === 0) {
    return false;
  }

  const wb = createStudentAbsenceWorkbook(rows);
  XLSX.writeFile(wb, filename);

  addAuditLog(
    'Operator Workspace',
    'EXPORT_EXCEL',
    filename,
    `Mengekspor ${rows.length} data rekap ketidakhadiran siswa terverifikasi.`
  );

  return true;
}
