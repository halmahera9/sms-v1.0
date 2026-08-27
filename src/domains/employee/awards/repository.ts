import { LocalStorageRepository } from '@/platform/repositories/base';
import { AwardProposal } from './types';

const STORAGE_KEY_PROPOSALS = 'banyubiru_award_proposals_v2';

export interface IEmployeeAwardRepository {
  findById(id: string): Promise<AwardProposal | null>;
  findAll(tenantId?: string): Promise<AwardProposal[]>;
  save(entity: AwardProposal): Promise<AwardProposal>;
  saveAll(entities: AwardProposal[]): Promise<AwardProposal[]>;
  delete(id: string): Promise<boolean>;
}

export class EmployeeAwardLocalStorageRepository
  extends LocalStorageRepository<AwardProposal>
  implements IEmployeeAwardRepository
{
  constructor() {
    super(STORAGE_KEY_PROPOSALS);
  }

  public generateInitialMockProposals(): AwardProposal[] {
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
      const values: ('10' | '20' | '30')[] = ['10', '20', '30'];
      const nilaiUsulan = values[i % 3];

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
          jabatan: i % 2 === 0 ? 'Penata Laksana Kepegawaian' : 'Analis SDM Aparatur',
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
        tahunUsulan: 2026,
        masaKerjaTahun: 10 + (i % 25),
        masaKerjaBulan: 0,
        status,
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

    // 2. Generate 629 Satyalancana entries
    for (let i = 1; i <= 629; i++) {
      const fn = FIRST_NAMES[(i + 5) % FIRST_NAMES.length];
      const ln = LAST_NAMES[(i * 2 + 1) % LAST_NAMES.length];
      const nama = `${fn} ${ln}`;
      const nrk = (190000 + i).toString();
      const nip = `197${(i % 9) + 0}0${(i % 8) + 1}202010012${(200 + i).toString()}`;
      const wilayah = WILAYAH_LIST[i % WILAYAH_LIST.length];
      const ukpd = UKPD_LIST[i % UKPD_LIST.length];

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
          jabatan: i % 2 === 0 ? 'Kasubbag Tata Usaha' : 'Pengelola Kepegawaian',
          unitKerja: ukpd,
          perangkatDaerah: 'BKD Provinsi DKI Jakarta',
          ukpd,
          wilayah,
          jenisKelamin: i % 2 === 0 ? 'L' : 'P',
          pangkat: nilaiUsulan === 'XXX' ? 'Pembina Utama Muda (IV/c)' : 'Penata Tk I (III/d)',
          tmtPangkat: '2019-10-01',
          tmtJabatan: '2020-05-15',
        },
        jenisPenghargaan: 'SATYALANCANA',
        nilaiUsulan,
        tahunUsulan: 2026,
        masaKerjaTahun: 10 + (i % 25),
        masaKerjaBulan: 0,
        status,
        createdAt: '2026-08-20T09:00:00Z',
        updatedAt: '2026-08-25T15:00:00Z',
        documents: [],
      });
    }

    return proposals;
  }

  public async findAll(tenantId?: string): Promise<AwardProposal[]> {
    const raw = this.getRawItems();
    if (raw.length === 0) {
      const initial = this.generateInitialMockProposals();
      this.saveRawItems(initial);
      return initial;
    }
    return raw;
  }
}
