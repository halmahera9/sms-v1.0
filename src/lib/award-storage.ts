import { AuditLog, AwardProposal, SignatoryConfig } from '@/types/award';

const STORAGE_KEYS = {
  PROPOSALS: 'banyubiru_award_proposals_v2',
  SIGNATORY: 'banyubiru_award_signatory_v2',
  AUDIT_LOGS: 'banyubiru_award_audit_logs_v2',
};

export const DEFAULT_SIGNATORY: SignatoryConfig = {
  seNumber: '22/SE/2026',
  seDate: '18 Agustus 2026',
  officialSignatoryName: 'Dra. Maria Ulfah, M.Si',
  officialSignatoryNip: '197405121998032001',
  officialSignatoryTitle: 'Kepala Bidang Pengembangan Pegawai BKD Provinsi DKI Jakarta',
  bkdHeadName: 'Chaidir, M.Si',
  bkdHeadNip: '196808151992031004',
  bkdHeadTitle: 'Kepala Badan Kepegawaian Daerah Provinsi DKI Jakarta',
};

// Generate realistic mock dataset matching PRD Facts: Total 1078 entries (449 Masa Kerja, 629 Satyalancana)
export function generateInitialProposals(): AwardProposal[] {
  const WILAYAH_LIST = [
    'Jakarta Pusat',
    'Jakarta Selatan',
    'Jakarta Barat',
    'Jakarta Timur',
    'Jakarta Utara',
    'Kepulauan Seribu',
  ];

  const UKPD_LIST = [
    'Suku Badan Kepegawaian Kota Administrasi',
    'Suku Dinas Pendidikan',
    'Suku Dinas Kesehatan',
    'Suku Dinas Perhubungan',
    'Satuan Polisi Pamong Praja',
    'RSUD DKI Jakarta',
    'Subbagian Umum dan Kepegawaian',
  ];

  const FIRST_NAMES = [
    'Budi', 'Siti', 'Agus', 'Dewi', 'Eko', 'Rina', 'Ahmad', 'Nur', 'Sri', 'Hendra',
    'Andi', 'Dian', 'Tri', 'Wahyu', 'Yulia', 'Rahmat', 'Indah', 'Rudi', 'Maya', 'Fajar'
  ];

  const LAST_NAMES = [
    'Santoso', 'Rahayu', 'Kurniawan', 'Wati', 'Setiawan', 'Lestari', 'Hidayat', 'Pratiwi', 'Suryani', 'Wibowo',
    'Utami', 'Saputra', 'Handayani', 'Nugroho', 'Astuti', 'Prasetyo', 'Kusuma', 'Fitriani', 'Susanto', 'Sari'
  ];

  const proposals: AwardProposal[] = [];

  // 1. Generate 449 Masa Kerja entries
  for (let i = 1; i <= 449; i++) {
    const fn = FIRST_NAMES[i % FIRST_NAMES.length];
    const ln = LAST_NAMES[(i * 3) % LAST_NAMES.length];
    const nama = `${fn} ${ln}`;
    const nrk = (180000 + i).toString();
    const nip = `198${(i % 9) + 0}0${(i % 8) + 1}152010011${(100 + i).toString()}`;
    const wilayah = WILAYAH_LIST[i % WILAYAH_LIST.length];
    const ukpd = UKPD_LIST[i % UKPD_LIST.length];
    
    // Masa Kerja values (10, 20, 30 years)
    const values: ('10' | '20' | '30')[] = ['10', '20', '30'];
    const nilaiUsulan = values[i % 3];

    // Distribute statuses realistically
    let status: AwardProposal['status'] = 'NOMINATIF';
    if (i % 10 === 0) status = 'SIAP_GENERATE';
    else if (i % 5 === 0) status = 'LENGKAP';
    else if (i % 3 === 0) status = 'SEBAGIAN';

    proposals.push({
      id: `prop-mk-${i}`,
      employeeId: `emp-mk-${i}`,
      employee: {
        id: `emp-mk-${i}`,
        nip,
        nrk,
        nama,
        gelar: i % 4 === 0 ? 'S.Kom' : i % 3 === 0 ? 'S.STP' : 'S.E.',
        jabatan: i % 2 === 0 ? 'Penata Laksana Kepegawaian' : 'Analis Sumber Daya Manusia Aparatur',
        unitKerja: ukpd,
        perangkatDaerah: 'BKD Provinsi DKI Jakarta',
        ukpd,
        wilayah,
        jenisKelamin: i % 2 === 0 ? 'L' : 'P',
        pangkat: 'Penata (III/c)',
        tmtPangkat: '2021-04-01',
        tmtJabatan: '2022-01-10',
      },
      jenisPenghargaan: 'MASA_KERJA',
      nilaiUsulan,
      status,
      catatan: i % 10 === 0 ? 'Berkas lengkap dan terverifikasi sesuai SE 22/SE/2026' : undefined,
      createdAt: '2026-08-20T09:00:00Z',
      updatedAt: '2026-08-25T14:30:00Z',
      documents: status === 'SIAP_GENERATE' || status === 'LENGKAP' ? [
        {
          id: `doc-1-${i}`,
          proposalId: `prop-mk-${i}`,
          requirementCode: 'SK_CPNS',
          fileName: `SK_CPNS_${nrk}.pdf`,
          fileSize: 1024 * 450,
          fileType: 'application/pdf',
          fileUrl: '#',
          uploadedAt: '2026-08-22T10:00:00Z',
          verificationStatus: 'verified',
          verifiedBy: 'Admin BKD',
          verifiedAt: '2026-08-23T11:00:00Z',
        },
        {
          id: `doc-2-${i}`,
          proposalId: `prop-mk-${i}`,
          requirementCode: 'SK_PNS',
          fileName: `SK_PNS_${nrk}.pdf`,
          fileSize: 1024 * 510,
          fileType: 'application/pdf',
          fileUrl: '#',
          uploadedAt: '2026-08-22T10:05:00Z',
          verificationStatus: 'verified',
          verifiedBy: 'Admin BKD',
          verifiedAt: '2026-08-23T11:02:00Z',
        },
        {
          id: `doc-4-${i}`,
          proposalId: `prop-mk-${i}`,
          requirementCode: 'SK_PANGKAT_TERAKHIR',
          fileName: `SK_Pangkat_${nrk}.pdf`,
          fileSize: 1024 * 380,
          fileType: 'application/pdf',
          fileUrl: '#',
          uploadedAt: '2026-08-22T10:10:00Z',
          verificationStatus: 'verified',
        },
        {
          id: `doc-5-${i}`,
          proposalId: `prop-mk-${i}`,
          requirementCode: 'SK_JABATAN_TERAKHIR',
          fileName: `SK_Jabatan_${nrk}.pdf`,
          fileSize: 1024 * 410,
          fileType: 'application/pdf',
          fileUrl: '#',
          uploadedAt: '2026-08-22T10:12:00Z',
          verificationStatus: 'verified',
        },
        {
          id: `doc-6-${i}`,
          proposalId: `prop-mk-${i}`,
          requirementCode: 'SKP_2025',
          fileName: `SKP_2025_${nrk}.pdf`,
          fileSize: 1024 * 600,
          fileType: 'application/pdf',
          fileUrl: '#',
          uploadedAt: '2026-08-22T10:15:00Z',
          verificationStatus: 'verified',
        },
        {
          id: `doc-7-${i}`,
          proposalId: `prop-mk-${i}`,
          requirementCode: 'SKT_TIDAK_HUKDIS',
          fileName: `Surat_Bebas_Hukdis_${nrk}.pdf`,
          fileSize: 1024 * 300,
          fileType: 'application/pdf',
          fileUrl: '#',
          uploadedAt: '2026-08-22T10:20:00Z',
          verificationStatus: 'verified',
        },
      ] : [],
    });
  }

  // 2. Generate 629 Satyalancana entries (596 X, 25 XX, 8 XXX)
  for (let i = 1; i <= 629; i++) {
    const fn = FIRST_NAMES[(i + 5) % FIRST_NAMES.length];
    const ln = LAST_NAMES[(i * 2 + 1) % LAST_NAMES.length];
    const nama = `${fn} ${ln}`;
    const nrk = (190000 + i).toString();
    const nip = `197${(i % 9) + 0}0${(i % 8) + 1}202010012${(200 + i).toString()}`;
    const wilayah = WILAYAH_LIST[i % WILAYAH_LIST.length];
    const ukpd = UKPD_LIST[i % UKPD_LIST.length];

    // Distribution: 596 X, 25 XX, 8 XXX
    let nilaiUsulan: 'X' | 'XX' | 'XXX' = 'X';
    if (i <= 8) nilaiUsulan = 'XXX';
    else if (i <= 33) nilaiUsulan = 'XX';
    else nilaiUsulan = 'X';

    let status: AwardProposal['status'] = 'NOMINATIF';
    if (i % 12 === 0) status = 'SIAP_GENERATE';
    else if (i % 4 === 0) status = 'LENGKAP';
    else if (i % 2 === 0) status = 'SEBAGIAN';

    proposals.push({
      id: `prop-sl-${i}`,
      employeeId: `emp-sl-${i}`,
      employee: {
        id: `emp-sl-${i}`,
        nip,
        nrk,
        nama,
        gelar: i % 3 === 0 ? 'M.Si' : 'S.Sos',
        jabatan: i % 2 === 0 ? 'Kepala Subbagian Tata Usaha' : 'Pengelola Kepegawaian',
        unitKerja: ukpd,
        perangkatDaerah: 'BKD Provinsi DKI Jakarta',
        ukpd,
        wilayah,
        jenisKelamin: i % 2 === 0 ? 'L' : 'P',
        pangkat: nilaiUsulan === 'XXX' ? 'Pembina Utama Muda (IV/c)' : 'Penata Tingkat I (III/d)',
        tmtPangkat: '2019-10-01',
        tmtJabatan: '2020-05-15',
      },
      jenisPenghargaan: 'SATYALANCANA',
      nilaiUsulan,
      status,
      catatan: status === 'SIAP_GENERATE' ? 'Berkas lengkap dan terverifikasi sesuai Lampiran SE 22/SE/2026' : undefined,
      createdAt: '2026-08-20T09:00:00Z',
      updatedAt: '2026-08-25T15:00:00Z',
      documents: [],
    });
  }

  return proposals;
}

export function loadProposals(): AwardProposal[] {
  if (typeof window === 'undefined') return generateInitialProposals();

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROPOSALS);
    if (!raw) {
      const initial = generateInitialProposals();
      localStorage.setItem(STORAGE_KEYS.PROPOSALS, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load proposals:', err);
    return generateInitialProposals();
  }
}

export function saveProposals(proposals: AwardProposal[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.PROPOSALS, JSON.stringify(proposals));
  } catch (err) {
    console.error('Failed to save proposals:', err);
  }
}

export function loadSignatoryConfig(): SignatoryConfig {
  if (typeof window === 'undefined') return DEFAULT_SIGNATORY;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SIGNATORY);
    return raw ? JSON.parse(raw) : DEFAULT_SIGNATORY;
  } catch (err) {
    return DEFAULT_SIGNATORY;
  }
}

export function saveSignatoryConfig(config: SignatoryConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.SIGNATORY, JSON.stringify(config));
}

export function loadAuditLogs(): AuditLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

export function addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): void {
  if (typeof window === 'undefined') return;
  const current = loadAuditLogs();
  const newLog: AuditLog = {
    ...log,
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify([newLog, ...current]));
}
