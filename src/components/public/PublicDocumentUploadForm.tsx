'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface PublicDocumentUploadFormProps {
  token: string;
}

interface UploadSuccessData {
  fileName: string;
  fileSize: number;
  checksumSha256: string;
  consumedAt: string;
}

export function PublicDocumentUploadForm({ token }: PublicDocumentUploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<UploadSuccessData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      setErrorMessage('Silakan pilih file dokumen terlebih dahulu.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('token', token);
      formData.append('file', selectedFile);

      const response = await fetch('/api/public/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorText =
          data?.error?.message ||
          'Terjadi kesalahan saat mengunggah dokumen. Silakan coba lagi.';
        setErrorMessage(errorText);
      } else {
        setSuccessData({
          fileName: data.data.fileName,
          fileSize: data.data.fileSize,
          checksumSha256: data.data.checksumSha256,
          consumedAt: data.data.consumedAt,
        });
      }
    } catch {
      setErrorMessage('Terjadi kesalahan koneksi saat mengirim berkas. Periksa jaringan Anda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  if (successData) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>

        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Dokumen Berhasil Diunggah
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Berkas Anda telah diterima dengan aman dan tersimpan di sistem BANYUBIRU.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 rounded-lg p-3 border border-emerald-100 dark:border-emerald-900/30 text-left text-xs font-mono space-y-1 text-slate-700 dark:text-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-400">File:</span>
            <span className="font-semibold truncate max-w-[200px]">{successData.fileName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Ukuran:</span>
            <span>{formatBytes(successData.fileSize)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Status:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">SUBMITTED</span>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Tautan ini telah berhasil digunakan dan tidak dapat menerima unggahan ulang.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-lg flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Pilih Berkas Dokumen
        </label>
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            selectedFile
              ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10'
              : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-900/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            disabled={isSubmitting}
            className="hidden"
            accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
          />

          {selectedFile ? (
            <div className="flex items-center justify-center gap-3">
              <FileText className="w-8 h-8 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="text-left truncate">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {formatBytes(selectedFile.size)}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="w-8 h-8 text-slate-400 mx-auto" />
              <div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Klik untuk memilih berkas
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Mendukung PDF, PNG, JPG, WEBP
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !selectedFile}
        className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Mengunggah Dokumen...</span>
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            <span>Unggah Dokumen Sekarang</span>
          </>
        )}
      </button>
    </form>
  );
}
