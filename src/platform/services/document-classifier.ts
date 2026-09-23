import type {
  DocumentClassificationOutcome,
  DocumentType,
} from "@/platform/types/document-intelligence";

type ClassificationRule = {
  type: DocumentType;
  keywords: string[];
};

const RULES: ClassificationRule[] = [
  {
    type: "DAFTAR_HADIR",
    keywords: [
      "daftar hadir",
      "daftar kehadiran",
      "presensi",
      "absensi",
      "kehadiran",
      "hadir",
      "sakit",
      "izin",
      "alpa",
      "alpha",
    ],
  },
  {
    type: "SURAT_TUGAS",
    keywords: [
      "surat tugas",
      "ditugaskan",
      "menugaskan",
      "melaksanakan tugas",
    ],
  },
  {
    type: "SURAT_EDARAN",
    keywords: [
      "surat edaran",
      "diberitahukan",
      "pemberitahuan",
      "edaran",
    ],
  },
  {
    type: "SURAT_KETERANGAN",
    keywords: [
      "surat keterangan",
      "menerangkan bahwa",
      "dengan ini menerangkan",
    ],
  },
  {
    type: "SK_KEPUTUSAN",
    keywords: [
      "surat keputusan",
      "keputusan",
      "menetapkan",
      "memutuskan",
      "sk ",
    ],
  },
  {
    type: "DOKUMEN_KEPEGAWAIAN",
    keywords: [
      "pegawai",
      "guru",
      "ptk",
      "nip",
      "nuptk",
      "nrk",
      "status kepegawaian",
      "pangkat",
      "golongan",
      "jabatan",
    ],
  },
  {
    type: "DOKUMEN_PESERTA_DIDIK",
    keywords: [
      "peserta didik",
      "siswa",
      "siswi",
      "nisn",
      "nis",
      "rombel",
      "kelas",
      "peserta ujian",
    ],
  },
  {
    type: "LAPORAN",
    keywords: [
      "laporan",
      "rekapitulasi",
      "rekap",
      "hasil kegiatan",
    ],
  },
  {
    type: "FORMULIR",
    keywords: [
      "formulir",
      "form isian",
      "isian data",
    ],
  },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyDocument(
  rawText: string,
): DocumentClassificationOutcome {
  const normalized = normalize(rawText);

  if (!normalized) {
    return {
      documentType: "UNKNOWN",
      confidence: 0,
      evidence: [],
      requiresHumanReview: true,
    };
  }

  const scores = RULES.map((rule) => {
    const matchedKeywords = rule.keywords.filter((keyword) =>
      normalized.includes(keyword),
    );

    return {
      type: rule.type,
      matchedKeywords,
      score: matchedKeywords.length,
    };
  }).filter((item) => item.score > 0);

  scores.sort((a, b) => b.score - a.score);

  const winner = scores[0];

  if (!winner) {
    return {
      documentType: "DOKUMEN_LAINNYA",
      confidence: 0.25,
      evidence: [],
      requiresHumanReview: true,
    };
  }

  const confidence = Math.min(
    0.99,
    0.45 + winner.score * 0.12,
  );

  return {
    documentType: winner.type,
    confidence,
    evidence: winner.matchedKeywords,
    requiresHumanReview: confidence < 0.7,
  };
}
