import * as XLSX from 'xlsx';
import { StudentAbsenceExportRowDTO } from '@/platform/actions/student-export';

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

/**
 * Pure Transformer: Map canonical Server Action DTO rows to Excel sheet row objects.
 */
export function mapDtoRowsToExportRows(
  dtoRows: StudentAbsenceExportRowDTO[]
): StudentAbsenceExportRow[] {
  return dtoRows.map((r, index) => ({
    No: index + 1,
    Tanggal: r.date,
    NISN: r.nisn,
    NIS: r.nis,
    'Nama Siswa': r.studentName,
    Kelas: r.className,
    'Status Absen': r.status,
    'Catatan / Alasan': r.notes,
    'Dokumen Referensi': r.documentReference,
    'Status Verifikasi': r.verificationStatus,
  }));
}

/**
 * Pure XLSX Workbook Generator: Creates formatted XLSX workbook with explicit column widths.
 */
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

/**
 * Client-Side Helper: Triggers browser download for generated XLSX workbook.
 */
export function downloadStudentAbsenceExcel(
  rows: StudentAbsenceExportRow[],
  filename: string
): boolean {
  if (rows.length === 0) {
    return false;
  }

  const wb = createStudentAbsenceWorkbook(rows);
  XLSX.writeFile(wb, filename);
  return true;
}

export const exportStudentAbsenceExcel = downloadStudentAbsenceExcel;
