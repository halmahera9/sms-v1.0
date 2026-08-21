'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  ScanText, 
  CheckSquare, 
  FileSpreadsheet, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { getStoredStudents, getStoredDocuments } from '@/lib/storage';
import { Student, OCRDocument } from '@/types/sms';

export default function DashboardOverview() {
  const [students, setStudents] = useState<Student[]>([]);
  const [documents, setDocuments] = useState<OCRDocument[]>([]);

  useEffect(() => {
    setStudents(getStoredStudents());
    setDocuments(getStoredDocuments());
  }, []);

  const totalExtracted = documents.reduce((acc, doc) => acc + doc.extractedCount, 0);
  const totalVerified = documents.reduce((acc, doc) => acc + doc.verifiedCount, 0);
  const pendingCount = totalExtracted - totalVerified;

  return (
    <div className="space-y-8">
      {/* Title & Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard Ringkasan SMS</h1>
          <p className="text-xs text-slate-400 mt-1">
            Status pengolahan dokumen ketidakhadiran &amp; sinkronisasi data master siswa.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/app/ocr"
            className="flex items-center gap-2 bg-sky-400 px-4 py-2 text-xs font-semibold text-slate-950 rounded hover:bg-sky-300 transition-colors shadow-sm shadow-sky-500/20"
          >
            <ScanText className="h-4 w-4" />
            <span>Upload Dokumen Baru</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel p-5 rounded-xl border border-white/10">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase">Master Data Siswa</span>
            <Users className="h-5 w-5 text-sky-400" />
          </div>
          <div className="text-3xl font-bold text-white">{students.length}</div>
          <p className="text-[11px] text-slate-400 mt-2">Siswa terdaftar dari Dapodik</p>
        </div>

        <div className="panel p-5 rounded-xl border border-white/10">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase">Dokumen Diproses</span>
            <ScanText className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="text-3xl font-bold text-white">{documents.length}</div>
          <p className="text-[11px] text-slate-400 mt-2">{totalExtracted} nama berhasil diekstraksi</p>
        </div>

        <div className="panel p-5 rounded-xl border border-white/10">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase">Perlu Verifikasi</span>
            <AlertCircle className="h-5 w-5 text-amber-400" />
          </div>
          <div className="text-3xl font-bold text-amber-400">{pendingCount}</div>
          <p className="text-[11px] text-slate-400 mt-2">Menunggu persetujuan operator</p>
        </div>

        <div className="panel p-5 rounded-xl border border-white/10">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase">Terverifikasi</span>
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-emerald-400">{totalVerified}</div>
          <p className="text-[11px] text-slate-400 mt-2">Siap diekspor ke Excel &amp; PDF</p>
        </div>
      </div>

      {/* Quick Workflows Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        <Link 
          href="/app/students" 
          className="panel p-6 rounded-xl hover:border-sky-500/50 transition-all group border border-white/10"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-sky-500/10 text-sky-400 rounded-lg group-hover:bg-sky-500/20">
              <Users className="h-6 w-6" />
            </div>
            <ArrowUpRight className="h-5 w-5 text-slate-400 group-hover:text-sky-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </div>
          <h3 className="text-base font-semibold text-white">Import Master Data Siswa</h3>
          <p className="text-xs text-slate-400 mt-1">Upload atau kelola file Excel / Dapodik siswa untuk basis fuzzy matching.</p>
        </Link>

        <Link 
          href="/app/verify" 
          className="panel p-6 rounded-xl hover:border-amber-500/50 transition-all group border border-white/10"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-lg group-hover:bg-amber-500/20">
              <CheckSquare className="h-6 w-6" />
            </div>
            <ArrowUpRight className="h-5 w-5 text-slate-400 group-hover:text-amber-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </div>
          <h3 className="text-base font-semibold text-white">Verifikasi Operator (Human-in-the-Loop)</h3>
          <p className="text-xs text-slate-400 mt-1">Review hasil pencocokan nama siswa OCR dan konfirmasi status absen.</p>
        </Link>

        <Link 
          href="/app/export" 
          className="panel p-6 rounded-xl hover:border-emerald-500/50 transition-all group border border-white/10"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg group-hover:bg-emerald-500/20">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <ArrowUpRight className="h-5 w-5 text-slate-400 group-hover:text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </div>
          <h3 className="text-base font-semibold text-white">Pusat Ekspor Laporan</h3>
          <p className="text-xs text-slate-400 mt-1">Unduh rekapitulasi data ketidakhadiran siswa dalam format Excel (.xlsx) &amp; PDF.</p>
        </Link>
      </div>

      {/* Dokumen Terbaru List */}
      <div className="panel p-6 rounded-xl border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Dokumen Ketidakhadiran Terbaru</h3>
          <Link href="/app/ocr" className="text-xs text-sky-400 hover:underline">
            Lihat Semua Dokumen
          </Link>
        </div>

        {documents.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">Belum ada dokumen yang diunggah.</p>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div 
                key={doc.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-900/80 rounded-lg border border-white/10 gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-800 rounded border border-white/10 text-sky-400">
                    <ScanText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-white">{doc.fileName}</div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(doc.uploadedAt).toLocaleDateString('id-ID')}
                      </span>
                      <span>{(doc.fileSize / 1024).toFixed(0)} KB</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-white/10">
                    {doc.verifiedCount} / {doc.extractedCount} Terverifikasi
                  </span>
                  <Link
                    href="/app/verify"
                    className="px-3 py-1.5 bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs font-medium rounded transition-colors"
                  >
                    Buka Verifikasi
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
