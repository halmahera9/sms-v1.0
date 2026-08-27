export type AwardType = 'MASA_KERJA' | 'SATYALANCANA';

export type AwardValue = '10' | '20' | '30' | 'X' | 'XX' | 'XXX';

export type ProposalStatus =
  | 'NOMINATIF'
  | 'BELUM_UPLOAD'
  | 'SEBAGIAN'
  | 'LENGKAP'
  | 'DIVERIFIKASI'
  | 'SIAP_GENERATE'
  | 'GENERATED'
  | 'DITANDATANGANI'
  | 'DIKIRIM'
  | 'SELESAI';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface Employee {
  id: string;
  nip: string;
  nrk: string;
  nama: string;
  gelar?: string;
  tempatLahir?: string;
  tanggalLahir?: string;
  pendidikan?: string;
  pangkat?: string;
  tmtPangkat?: string;
  jabatan: string;
  tmtJabatan?: string;
  jenisKelamin?: 'L' | 'P';
  unitKerja: string;
  perangkatDaerah: string;
  ukpd: string;
  wilayah: string;
}

export interface DocumentRequirement {
  id: string;
  code: string;
  name: string;
  description: string;
  isMandatory: boolean;
  awardType: AwardType;
}

export interface ProposalDocument {
  id: string;
  proposalId: string;
  requirementCode: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  uploadedAt: string;
  verificationStatus: VerificationStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  catatan?: string;
}

export interface AwardProposal {
  id: string;
  employeeId: string;
  employee: Employee;
  jenisPenghargaan: AwardType;
  nilaiUsulan?: AwardValue;
  tahunUsulan: number;
  masaKerjaTahun: number;
  masaKerjaBulan: number;
  status: ProposalStatus;
  catatan?: string;
  createdAt: string;
  updatedAt: string;
  documents: ProposalDocument[];
}

export interface SignatoryConfig {
  seNumber: string;
  seDate: string;
  officialSignatoryName: string;
  officialSignatoryNip: string;
  officialSignatoryTitle: string;
  bkdHeadName: string;
  bkdHeadNip: string;
  bkdHeadTitle: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
}
