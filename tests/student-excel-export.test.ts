import * as XLSX from 'xlsx';
import {
  StudentAbsenceExportRow,
  createStudentAbsenceWorkbook,
  mapDtoRowsToExportRows,
} from '../src/domains/student/export';
import { StudentAbsenceExportRowDTO } from '../src/platform/actions/student-export';

let testCount = 0;
let passCount = 0;

function assert(condition: boolean, message: string) {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`  ✓ Test ${testCount}: ${message}`);
  } else {
    console.error(`  ✗ Test ${testCount} FAILED: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

console.log('=====================================================');
console.log('   BANYUBIRU STUDENT EXCEL EXPORT REGRESSION SUITE  ');
console.log('=====================================================\n');

// 1. Create sample DTO rows
console.log('[1] Testing DTO to Export Row Mapping...');
const sampleDtoRows: StudentAbsenceExportRowDTO[] = [
  {
    no: 1,
    date: '2026-08-28',
    nisn: '0051234567',
    nis: '21221001',
    studentName: 'Ahmad Dahlan',
    className: 'X IPA 1',
    status: 'Sakit',
    notes: 'Demam tinggi 2 hari',
    documentReference: 'Surat_Dokter_Ahmad.pdf',
    verificationStatus: 'Terverifikasi',
  },
  {
    no: 2,
    date: '2026-08-28',
    nisn: '0051234568',
    nis: '21221002',
    studentName: 'Budi Santoso',
    className: 'X IPA 2',
    status: 'Izin',
    notes: 'Urusan keluarga di luar kota',
    documentReference: 'Surat_Izin_Budi.png',
    verificationStatus: 'Terverifikasi',
  },
  {
    no: 3,
    date: '2026-08-28',
    nisn: '0051234570',
    nis: '21221004',
    studentName: 'Doni Pratama',
    className: 'X IPA 1',
    status: 'Dispensasi',
    notes: 'Lomba olimpiade sains nasional',
    documentReference: 'Surat_Tugas_OSN.pdf',
    verificationStatus: 'Terverifikasi',
  },
];

const exportRows: StudentAbsenceExportRow[] = mapDtoRowsToExportRows(sampleDtoRows);
assert(Array.isArray(exportRows), 'Export data rows should be an array');
assert(exportRows.length === 3, 'Export rows count should match input DTO count');

// 2. Create XLSX Workbook
console.log('\n[2] Testing XLSX Workbook Creation...');
const wb = createStudentAbsenceWorkbook(exportRows);
assert(wb !== null && typeof wb === 'object', 'Workbook object should be created');

// 3. Verify Sheet Names
console.log('\n[3] Testing Worksheet Names...');
assert(wb.SheetNames.includes('Rekap_Ketidakhadiran'), 'Worksheet "Rekap_Ketidakhadiran" must exist');

// 4. Programmatically Write and Read Back
console.log('\n[4] Testing Programmatic Write & Read-Back via xlsx library...');
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
const readWb = XLSX.read(buf, { type: 'buffer' });
assert(readWb.SheetNames[0] === 'Rekap_Ketidakhadiran', 'Read back sheet name should match');

const sheet = readWb.Sheets[readWb.SheetNames[0]];
const readRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);

console.log('\n[5] Testing Read-Back Row Count...');
assert(readRows.length === 3, 'Read back row count must match generated row count (3)');

// 6. Verify Headers and Fields
console.log('\n[6] Testing Header Row & Field Contracts...');
const firstRow = readRows[0];
assert(firstRow['No'] !== undefined, 'Header "No" must exist');
assert(firstRow['Tanggal'] !== undefined, 'Header "Tanggal" must exist');
assert(firstRow['NISN'] !== undefined, 'Header "NISN" must exist');
assert(firstRow['NIS'] !== undefined, 'Header "NIS" must exist');
assert(firstRow['Nama Siswa'] !== undefined, 'Header "Nama Siswa" must exist');
assert(firstRow['Kelas'] !== undefined, 'Header "Kelas" must exist');
assert(firstRow['Status Absen'] !== undefined, 'Header "Status Absen" must exist');
assert(firstRow['Catatan / Alasan'] !== undefined, 'Header "Catatan / Alasan" must exist');
assert(firstRow['Dokumen Referensi'] !== undefined, 'Header "Dokumen Referensi" must exist');
assert(firstRow['Status Verifikasi'] !== undefined, 'Header "Status Verifikasi" must exist');

// 7. Verify Cell Values Match Source Data
console.log('\n[7] Testing Cell Values Match Source Data...');
assert(firstRow['NISN'] === '0051234567', 'NISN should match source data (0051234567)');
assert(firstRow['NIS'] === '21221001', 'NIS should match source data (21221001)');
assert(firstRow['Nama Siswa'] === 'Ahmad Dahlan', 'Nama Siswa should match source data (Ahmad Dahlan)');
assert(firstRow['Status Absen'] === 'Sakit', 'Status Absen should match source data (Sakit)');
assert(firstRow['Status Verifikasi'] === 'Terverifikasi', 'Status Verifikasi should be "Terverifikasi"');

// 8. Verify Dispensasi Support in Excel output
console.log('\n[8] Testing Dispensasi Support in Workbook...');
const thirdRow = readRows[2];
assert(thirdRow['Status Absen'] === 'Dispensasi', 'Status Absen should support "Dispensasi"');

console.log('\n=====================================================');
console.log(` SUCCESS: All ${passCount}/${testCount} Student Excel Export tests passed! `);
console.log('=====================================================\n');
