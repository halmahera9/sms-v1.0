import { PlatformValidationEngine } from '@/platform/rules/engine';
import { ValidationRule } from '@/platform/types';
import { AwardProposal, AwardType, DocumentRequirement, ProposalStatus } from './types';

export const MASA_KERJA_REQUIREMENTS: DocumentRequirement[] = [
  {
    id: 'mk-1',
    code: 'SK_CPNS',
    name: 'SK CPNS dilegalisir',
    description: 'Fotokopi SK CPNS yang telah dilegalisir',
    isMandatory: true,
    awardType: 'MASA_KERJA',
  },
  {
    id: 'mk-2',
    code: 'SK_PNS',
    name: 'SK PNS dilegalisir',
    description: 'Fotokopi SK PNS yang telah dilegalisir',
    isMandatory: true,
    awardType: 'MASA_KERJA',
  },
  {
    id: 'mk-3',
    code: 'SK_PERPINDAHAN',
    name: 'SK Perpindahan (Opsional)',
    description: 'SK perpindahan antar unit/instansi jika ada',
    isMandatory: false,
    awardType: 'MASA_KERJA',
  },
  {
    id: 'mk-4',
    code: 'SK_PANGKAT_TERAKHIR',
    name: 'SK Kenaikan Pangkat Terakhir',
    description: 'Fotokopi SK Kenaikan Pangkat terakhir dilegalisir',
    isMandatory: true,
    awardType: 'MASA_KERJA',
  },
  {
    id: 'mk-5',
    code: 'SK_JABATAN_TERAKHIR',
    name: 'SK Pengangkatan Jabatan Terakhir',
    description: 'Fotokopi SK Jabatan terakhir dilegalisir',
    isMandatory: true,
    awardType: 'MASA_KERJA',
  },
  {
    id: 'mk-6',
    code: 'SKP_2025',
    name: 'Evaluasi Kinerja / SKP 2025',
    description: 'Penilaian prestasi kerja / Evaluasi kinerja pegawai tahun 2025',
    isMandatory: true,
    awardType: 'MASA_KERJA',
  },
  {
    id: 'mk-7',
    code: 'SKT_TIDAK_HUKDIS',
    name: 'Surat Keterangan Bebas Hukdis',
    description: 'Surat keterangan tidak sedang menjalani hukuman disiplin sedang/berat',
    isMandatory: true,
    awardType: 'MASA_KERJA',
  },
];

export const SATYALANCANA_REQUIREMENTS: DocumentRequirement[] = [
  {
    id: 'sl-1',
    code: 'DRH_LAMPIRAN_1',
    name: 'Daftar Riwayat Hidup Lampiran I',
    description: 'DRH format resmi Lampiran I bertanda tangan',
    isMandatory: true,
    awardType: 'SATYALANCANA',
  },
  {
    id: 'sl-2',
    code: 'SK_CPNS',
    name: 'SK CPNS dilegalisir',
    description: 'Fotokopi SK CPNS yang telah dilegalisir',
    isMandatory: true,
    awardType: 'SATYALANCANA',
  },
  {
    id: 'sl-3',
    code: 'SK_PANGKAT_TERAKHIR',
    name: 'SK Kenaikan Pangkat Terakhir',
    description: 'Fotokopi SK Kenaikan Pangkat terakhir dilegalisir',
    isMandatory: true,
    awardType: 'SATYALANCANA',
  },
  {
    id: 'sl-4',
    code: 'SK_JABATAN_TERAKHIR',
    name: 'SK Pengangkatan Jabatan Terakhir',
    description: 'Fotokopi SK Jabatan terakhir dilegalisir',
    isMandatory: true,
    awardType: 'SATYALANCANA',
  },
  {
    id: 'sl-5',
    code: 'KEPPRES_TERDAHULU',
    name: 'Legalisir Keppres Satyalancana Terdahulu (Opsional)',
    description: 'Fotokopi Keppres Satyalancana terdahulu jika sudah pernah menerima',
    isMandatory: false,
    awardType: 'SATYALANCANA',
  },
  {
    id: 'sl-6',
    code: 'SKT_PERNAH_HUKDIS',
    name: 'Surat Keterangan Tidak Pernah Hukdis',
    description: 'Surat Keterangan tidak pernah dikenakan hukuman disiplin sedang/berat',
    isMandatory: true,
    awardType: 'SATYALANCANA',
  },
  {
    id: 'sl-7',
    code: 'SKT_SEDANG_HUKDIS',
    name: 'Surat Keterangan Tidak Sedang Hukdis',
    description: 'Surat Keterangan tidak sedang menjalani hukuman disiplin sedang/berat',
    isMandatory: true,
    awardType: 'SATYALANCANA',
  },
];

export function getRequirementsForType(awardType: AwardType): DocumentRequirement[] {
  return awardType === 'MASA_KERJA' ? MASA_KERJA_REQUIREMENTS : SATYALANCANA_REQUIREMENTS;
}

// Rule 1: Validate Employee Identity Integrity
export const employeeIdentityRule: ValidationRule<AwardProposal> = {
  id: 'EMP_IDENTITY_RULE',
  name: 'Empoyee Identity Integrity Rule',
  severity: 'ERROR',
  validate: (proposal) => {
    if (!proposal.employee?.nrk || !proposal.employee?.nip || !proposal.employee?.nama) {
      return {
        valid: false,
        ruleId: 'EMP_IDENTITY_RULE',
        severity: 'ERROR',
        message: 'Data identitas pegawai (NRK, NIP, Nama) tidak lengkap.',
      };
    }
    return {
      valid: true,
      ruleId: 'EMP_IDENTITY_RULE',
      severity: 'INFO',
      message: 'Identitas pegawai valid.',
    };
  },
};

// Rule 2: Validate Document Requirements Rule
export const documentCompletenessRule: ValidationRule<AwardProposal> = {
  id: 'DOC_COMPLETENESS_RULE',
  name: 'Document Requirements Completeness Rule',
  severity: 'ERROR',
  validate: (proposal) => {
    const reqs = getRequirementsForType(proposal.jenisPenghargaan);
    const mandatoryReqs = reqs.filter((r) => r.isMandatory);

    const verifiedCodes = new Set(
      (proposal.documents || [])
        .filter((d) => d.verificationStatus === 'verified')
        .map((d) => d.requirementCode)
    );

    const missingCodes = mandatoryReqs.filter((r) => !verifiedCodes.has(r.code)).map((r) => r.name);

    if (missingCodes.length > 0) {
      return {
        valid: false,
        ruleId: 'DOC_COMPLETENESS_RULE',
        severity: 'ERROR',
        message: `Berkas wajib belum terverifikasi: ${missingCodes.join(', ')}`,
        metadata: { missingCount: missingCodes.length, missingCodes },
      };
    }

    return {
      valid: true,
      ruleId: 'DOC_COMPLETENESS_RULE',
      severity: 'INFO',
      message: 'Seluruh berkas dokumen wajib terverifikasi 100%.',
    };
  },
};

export const employeeAwardValidationEngine = new PlatformValidationEngine<AwardProposal>([
  employeeIdentityRule,
  documentCompletenessRule,
]);

export function calculateProposalStatus(
  awardType: AwardType,
  documents: AwardProposal['documents'],
  currentStatus: ProposalStatus
): ProposalStatus {
  if (['SIAP_GENERATE', 'GENERATED', 'DITANDATANGANI', 'DIKIRIM', 'SELESAI'].includes(currentStatus)) {
    return currentStatus;
  }

  const requirements = getRequirementsForType(awardType);
  const mandatoryReqs = requirements.filter((r) => r.isMandatory);

  if (!documents || documents.length === 0) {
    return 'BELUM_UPLOAD';
  }

  const uploadedMandatoryCodes = new Set(documents.map((d) => d.requirementCode));
  const verifiedMandatoryCodes = new Set(
    documents.filter((d) => d.verificationStatus === 'verified').map((d) => d.requirementCode)
  );

  const allMandatoryUploaded = mandatoryReqs.every((req) => uploadedMandatoryCodes.has(req.code));
  const allMandatoryVerified = mandatoryReqs.every((req) => verifiedMandatoryCodes.has(req.code));

  if (allMandatoryVerified || verifiedMandatoryCodes.size > 0 || documents.some((d) => d.verificationStatus === 'verified')) {
    return 'DIVERIFIKASI';
  }

  if (allMandatoryUploaded) {
    return 'LENGKAP';
  }

  return 'SEBAGIAN';
}
