import type {
  DocumentClassificationOutcome,
  DocumentIntelligenceDecision,
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


export function decideDocument(
  classification: DocumentClassificationOutcome,
): DocumentIntelligenceDecision {
  const decisionMap: Partial<
    Record<DocumentType, DocumentIntelligenceDecision["decision"]>
  > = {
    DAFTAR_HADIR: "ABSENSI",
    SURAT_TUGAS: "SURAT_TUGAS",
    SURAT_EDARAN: "SURAT_EDARAN",
    SURAT_KETERANGAN: "SURAT_KETERANGAN",
    SK_KEPUTUSAN: "SK_KEPUTUSAN",
    LAPORAN: "LAPORAN",
    FORMULIR: "FORMULIR",
    DOKUMEN_KEPEGAWAIAN: "DOKUMEN_KEPEGAWAIAN",
    DOKUMEN_PESERTA_DIDIK: "DOKUMEN_PESERTA_DIDIK",
    DOKUMEN_LAINNYA: "DOKUMEN_LAINNYA",
  };

  const decision =
    classification.confidence >= 0.7
      ? decisionMap[classification.documentType]
      : undefined;

  if (!decision) {
    return {
      decision: "PERLU_VERIFIKASI",
      confidence: classification.confidence,
      reason:
        classification.documentType === "UNKNOWN"
          ? "Isi dokumen tidak memiliki teks yang dapat diklasifikasikan."
          : `Klasifikasi '${classification.documentType}' memiliki confidence di bawah ambang verifikasi.`,
      requiresHumanReview: true,
    };
  }

  return {
    decision,
    confidence: classification.confidence,
    reason: `Dokumen diklasifikasikan sebagai '${classification.documentType}' berdasarkan evidence: ${classification.evidence.join(", ")}.`,
    requiresHumanReview: classification.requiresHumanReview,
  };
}
