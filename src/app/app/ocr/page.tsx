'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ScanText,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Copy,
  Check,
  Search,
  Upload,
  HardDrive,
  FileCheck,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import {
  listDocumentsForOCRAction,
  readDocumentOCRAction,
  getDocumentOCRResultAction,
  uploadAndReadDocumentOCRAction,
} from '@/platform/actions/document-ocr';
import { DocumentForOCRItemDTO, DocumentOCRResultDTO } from '@/platform/types/ocr';
import { DocumentCategory } from '@prisma/client';
import { DOCUMENT_CATEGORY_LABELS } from '@/platform/types/document';

export default function OCRReadingPage() {
  const [documents, setDocuments] = useState<DocumentForOCRItemDTO[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<DocumentOCRResultDTO | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isReading, setIsReading] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Direct upload & read state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>(DocumentCategory.LAINNYA);
  const [isUploadingAndReading, setIsUploadingAndReading] = useState(false);
  const [uploadModalError, setUploadModalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocumentList = async () => {
    setIsLoadingList(true);
    try {
      const res = await listDocumentsForOCRAction(searchQuery);
      if (res.success && res.data) {
        setDocuments(res.data);
        if (!selectedDocId && res.data.length > 0) {
          const first = res.data[0];
          setSelectedDocId(first.documentId);
          if (first.hasOCRResult) {
            void fetchOCRResult(first.documentId);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load documents for OCR:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  const fetchOCRResult = async (docId: string) => {
    try {
      const res = await getDocumentOCRResultAction(docId);
      if (res.success) {
        setOcrResult(res.data ?? null);
      }
    } catch (err) {
      console.error('Failed to load OCR result:', err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchDocumentList();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectDocument = (doc: DocumentForOCRItemDTO) => {
    setSelectedDocId(doc.documentId);
    setReadingError(null);
    setOcrResult(null);
    if (doc.hasOCRResult || doc.ocrStatus === 'COMPLETED' || doc.ocrStatus === 'FAILED') {
      void fetchOCRResult(doc.documentId);
    }
  };

  const handleStartOCR = async (docId: string) => {
    setIsReading(true);
    setReadingError(null);
    try {
      const res = await readDocumentOCRAction(docId);
      if (res.success && res.data) {
        setOcrResult(res.data);
        void fetchDocumentList();
      } else {
        setReadingError(res.error?.message || 'Pembacaan dokumen gagal.');
        void fetchOCRResult(docId);
      }
    } catch (err) {
      setReadingError('Terjadi kesalahan saat memproses pembacaan dokumen.');
    } finally {
      setIsReading(false);
    }
  };

  const handleUploadAndRead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadModalError('Pilih berkas dokumen terlebih dahulu.');
      return;
    }

    setIsUploadingAndReading(true);
    setUploadModalError(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('category', uploadCategory);

      const res = await uploadAndReadDocumentOCRAction(formData);
      if (res.success && res.data) {
        setOcrResult(res.data);
        setSelectedDocId(res.data.documentId);
        setIsUploadOpen(false);
        setUploadFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        void fetchDocumentList();
      } else {
        setUploadModalError(res.error?.message || 'Gagal mengunggah dan membaca dokumen.');
      }
    } catch (err) {
      setUploadModalError('Terjadi kesalahan saat mengunggah dokumen.');
    } finally {
      setIsUploadingAndReading(false);
    }
  };

  const copyToClipboard = () => {
    if (!ocrResult?.extractedText) return;
    navigator.clipboard.writeText(ocrResult.extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedDoc = documents.find((d) => d.documentId === selectedDocId);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Selesai Dibaca (Siap Diekstraksi)
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Sedang Dibaca
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Gagal Dibaca (Perlu Diperiksa)
          </span>
        );
      case 'QUEUED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Menunggu Pembacaan
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            Belum Dibaca
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
              Dokumen
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">Pembacaan Teks Otomatis</span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Pembacaan Dokumen
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Membaca dan menyimpan seluruh teks dari berkas dokumen masuk untuk persiapan tahap ekstraksi informasi.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setUploadFile(null);
            setUploadModalError(null);
            setIsUploadOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0f2b5c] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-800 transition-colors cursor-pointer"
        >
          <Upload className="h-4 w-4" />
          <span>Unggah &amp; Baca Dokumen</span>
        </button>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Documents List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Daftar Dokumen Masuk ({documents.length})
              </h2>
              <button
                type="button"
                onClick={() => void fetchDocumentList()}
                className="text-slate-400 hover:text-blue-700"
                title="Segarkan daftar"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama berkas dokumen..."
                className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600"
              />
            </div>

            {/* Document Items */}
            <div className="divide-y divide-slate-100 max-h-[580px] overflow-y-auto pr-1">
              {isLoadingList && documents.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-300" />
                  <span>Memuat dokumen...</span>
                </div>
              ) : documents.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <span>Tidak ada dokumen yang ditemukan</span>
                </div>
              ) : (
                documents.map((doc) => {
                  const isSelected = selectedDocId === doc.documentId;
                  return (
                    <div
                      key={doc.documentId}
                      onClick={() => handleSelectDocument(doc)}
                      className={`py-3 px-3 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-50/70 border border-blue-200'
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {doc.fileName}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                            <span>{doc.categoryLabel}</span>
                            <span>&bull;</span>
                            <span className="font-mono">{doc.fileSizeFormatted}</span>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {getStatusBadge(doc.ocrStatus)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: OCR Result & Action Panel */}
        <div className="lg:col-span-7 space-y-4">
          {selectedDoc ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
              {/* Selected Document Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Dokumen Terpilih
                    </span>
                    <span className="text-slate-300">&bull;</span>
                    <span className="text-[11px] font-medium text-slate-600">
                      Versi {selectedDoc.versionNumber}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 mt-0.5 truncate max-w-md">
                    {selectedDoc.fileName}
                  </h2>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStartOCR(selectedDoc.documentId)}
                    disabled={isReading}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white px-4 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    {isReading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Membaca Dokumen...</span>
                      </>
                    ) : (
                      <>
                        <ScanText className="w-3.5 h-3.5" />
                        <span>{ocrResult ? 'Ulangi Pembacaan' : 'Mulai Pembacaan Dokumen'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Status and Error Alert */}
              {readingError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{readingError}</span>
                </div>
              )}

              {/* Integrity Reference Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Jenis Dokumen
                  </span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {selectedDoc.categoryLabel}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Ukuran Berkas Asli
                  </span>
                  <p className="font-mono text-slate-800 mt-0.5">
                    {selectedDoc.fileSizeFormatted}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Format / MIME
                  </span>
                  <p className="font-mono text-slate-800 mt-0.5 uppercase">
                    {selectedDoc.mimeType.split('/')[1] || selectedDoc.mimeType}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Status Pembacaan
                  </span>
                  <div className="mt-1">
                    {getStatusBadge(ocrResult?.status || selectedDoc.ocrStatus)}
                  </div>
                </div>
              </div>

              {/* Hash & Storage Location */}
              <div className="text-[11px] font-mono text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Lokasi Berkas Asli:</span>
                  <span className="truncate max-w-[280px]">{selectedDoc.storageKey || '-'}</span>
                </div>
                {selectedDoc.checksumSha256 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Checksum SHA-256:</span>
                    <span className="truncate max-w-[280px] font-bold text-slate-700">
                      {selectedDoc.checksumSha256}
                    </span>
                  </div>
                )}
              </div>

              {/* Extracted Text Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Teks Hasil Pembacaan
                  </h3>
                  {ocrResult?.extractedText && (
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-500 font-mono">
                        {ocrResult.extractedText.length} karakter &bull;{' '}
                        {ocrResult.extractedText.split('\n').length} baris
                      </span>
                      <button
                        type="button"
                        onClick={copyToClipboard}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Salin Teks</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {isReading ? (
                  <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-6 text-center space-y-2 bg-slate-50/50">
                    <RefreshCw className="w-7 h-7 text-blue-700 animate-spin" />
                    <p className="text-xs font-bold text-slate-800">
                      Sedang Membaca Teks Dokumen...
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-sm">
                      Sistem sedang memproses berkas asli menggunakan mesin pembacaan teks otomatis.
                    </p>
                  </div>
                ) : ocrResult && ocrResult.extractedText ? (
                  <div className="space-y-2">
                    <textarea
                      readOnly
                      value={ocrResult.extractedText}
                      className="w-full h-80 rounded-xl border border-slate-200 p-4 font-mono text-xs text-slate-800 bg-slate-50/50 focus:outline-hidden resize-none leading-relaxed"
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>
                        Waktu Pembacaan:{' '}
                        {ocrResult.completedAt
                          ? new Date(ocrResult.completedAt).toLocaleString('id-ID')
                          : '-'}
                      </span>
                      {ocrResult.durationMs && (
                        <span>Durasi: {(ocrResult.durationMs / 1000).toFixed(2)} detik</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-6 text-center space-y-3 bg-slate-50/30">
                    <ScanText className="w-8 h-8 text-slate-300" />
                    <div>
                      <p className="text-xs font-bold text-slate-700">
                        Dokumen belum dibaca
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                        Klik tombol &ldquo;Mulai Pembacaan Dokumen&rdquo; untuk membaca teks dari berkas ini.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs space-y-3">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-xs font-bold text-slate-700">Pilih Dokumen</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Pilih salah satu dokumen dari daftar di sebelah kiri untuk melihat atau memulai pembacaan teks dokumen.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Upload & Read Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100/60 text-blue-700">
                  <ScanText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Unggah &amp; Baca Dokumen</h3>
                  <p className="text-[11px] text-slate-500">
                    Simpan berkas asli dan langsung jalankan pembacaan teks otomatis
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleUploadAndRead} className="p-6 space-y-4">
              {uploadModalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{uploadModalError}</span>
                </div>
              )}

              {/* File picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Pilih Berkas Dokumen <span className="text-red-500">*</span>
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                    uploadFile
                      ? 'border-blue-500 bg-blue-50/30'
                      : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={(e) => {
                      setUploadFile(e.target.files?.[0] || null);
                      setUploadModalError(null);
                    }}
                    disabled={isUploadingAndReading}
                    className="hidden"
                    accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                  />

                  {uploadFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="w-7 h-7 text-blue-700 shrink-0" />
                      <div className="text-left truncate">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {uploadFile.name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Upload className="w-7 h-7 text-slate-400 mx-auto" />
                      <p className="text-xs font-medium text-slate-700">
                        Klik atau seret berkas ke sini
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Format PDF, PNG, JPG, JPEG, WEBP (Maksimal 50MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Jenis Dokumen
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)}
                  disabled={isUploadingAndReading}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600 bg-white"
                >
                  {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([cat, label]) => (
                    <option key={cat} value={cat}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  disabled={isUploadingAndReading}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUploadingAndReading || !uploadFile}
                  className="px-5 py-2 rounded-xl bg-[#0f2b5c] text-white font-bold text-xs hover:bg-blue-800 disabled:opacity-50 flex items-center gap-2"
                >
                  {isUploadingAndReading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sedang Memproses...</span>
                    </>
                  ) : (
                    <>
                      <ScanText className="w-3.5 h-3.5" />
                      <span>Simpan &amp; Baca Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
