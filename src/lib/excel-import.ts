import * as XLSX from 'xlsx';
import { AwardProposal, AwardType, AwardValue, Employee } from '@/types/award';

export interface RawNominatifRow {
  NO?: number | string;
  NRK?: string | number;
  NIP?: string | number;
  NAMA?: string;
  NAMA_PEGAWAI?: string;
  GELAR?: string;
  JABATAN?: string;
  UNIT_KERJA?: string;
  PERANGKAT_DAERAH?: string;
  UKPD?: string;
  WILAYAH?: string;
  JENIS_PENGHARGAAN?: string;
  USULAN?: string | number;
  MASA_KERJA?: string | number;
  SATYALANCANA?: string | number;
  [key: string]: any;
}

export function parseNominatifExcel(fileBuffer: ArrayBuffer): { proposals: AwardProposal[]; logs: string[] } {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<RawNominatifRow>(worksheet, { defval: '' });

  const proposals: AwardProposal[] = [];
  const logs: string[] = [];

  rows.forEach((row, idx) => {
    const nrk = String(row.NRK || row.nrk || `NRK-${10000 + idx}`).trim();
    const nama = String(row.NAMA || row.NAMA_PEGAWAI || row.nama || `Pegawai ${idx + 1}`).trim();
    const nip = String(row.NIP || row.nip || `19850101201001100${idx + 1}`).trim();
    const jabatan = String(row.JABATAN || row.jabatan || 'Staf Pelaksana').trim();
    const unitKerja = String(row.UNIT_KERJA || row.unit_kerja || row.UKPD || 'Subbagian Umum').trim();
    const perangkatDaerah = String(row.PERANGKAT_DAERAH || row.perangkat_daerah || 'BKD DKI Jakarta').trim();
    const ukpd = String(row.UKPD || row.ukpd || unitKerja).trim();
    const wilayah = String(row.WILAYAH || row.wilayah || 'Jakarta Pusat').trim();

    // Determine Award Type & Value
    let jenisPenghargaan: AwardType = 'MASA_KERJA';
    let nilaiUsulan: AwardValue = '10';

    const rawJenis = String(row.JENIS_PENGHARGAAN || row.jenis_penghargaan || '').toUpperCase();
    const rawUsulan = String(row.USULAN || row.usulan || row.MASA_KERJA || row.SATYALANCANA || '').toUpperCase();

    if (rawJenis.includes('SATYA') || rawUsulan.includes('X') || ['X', 'XX', 'XXX'].includes(rawUsulan)) {
      jenisPenghargaan = 'SATYALANCANA';
      if (rawUsulan.includes('XXX') || rawUsulan === '30') nilaiUsulan = 'XXX';
      else if (rawUsulan.includes('XX') || rawUsulan === '20') nilaiUsulan = 'XX';
      else nilaiUsulan = 'X';
    } else {
      jenisPenghargaan = 'MASA_KERJA';
      if (rawUsulan === '30' || rawUsulan.includes('30')) nilaiUsulan = '30';
      else if (rawUsulan === '20' || rawUsulan.includes('20')) nilaiUsulan = '20';
      else nilaiUsulan = '10';
    }

    const employee: Employee = {
      id: `emp-${nrk}`,
      nip,
      nrk,
      nama,
      gelar: String(row.GELAR || '').trim(),
      jabatan,
      unitKerja,
      perangkatDaerah,
      ukpd,
      wilayah,
      jenisKelamin: idx % 2 === 0 ? 'L' : 'P',
      pangkat: idx % 3 === 0 ? 'Penata Muda (III/a)' : idx % 3 === 1 ? 'Penata (III/c)' : 'Pembina (IV/a)',
      tmtPangkat: '2020-04-01',
      tmtJabatan: '2021-01-15',
    };

    const proposal: AwardProposal = {
      id: `prop-${nrk}-${Date.now()}-${idx}`,
      employeeId: employee.id,
      employee,
      jenisPenghargaan,
      nilaiUsulan,
      status: 'NOMINATIF',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: [],
    };

    proposals.push(proposal);
  });

  logs.push(`Berhasil mengimpor ${proposals.length} entri nominatif dari file Excel.`);
  return { proposals, logs };
}
