'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Upload,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  HardDrive,
  Eye,
  X,
  FileCheck,
  ShieldCheck,
  Tag,
  Calendar,
  Layers,
  RefreshCw,
  Info,
} from 'lucide-react';
import { DocumentCategory, DocumentStatus } from '@prisma/client';
import {
  listDocumentsAction,
  uploadDocumentIntakeAction,
  getDocumentDetailsAction,
} from '@/platform/actions/document';
import {
  DocumentRecordDTO,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_SOURCE_LABELS,
  DOCUMENT_STATUS_LABELS,
} from '@/platform/types/document';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRecordDTO[]>([]);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>(DocumentCategory.LAINNYA);
  const [isTemporaryDoc, setIsTemporaryDoc] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<DocumentRecordDTO | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detail modal state
  const [detailDoc, setDetailDoc] = useState<DocumentRecordDTO | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const res = await listDocumentsAction({
        search: searchQuery || undefined,
        category: selectedCategory !== 'ALL' ? (selectedCategory as DocumentCategory) : undefined,
        source: selectedSource !== 'ALL' ? selectedSource : undefined,
        status: selectedStatus !== 'ALL' ? (selectedStatus as DocumentStatus) : undefined,
        limit: 50,
      });

      if (res.success && res.data) {
        setDocuments(res.data.documents);
        setTotalDocuments(res.data.total);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchDocuments();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory, selectedSource, selectedStatus]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setUploadError(null);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Silakan pilih berkas dokumen terlebih dahulu.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('category', uploadCategory);
      if (isTemporaryDoc) {
        formData.append('isTemporary', 'true');
      }

      const res = await uploadDocumentIntakeAction(formData);

      if (res.success && res.data) {
        setUploadSuccess(res.data);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        void fetchDocuments();
      } else {
        setUploadError(res.error?.message || 'Gagal mengunggah dokumen.');
      }
    } catch {
      setUploadError('Terjadi kesalahan saat mengirim berkas dokumen.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenDetail = async (docId: string) => {
    setIsLoadingDetail(true);
    try {
      const res = await getDocumentDetailsAction(docId);
      if (res.success && res.data) {
        setDetailDoc(res.data);
      }
    } catch (err) {
      console.error('Failed to load document details:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const getStatusBadge = (status: DocumentStatus) => {
    switch (status) {
      case DocumentStatus.DRAFT:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            Diterima
          </span>
        );
      case DocumentStatus.PENDING_VERIFICATION:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
            Perlu Diperiksa
          </span>
        );
      case DocumentStatus.VERIFIED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            Selesai
          </span>
        );
      case DocumentStatus.REJECTED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
            Gagal
          </span>
        );
      case DocumentStatus.ARCHIVED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <HardDrive className="w-3 h-3 text-slate-500" />
            Diarsipkan
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200">
            {DOCUMENT_STATUS_LABELS[status] || status}
          </span>
        );
    }
  };

  const getSourceBadge = (source: string) => {
    if (source === 'TAUTAN_PUBLIK') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
          Tautan Publik
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
        Unggah Langsung
      </span>
    );
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
            <span className="text-xs text-slate-500 font-medium">Administrasi Sekolah</span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Dokumen Masuk
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Pusat penerimaan, pencatatan metadata, dan repositori berkas dokumen resmi sekolah.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setUploadSuccess(null);
            setUploadError(null);
            setSelectedFile(null);
            setIsUploadOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0f2b5c] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-800 transition-colors cursor-pointer"
        >
          <Upload className="h-4 w-4" />
          <span>Upload Dokumen</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama dokumen..."
              className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600 bg-white"
            >
              <option value="ALL">Semua Jenis Dokumen</option>
              {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([cat, label]) => (
                <option key={cat} value={cat}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600 bg-white"
            >
              <option value="ALL">Semua Sumber</option>
              <option value="UNGGAH_LANGSUNG">Unggah Langsung</option>
              <option value="TAUTAN_PUBLIK">Tautan Publik</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600 bg-white"
            >
              <option value="ALL">Semua Status</option>
              <option value="DRAFT">Diterima / Siap Diproses</option>
              <option value="PENDING_VERIFICATION">Perlu Diperiksa</option>
              <option value="VERIFIED">Selesai</option>
              <option value="REJECTED">Gagal</option>
              <option value="ARCHIVED">Diarsipkan</option>
            </select>
          </div>
        </div>

        {/* Results Info */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>Menampilkan {documents.length} dari {totalDocuments} dokumen</span>
          <button
            type="button"
            onClick={() => void fetchDocuments()}
            className="flex items-center gap-1.5 text-blue-700 hover:text-blue-900 font-medium cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Documents Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Nama Dokumen</th>
                <th className="py-3.5 px-4">Sumber</th>
                <th className="py-3.5 px-4">Jenis Dokumen</th>
                <th className="py-3.5 px-4">Ukuran</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Waktu Diterima</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading && documents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
                    <span>Memuat dokumen masuk...</span>
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="font-semibold text-slate-700">Belum ada dokumen yang sesuai</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Unggah dokumen baru atau sesuaikan filter pencarian di atas.
                    </p>
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Nama Dokumen */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-start gap-2.5">
                        <div className="p-2 rounded-lg bg-blue-50 text-blue-700 shrink-0 mt-0.5">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                            {doc.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {doc.checksumSha256 && (
                              <span
                                title={`SHA-256: ${doc.checksumSha256}`}
                                className="font-mono text-[10px] text-slate-400 truncate max-w-[140px]"
                              >
                                #{doc.checksumSha256.slice(0, 10)}...
                              </span>
                            )}
                            {doc.isTemporary && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 font-medium">
                                Sementara
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Sumber */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getSourceBadge(doc.source)}
                    </td>

                    {/* Jenis Dokumen */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <span className="font-medium text-slate-800">{doc.categoryLabel}</span>
                        <p className="text-[10px] text-slate-400 font-mono uppercase">
                          {doc.mimeType.split('/')[1] || doc.mimeType}
                        </p>
                      </div>
                    </td>

                    {/* Ukuran */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-600">
                      {doc.fileSizeFormatted}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(doc.status)}
                    </td>

                    {/* Waktu Diterima */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                      <div className="space-y-0.5">
                        <p className="font-medium">
                          {new Date(doc.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(doc.createdAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </td>

                    {/* Aksi */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(doc.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-blue-900 transition-colors font-medium text-xs cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Detail</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100/60 text-blue-700">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Upload Dokumen</h3>
                  <p className="text-[11px] text-slate-500">Penerimaan berkas ke repositori sekolah</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {uploadSuccess ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                    <h4 className="text-sm font-bold text-slate-900">Dokumen Berhasil Diterima</h4>
                    <p className="text-xs text-slate-600">
                      Berkas telah disimpan dengan aman dan dicatat dalam repositori dokumen.
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1.5 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Nama Dokumen:</span>
                      <span className="font-semibold text-slate-800 truncate max-w-[220px]">
                        {uploadSuccess.title}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Jenis Dokumen:</span>
                      <span className="text-slate-800">{uploadSuccess.categoryLabel}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Ukuran Berkas:</span>
                      <span className="text-slate-800">{uploadSuccess.fileSizeFormatted}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status:</span>
                      <span className="text-emerald-700 font-bold">{uploadSuccess.statusLabel}</span>
                    </div>
                    {uploadSuccess.checksumSha256 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Checksum (SHA-256):</span>
                        <span className="text-slate-600 truncate max-w-[180px]">
                          {uploadSuccess.checksumSha256}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setUploadSuccess(null);
                        setSelectedFile(null);
                      }}
                      className="flex-1 py-2 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50"
                    >
                      Unggah Dokumen Lain
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsUploadOpen(false)}
                      className="flex-1 py-2 px-4 rounded-xl bg-[#0f2b5c] text-white font-bold text-xs hover:bg-blue-800"
                    >
                      Selesai
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  {uploadError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {/* Dropzone / File Picker */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Pilih Berkas Dokumen <span className="text-red-500">*</span>
                    </label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                        selectedFile
                          ? 'border-blue-500 bg-blue-50/30'
                          : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileSelect}
                        disabled={isUploading}
                        className="hidden"
                        accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                      />

                      {selectedFile ? (
                        <div className="flex items-center justify-center gap-3">
                          <FileText className="w-7 h-7 text-blue-700 shrink-0" />
                          <div className="text-left truncate">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {selectedFile.name}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
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

                  {/* Jenis Dokumen / Category */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Jenis Dokumen
                    </label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)}
                      disabled={isUploading}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600 bg-white"
                    >
                      {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([cat, label]) => (
                        <option key={cat} value={cat}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Temporary document toggle */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="isTemporary"
                      checked={isTemporaryDoc}
                      onChange={(e) => setIsTemporaryDoc(e.target.checked)}
                      disabled={isUploading}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="isTemporary" className="text-xs text-slate-600 cursor-pointer">
                      Tandai sebagai dokumen sementara / verifikasi berkala
                    </label>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsUploadOpen(false)}
                      disabled={isUploading}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isUploading || !selectedFile}
                      className="px-5 py-2 rounded-xl bg-[#0f2b5c] text-white font-bold text-xs hover:bg-blue-800 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      {isUploading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Menyimpan Dokumen...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>Simpan Dokumen</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Document Detail Modal */}
      {detailDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100/60 text-blue-700">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Informasi Dokumen</h3>
                  <p className="text-[11px] text-slate-500">Metadata dan integritas berkas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailDoc(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Nama Dokumen
                  </label>
                  <p className="text-xs font-bold text-slate-900 mt-0.5 break-all">
                    {detailDoc.title}
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Jenis Dokumen
                  </label>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">
                    {detailDoc.categoryLabel}
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Sumber Penerimaan
                  </label>
                  <div className="mt-1">{getSourceBadge(detailDoc.source)}</div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Status Dokumen
                  </label>
                  <div className="mt-1">{getStatusBadge(detailDoc.status)}</div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Ukuran Berkas
                  </label>
                  <p className="text-xs font-mono font-bold text-slate-900 mt-0.5">
                    {detailDoc.fileSizeFormatted}
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Format / MIME
                  </label>
                  <p className="text-xs font-mono text-slate-700 mt-0.5">
                    {detailDoc.mimeType}
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Waktu Diterima
                  </label>
                  <p className="text-xs text-slate-800 mt-0.5">
                    {new Date(detailDoc.createdAt).toLocaleString('id-ID')}
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Status Retensi
                  </label>
                  <p className="text-xs text-slate-800 mt-0.5">
                    {detailDoc.isTemporary ? 'Dokumen Sementara' : 'Dokumen Tetap / Arsip Sekolah'}
                  </p>
                </div>
              </div>

              {/* Technical / Storage Info */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Kunci Penyimpanan (Storage Key)
                  </label>
                  <p className="text-[11px] font-mono text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 mt-0.5 break-all select-all">
                    {detailDoc.storageKey || '-'}
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Hash Integritas (Checksum SHA-256)
                  </label>
                  <p className="text-[11px] font-mono text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 mt-0.5 break-all select-all">
                    {detailDoc.checksumSha256 || '-'}
                  </p>
                </div>
              </div>

              {/* Footer Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setDetailDoc(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
