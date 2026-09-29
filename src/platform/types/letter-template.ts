/**
 * Banyubiru — Letter Template Foundation Contracts (P0-D)
 *
 * Fondasi Template Surat sebagai sumber template dokumen keluaran Banyubiru
 * yang terhubung dengan data Master Siswa, Guru & Karyawan, Dokumen Ekstraksi,
 * dan Data Sekolah/Tenant.
 */

export type LetterTemplateVariableSource =
  | 'SISWA'
  | 'GURU_KARYAWAN'
  | 'DOKUMEN_EKSTRAKSI'
  | 'SEKOLAH';

export interface LetterTemplateVariableDefinition {
  key: string;
  label: string;
  source: LetterTemplateVariableSource;
  contohNilai?: string;
}

/**
 * Katalog variabel kanonikal yang didukung Banyubiru untuk pengisian template surat.
 */
export const CANONICAL_LETTER_VARIABLES: LetterTemplateVariableDefinition[] = [
  // Sumber Data: Siswa
  { key: 'siswa.nama_lengkap', label: 'Nama Lengkap Siswa', source: 'SISWA', contohNilai: 'Ahmad Dahlan' },
  { key: 'siswa.nisn', label: 'NISN Siswa', source: 'SISWA', contohNilai: '0012345678' },
  { key: 'siswa.nis', label: 'NIS Siswa', source: 'SISWA', contohNilai: '20240001' },
  { key: 'siswa.kelas', label: 'Kelas / Rombel', source: 'SISWA', contohNilai: 'X RPL 1' },
  { key: 'siswa.status', label: 'Status Siswa', source: 'SISWA', contohNilai: 'Aktif' },

  // Sumber Data: Guru & Karyawan
  { key: 'guru.nama_lengkap', label: 'Nama Lengkap Guru / Karyawan', source: 'GURU_KARYAWAN', contohNilai: 'Drs. Bambang Hidayat, M.Pd' },
  { key: 'guru.nip', label: 'NIP Guru / Karyawan', source: 'GURU_KARYAWAN', contohNilai: '198501012010011001' },
  { key: 'guru.nik', label: 'NIK Guru / Karyawan', source: 'GURU_KARYAWAN', contohNilai: '3171010101850001' },
  { key: 'guru.jabatan', label: 'Jabatan Resmi', source: 'GURU_KARYAWAN', contohNilai: 'Guru Madya' },
  { key: 'guru.unit_kerja', label: 'Unit Kerja', source: 'GURU_KARYAWAN', contohNilai: 'SMKN 1 Jakarta' },
  { key: 'guru.status_kepegawaian', label: 'Status Kepegawaian', source: 'GURU_KARYAWAN', contohNilai: 'PNS' },

  // Sumber Data: Hasil Ekstraksi Dokumen
  { key: 'dokumen.nomor_surat', label: 'Nomor Surat Terdeteksi', source: 'DOKUMEN_EKSTRAKSI', contohNilai: '421/102/SMK/2026' },
  { key: 'dokumen.tanggal_surat', label: 'Tanggal Surat Terdeteksi', source: 'DOKUMEN_EKSTRAKSI', contohNilai: '28 September 2026' },
  { key: 'dokumen.perihal', label: 'Perihal Dokumen', source: 'DOKUMEN_EKSTRAKSI', contohNilai: 'Permohonan Praktik Kerja Lapangan' },
  { key: 'dokumen.kategori', label: 'Kategori Dokumen', source: 'DOKUMEN_EKSTRAKSI', contohNilai: 'SURAT_PERMOHONAN' },

  // Sumber Data: Sekolah / Tenant
  { key: 'sekolah.nama', label: 'Nama Sekolah', source: 'SEKOLAH', contohNilai: 'SMK Negeri 1 Jakarta' },
  { key: 'sekolah.kode', label: 'Kode Sekolah / Tenant', source: 'SEKOLAH', contohNilai: 'SMKN1-JKT' },
];

export interface LetterTemplateRecordDTO {
  id: string;
  tenantId: string;
  kodeTemplate: string;
  namaTemplate: string;
  jenisSurat: string;
  isiTemplate: string;
  variabel: string[];
  isActive: boolean;
  statusLabel: 'Aktif' | 'Tidak Aktif';
  createdAt: string;
  updatedAt: string;
}

export interface LetterTemplateFilterDTO {
  search?: string;
  jenisSurat?: string;
  isActive?: boolean;
}
