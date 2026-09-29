import { DocumentCategory } from '@prisma/client';

/**
 * Canonical School Document Taxonomy & Metadata Configuration (Banyubiru Document Intelligence)
 *
 * Single source of truth for school document classifications, schemas, and processing flags.
 */

export interface DocumentFieldSchema {
  key: string;
  label: string;
  description?: string;
  required?: boolean;
  type?: 'string' | 'date' | 'number';
}

export interface DocumentTaxonomyDefinition {
  code: DocumentCategory;
  key: DocumentCategory;
  type: DocumentCategory; // Alias for backward compatibility
  displayName: string;
  name: string; // Alias for backward compatibility
  description: string;
  requiresIdentityMatching: boolean;
  requiresHumanVerification: boolean;
  fields: DocumentFieldSchema[];
}

export const DOCUMENT_TAXONOMY: Record<DocumentCategory, DocumentTaxonomyDefinition> = {
  KARTU_KELUARGA: {
    code: DocumentCategory.KARTU_KELUARGA,
    key: DocumentCategory.KARTU_KELUARGA,
    type: DocumentCategory.KARTU_KELUARGA,
    displayName: 'Kartu Keluarga (KK)',
    name: 'Kartu Keluarga (KK)',
    description: 'Dokumen kependudukan Kartu Keluarga untuk verifikasi susunan keluarga dan siswa',
    requiresIdentityMatching: true,
    requiresHumanVerification: true,
    fields: [
      { key: 'nomor_kk', label: 'Nomor KK', required: true },
      { key: 'nama', label: 'Nama Lengkap', required: true },
      { key: 'nik', label: 'NIK', required: true },
      { key: 'alamat', label: 'Alamat' },
      { key: 'tanggal_lahir', label: 'Tanggal Lahir' },
    ],
  },
  KTP: {
    code: DocumentCategory.KTP,
    key: DocumentCategory.KTP,
    type: DocumentCategory.KTP,
    displayName: 'Kartu Tanda Penduduk (KTP)',
    name: 'Kartu Tanda Penduduk (KTP)',
    description: 'Identitas kependudukan resmi untuk orang tua, wali, atau pegawai',
    requiresIdentityMatching: true,
    requiresHumanVerification: true,
    fields: [
      { key: 'nik', label: 'NIK', required: true },
      { key: 'nama', label: 'Nama Lengkap', required: true },
      { key: 'tempat_lahir', label: 'Tempat Lahir' },
      { key: 'tanggal_lahir', label: 'Tanggal Lahir' },
      { key: 'alamat', label: 'Alamat' },
    ],
  },
  AKTA_KELAHIRAN: {
    code: DocumentCategory.AKTA_KELAHIRAN,
    key: DocumentCategory.AKTA_KELAHIRAN,
    type: DocumentCategory.AKTA_KELAHIRAN,
    displayName: 'Akta Kelahiran',
    name: 'Akta Kelahiran',
    description: 'Akta kelahiran resmi untuk verifikasi data kelahiran dan nasab siswa',
    requiresIdentityMatching: true,
    requiresHumanVerification: true,
    fields: [
      { key: 'nama_anak', label: 'Nama Anak', required: true },
      { key: 'nik', label: 'NIK' },
      { key: 'nama_orang_tua', label: 'Nama Orang Tua' },
      { key: 'tanggal_lahir', label: 'Tanggal Lahir' },
    ],
  },
  IJAZAH: {
    code: DocumentCategory.IJAZAH,
    key: DocumentCategory.IJAZAH,
    type: DocumentCategory.IJAZAH,
    displayName: 'Ijazah',
    name: 'Ijazah',
    description: 'Bukti kelulusan dan sertifikasi jenjang pendidikan formal/nonformal',
    requiresIdentityMatching: true,
    requiresHumanVerification: true,
    fields: [
      { key: 'nomor_dokumen', label: 'Nomor Ijazah/Dokumen', required: true },
      { key: 'nama', label: 'Nama Lengkap', required: true },
      { key: 'tanggal', label: 'Tanggal Kelulusan/Penerbitan' },
      { key: 'institusi', label: 'Nama Sekolah / Institusi' },
    ],
  },
  RAPOR: {
    code: DocumentCategory.RAPOR,
    key: DocumentCategory.RAPOR,
    type: DocumentCategory.RAPOR,
    displayName: 'Buku Rapor Siswa',
    name: 'Buku Rapor Siswa',
    description: 'Laporan capaian hasil belajar dan penilaian akademik/karakter siswa',
    requiresIdentityMatching: true,
    requiresHumanVerification: true,
    fields: [
      { key: 'nisn', label: 'NISN', required: true },
      { key: 'nama', label: 'Nama Siswa', required: true },
      { key: 'kelas', label: 'Kelas' },
      { key: 'semester', label: 'Semester' },
      { key: 'tahun_ajaran', label: 'Tahun Ajaran' },
    ],
  },
  SERTIFIKAT: {
    code: DocumentCategory.SERTIFIKAT,
    key: DocumentCategory.SERTIFIKAT,
    type: DocumentCategory.SERTIFIKAT,
    displayName: 'Sertifikat Prestasi / Pelatihan',
    name: 'Sertifikat Prestasi / Pelatihan',
    description: 'Sertifikat penghargaan kejuaraan, pelatihan, atau kompetensi',
    requiresIdentityMatching: false,
    requiresHumanVerification: false,
    fields: [
      { key: 'nomor_dokumen', label: 'Nomor Dokumen' },
      { key: 'nama', label: 'Nama Penerima', required: true },
      { key: 'judul', label: 'Judul / Kegiatan' },
      { key: 'tanggal', label: 'Tanggal' },
      { key: 'institusi', label: 'Penyelenggara' },
    ],
  },
  SURAT_PERNYATAAN: {
    code: DocumentCategory.SURAT_PERNYATAAN,
    key: DocumentCategory.SURAT_PERNYATAAN,
    type: DocumentCategory.SURAT_PERNYATAAN,
    displayName: 'Surat Pernyataan',
    name: 'Surat Pernyataan',
    description: 'Surat pernyataan integritas, tata tertib, atau komitmen orang tua/siswa',
    requiresIdentityMatching: false,
    requiresHumanVerification: true,
    fields: [
      { key: 'nomor_surat', label: 'Nomor Surat' },
      { key: 'nama', label: 'Nama Pembuat Pernyataan', required: true },
      { key: 'perihal', label: 'Perihal' },
      { key: 'tanggal', label: 'Tanggal Surat' },
    ],
  },
  SURAT_PERMOHONAN: {
    code: DocumentCategory.SURAT_PERMOHONAN,
    key: DocumentCategory.SURAT_PERMOHONAN,
    type: DocumentCategory.SURAT_PERMOHONAN,
    displayName: 'Surat Permohonan',
    name: 'Surat Permohonan',
    description: 'Surat permohonan dispensasi, mutasi, beasiswa, atau kebutuhan administratif',
    requiresIdentityMatching: false,
    requiresHumanVerification: true,
    fields: [
      { key: 'nomor_surat', label: 'Nomor Surat' },
      { key: 'nama_pemohon', label: 'Nama Pemohon', required: true },
      { key: 'perihal', label: 'Perihal Permohonan' },
      { key: 'tanggal', label: 'Tanggal Permohonan' },
    ],
  },
  SURAT_TUGAS: {
    code: DocumentCategory.SURAT_TUGAS,
    key: DocumentCategory.SURAT_TUGAS,
    type: DocumentCategory.SURAT_TUGAS,
    displayName: 'Surat Tugas',
    name: 'Surat Tugas',
    description: 'Surat penugasan kedinasan pendidik, tenaga kependidikan, atau perwakilan siswa',
    requiresIdentityMatching: true,
    requiresHumanVerification: true,
    fields: [
      { key: 'nomor_surat', label: 'Nomor Surat Tugas', required: true },
      { key: 'nama_petugas', label: 'Nama Petugas', required: true },
      { key: 'tugas', label: 'Uraian Tugas' },
      { key: 'tanggal', label: 'Tanggal Penugasan' },
    ],
  },
  SURAT_KEPUTUSAN: {
    code: DocumentCategory.SURAT_KEPUTUSAN,
    key: DocumentCategory.SURAT_KEPUTUSAN,
    type: DocumentCategory.SURAT_KEPUTUSAN,
    displayName: 'Surat Keputusan (SK)',
    name: 'Surat Keputusan (SK)',
    description: 'Surat keputusan kepala sekolah atau pejabat pembina kepegawaian sekolah',
    requiresIdentityMatching: false,
    requiresHumanVerification: true,
    fields: [
      { key: 'nomor_sk', label: 'Nomor SK', required: true },
      { key: 'tentang', label: 'Tentang / Perihal SK', required: true },
      { key: 'tanggal_ditetapkan', label: 'Tanggal Penetapan' },
      { key: 'pejabat_penetap', label: 'Pejabat Penetap' },
    ],
  },
  LAINNYA: {
    code: DocumentCategory.LAINNYA,
    key: DocumentCategory.LAINNYA,
    type: DocumentCategory.LAINNYA,
    displayName: 'Dokumen Lainnya',
    name: 'Dokumen Lainnya',
    description: 'Dokumen umum pendukung lainnya di luar kategori baku sekolah',
    requiresIdentityMatching: false,
    requiresHumanVerification: true,
    fields: [],
  },
};

/**
 * Returns taxonomy metadata for a given document category or alias.
 */
export function getDocumentTaxonomy(category: string): DocumentTaxonomyDefinition | undefined {
  const normalized = category.trim().toUpperCase().replace(/[\s-]+/g, '_') as DocumentCategory;
  return DOCUMENT_TAXONOMY[normalized];
}

/**
 * Returns all canonical document taxonomy definitions.
 */
export function getAllDocumentTaxonomies(): DocumentTaxonomyDefinition[] {
  return Object.values(DOCUMENT_TAXONOMY);
}

/**
 * Resolves fields expected for a given document type name or alias.
 */
export function getDocumentFieldSchema(documentType: string): DocumentFieldSchema[] {
  return getDocumentTaxonomy(documentType)?.fields || [];
}
