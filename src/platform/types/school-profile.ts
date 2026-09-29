/**
 * Banyubiru — School Profile & Letterhead Contracts (P0-E)
 *
 * Konfigurasi identitas resmi sekolah sebagai single source of truth
 * untuk dokumen dan Template Surat keluaran Banyubiru.
 */

export interface SchoolSigner {
  nama: string;
  nip?: string;
  nik?: string;
  jabatan: string;
  isActive: boolean;
}

export interface SchoolLetterheadConfig {
  headerInstansi?: string;
  namaSekolah: string;
  alamatBaris1?: string;
  alamatBaris2?: string;
  kontakDanWebsite?: string;
}

export interface SchoolProfileDTO {
  tenantId: string;
  namaSekolah: string;
  kodeSekolah: string;
  npsn: string | null;
  alamat: string | null;
  telepon: string | null;
  email: string | null;
  logoPath: string | null;
  kopSurat: SchoolLetterheadConfig | null;
  penandatangan: SchoolSigner[];
  status: string;
  updatedAt: string;
}

export interface UpdateSchoolProfileInput {
  namaSekolah?: string;
  npsn?: string;
  alamat?: string;
  telepon?: string;
  email?: string;
  kopSurat?: SchoolLetterheadConfig;
}
