'use client';

import { useEffect, useState } from 'react';
import { 
  Upload, 
  ScanText, 
  FileText, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import { getOCRDocumentsAction } from '@/platform/actions/student-workflow';
import { processUploadedOCRDocumentAction } from '@/platform/actions/ocr-upload';
import { OCRDocument, ExtractedItem, AbsenceStatus } from '@/types/sms';

export default function OCRUploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedResult, setExtractedResult] = useState<OCRDocument | null>(null);
  const [documents, setDocuments] = useState<OCRDocument[]>([]);

  useEffect(() => {
    let mounted = true;

    getOCRDocumentsAction().then((result) => {
      if (mounted && result.success) {
        setDocuments(result.data ?? []);
        setExtractedResult(result.data?.[0] ?? null);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const processOCR = async (file: File) => {
    setIsProcessing(true);
    setExtractedResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await processUploadedOCRDocumentAction(formData);

      if ("error" in result) {
        throw new Error(result.error);
      }

      const documentId = result.data.documentId;

      const documentsResult = await getOCRDocumentsAction();

      if (documentsResult.success !== true) {
        throw new Error(
          typeof documentsResult.error === "string"
            ? documentsResult.error
            : "Gagal memuat hasil OCR"
        );
      }

      const nextDocuments = documentsResult.data ?? [];
      setDocuments(nextDocuments);

      const latest = nextDocuments.find(
        (doc) => doc.id === documentId
      );

      if (latest) {
        setExtractedResult(latest);
      }
    } catch (error) {
      console.error("OCR processing failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));

    // Pilih file = langsung masuk pipeline OCR.
    void processOCR(file);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="border-b border-white/10 pb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Upload &amp; OCR Dokumen Sekolah</h1>
        <p className="text-xs text-slate-400 mt-1">
          Unggah scan/foto daftar ketidakhadiran fisik. Mesin OCR SMS akan membaca teks &amp; mencocokkan siswa secara otomatis.
        </p>
      </div>

      {/* Main Upload / Preset Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Upload Box */}
        <div className="panel p-6 rounded-xl border border-white/10 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Upload className="h-4 w-4 text-sky-400" />
            <span>Unggah Dokumen (Foto / Scan / PDF)</span>
          </h3>

          <label className="border-2 border-dashed border-white/15 hover:border-sky-400 bg-slate-900/60 p-8 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all text-center">
            <ScanText className="h-10 w-10 text-sky-400 mb-3 animate-pulse" />
            <span className="text-xs font-semibold text-white">Klik untuk pilih file atau seret ke sini</span>
            <span className="text-[11px] text-slate-400 mt-1">Mendukung JPG, PNG, WEBP, PDF (Maks 10MB)</span>
            <input type="file" accept="image/*, application/pdf" onChange={handleFileChange} className="hidden" />
          </label>

          <p className="pt-2 text-[11px] text-slate-500">
            Pilih dokumen asli untuk diproses oleh pipeline OCR Banyubiru.
          </p>
        </div>

        {/* Preview & Action Box */}
        <div className="panel p-6 rounded-xl border border-white/10 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-cyan-400" />
              <span>Preview Dokumen &amp; Pemrosesan</span>
            </h3>

            {previewUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-white/15 bg-slate-900 h-56 flex items-center justify-center">
                {selectedFile?.type === "application/pdf" ? (
                  <iframe
                    src={previewUrl}
                    title="Preview dokumen PDF"
                    className="w-full h-full"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Preview dokumen"
                    className="max-h-full max-w-full object-contain"
                  />
                )}
              </div>
            ) : (
              <div className="h-56 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 text-xs">
                Pilih atau unggah file untuk melihat preview
              </div>
            )}
          </div>

          <div className="pt-4">
            <div className="w-full flex items-center justify-center gap-2 py-3 rounded bg-slate-100 text-slate-600 text-xs font-semibold">
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Memproses dokumen secara otomatis...</span>
                </>
              ) : selectedFile ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Dokumen sudah diproses</span>
                </>
              ) : (
                <span>Pilih dokumen untuk memulai OCR otomatis</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Extraction Results Preview */}
      {extractedResult && (
        <div className="panel p-6 rounded-xl border border-slate-200 bg-white space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-700 rounded">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Ekstraksi OCR Berhasil</h3>
                <p className="text-xs text-slate-400">
                  Ditemukan {extractedResult.extractedCount} baris nama siswa dengan hasil matching otomatis.
                </p>
              </div>
            </div>

            <button
              onClick={() => window.location.href = '/app/verify'}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-semibold rounded transition-all"
            >
              <span>Buka Antarmuka Verifikasi</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 font-mono text-[11px] uppercase">
                <tr>
                  <th className="p-3">Teks Asli OCR</th>
                  <th className="p-3">Hasil Match Master Data</th>
                  <th className="p-3">NISN</th>
                  <th className="p-3">Skor Confidence</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {extractedResult.items.map((item) => (
                  <tr key={item.id}>
                    <td className="p-3 text-slate-300">{item.ocrText}</td>
                    <td className="p-3 font-semibold text-white">{item.matchedStudentName || '—'}</td>
                    <td className="p-3 text-slate-400">{item.matchedNisn || '—'}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[11px] font-semibold">
                        {item.confidence}% Match
                      </span>
                    </td>
                    <td className="p-3 text-sky-400">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
