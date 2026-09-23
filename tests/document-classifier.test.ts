import assert from "node:assert/strict";
import { classifyDocument } from "../src/platform/services/document-classifier";

const cases = [
  {
    text: "DAFTAR HADIR GURU DAN PEGAWAI SMP NEGERI 99 JAKARTA",
    expected: "DAFTAR_HADIR",
  },
  {
    text: "SURAT TUGAS Nomor 123 Tahun 2026",
    expected: "SURAT_TUGAS",
  },
  {
    text: "SURAT EDARAN Pemberitahuan kegiatan sekolah",
    expected: "SURAT_EDARAN",
  },
  {
    text: "SURAT KETERANGAN menerangkan bahwa",
    expected: "SURAT_KETERANGAN",
  },
  {
    text: "SURAT KEPUTUSAN Kepala Sekolah menetapkan",
    expected: "SK_KEPUTUSAN",
  },
  {
    text: "DATA PTK Nama Guru NIP NUPTK Jabatan",
    expected: "DOKUMEN_KEPEGAWAIAN",
  },
  {
    text: "DATA PESERTA DIDIK NISN NIPD Rombel Saat Ini",
    expected: "DOKUMEN_PESERTA_DIDIK",
  },
];

for (const testCase of cases) {
  const result = classifyDocument(testCase.text);

  assert.equal(
    result.documentType,
    testCase.expected,
    `Expected ${testCase.expected}, got ${result.documentType}`,
  );

  assert.ok(result.confidence > 0);
}

const empty = classifyDocument("");

assert.equal(empty.documentType, "UNKNOWN");
assert.equal(empty.requiresHumanReview, true);

console.log("document-classifier: all tests passed");
