/**
 * Generic Document Taxonomy & Schema Configuration (Banyubiru Document Intelligence)
 *
 * Defines declarative metadata schemas for school documents (KK, KTP, Akta, Ijazah, etc.)
 * decoupled from the relational database table definitions.
 */

export interface DocumentFieldSchema {
  key: string;
  label: string;
  description?: string;
  required?: boolean;
  type?: 'string' | 'date' | 'number';
}

export interface DocumentTaxonomyDefinition {
  type: string;
  name: string;
  description: string;
  fields: DocumentFieldSchema[];
}

export const DOCUMENT_TAXONOMY: Record<string, DocumentTaxonomyDefinition> = {
  KARTU_KELUARGA: {
    type: 'KARTU_KELUARGA',
    name: 'Kartu Keluarga (KK)',
    description: 'Dokumen kependudukan Kartu Keluarga untuk verifikasi data keluarga dan siswa',
    fields: [
      { key: 'nomor_kk', label: 'Nomor KK', required: true },
      { key: 'nama', label: 'Nama Lengkap', required: true },
      { key: 'nik', label: 'NIK', required: true },
      { key: 'alamat', label: 'Alamat' },
      { key: 'tanggal_lahir', label: 'Tanggal Lahir' },
    ],
  },
  KTP: {
    type: 'KTP',
    name: 'Kartu Tanda Penduduk (KTP)',
    description: 'Identitas resmi penduduk untuk orang tua/wali atau pegawai',
    fields: [
      { key: 'nik', label: 'NIK', required: true },
      { key: 'nama', label: 'Nama Lengkap', required: true },
      { key: 'tempat_lahir', label: 'Tempat Lahir' },
      { key: 'tanggal_lahir', label: 'Tanggal Lahir' },
      { key: 'alamat', label: 'Alamat' },
    ],
  },
  AKTA_KELAHIRAN: {
    type: 'AKTA_KELAHIRAN',
    name: 'Akta Kelahiran',
    description: 'Akta kelahiran resmi untuk verifikasi data kelahiran dan nasab siswa',
    fields: [
      { key: 'nama_anak', label: 'Nama Anak', required: true },
      { key: 'nik', label: 'NIK' },
      { key: 'nama_orang_tua', label: 'Nama Orang Tua' },
      { key: 'tanggal_lahir', label: 'Tanggal Lahir' },
    ],
  },
  IJAZAH: {
    type: 'IJAZAH',
    name: 'Ijazah / Sertifikat',
    description: 'Bukti kelulusan dan sertifikasi pendidikan formal/nonformal',
    fields: [
      { key: 'nomor_dokumen', label: 'Nomor Dokumen', required: true },
      { key: 'nama', label: 'Nama Lengkap', required: true },
      { key: 'tanggal', label: 'Tanggal Dokumen' },
      { key: 'institusi', label: 'Nama Institusi / Sekolah' },
    ],
  },
  SERTIFIKAT: {
    type: 'SERTIFIKAT',
    name: 'Sertifikat Prestasi / Pelatihan',
    description: 'Sertifikat penghargaan, kompetisi, atau pelatihan',
    fields: [
      { key: 'nomor_dokumen', label: 'Nomor Dokumen' },
      { key: 'nama', label: 'Nama Penerima', required: true },
      { key: 'judul', label: 'Judul / Kegiatan' },
      { key: 'tanggal', label: 'Tanggal' },
      { key: 'institusi', label: 'Penyelenggara' },
    ],
  },
  RAPOR: {
    type: 'RAPOR',
    name: 'Buku Rapor Siswa',
    description: 'Laporan capaian hasil belajar siswa',
    fields: [
      { key: 'nisn', label: 'NISN', required: true },
      { key: 'nama', label: 'Nama Siswa', required: true },
      { key: 'kelas', label: 'Kelas' },
      { key: 'semester', label: 'Semester' },
      { key: 'tahun_ajaran', label: 'Tahun Ajaran' },
    ],
  },
};

/**
 * Resolves fields expected for a given document type name or alias.
 */
export function getDocumentFieldSchema(documentType: string): DocumentFieldSchema[] {
  const normalized = documentType.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return DOCUMENT_TAXONOMY[normalized]?.fields || [];
}
