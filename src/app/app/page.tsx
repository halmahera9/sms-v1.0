'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
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

function DashboardOverviewContent() {
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
    <div className="space-y-8" suppressHydrationWarning>
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
    </div>
  );
}

export default dynamic(() => Promise.resolve(DashboardOverviewContent), {
  ssr: false,
  loading: () => (
    <div className="p-8 text-center text-slate-400 font-mono text-xs">
      Memuat Dashboard Ringkasan SMS...
    </div>
  ),
});
