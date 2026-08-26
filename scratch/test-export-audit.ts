import * as XLSX from 'xlsx';
import { getStoredDocuments, getStoredStudents } from '../src/lib/storage';

// 1. Load data sources
const documents = getStoredDocuments();
const students = getStoredStudents();

console.log(`[Audit] Total Documents: ${documents.length}`);
console.log(`[Audit] Total Students in Master Data: ${students.length}`);

// 2. Extract verified items
const verifiedRows: any[] = [];
const unverifiedRows: any[] = [];

documents.forEach((doc) => {
  doc.items.forEach((item) => {
    const matchedStd = students.find(
      (s) => s.id === item.matchedStudentId || s.nisn === item.matchedNisn
    );

    const row = {
      No: verifiedRows.length + 1,
      Tanggal: item.date,
      NISN: matchedStd?.nisn || item.matchedNisn || '—',
      NIS: matchedStd?.nis || '—',
      'Nama Siswa': matchedStd?.name || item.matchedStudentName || item.ocrText,
      Kelas: matchedStd?.class || item.class,
      'Status Absen': item.status,
      'Catatan / Alasan': item.notes || '—',
      'Dokumen Referensi': doc.fileName,
      'Status Verifikasi': 'Terverifikasi',
    };

    if (item.verificationStatus === 'verified' || item.verificationStatus === 'edited') {
      verifiedRows.push(row);
    } else {
      unverifiedRows.push(row);
    }
  });
});

console.log(`[Audit] Verified Records: ${verifiedRows.length}`);
console.log(`[Audit] Unverified Records (Excluded): ${unverifiedRows.length}`);

// 3. Build XLSX workbook with verified records only
const ws = XLSX.utils.json_to_sheet(verifiedRows);

// Set column widths
ws['!cols'] = [
  { wch: 5 },  // No
  { wch: 14 }, // Tanggal
  { wch: 16 }, // NISN
  { wch: 12 }, // NIS
  { wch: 25 }, // Nama Siswa
  { wch: 12 }, // Kelas
  { wch: 16 }, // Status Absen
  { wch: 30 }, // Catatan / Alasan
  { wch: 35 }, // Dokumen Referensi
  { wch: 18 }, // Status Verifikasi
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Rekap_Ketidakhadiran');

// Write to buffer and read back to test
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
const readWb = XLSX.read(buf, { type: 'buffer' });

console.log(`[Audit] Read back sheet names:`, readWb.SheetNames);
const sheet = readWb.Sheets[readWb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);
console.log(`[Audit] Read back row count: ${data.length}`);
console.log(`[Audit] First 5 rows:`, data.slice(0, 5));
