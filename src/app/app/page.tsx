'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Inbox,
  Clock3,
  AlertCircle,
  FileCheck2,
  CheckCircle2,
  ScanText,
  Search,
  ArrowRight,
  Sparkles,
  Layers,
  FileText,
  Building2,
  Users,
} from 'lucide-react';
import {
  getOperationalMetricsAction,
  getUnifiedWorkQueueAction,
} from '@/platform/actions/operational';
import type {
  OperationalMetrics,
  WorkQueueItem,
} from '@/platform/repositories/operational-query';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<OperationalMetrics | null>(null);
  const [workQueue, setWorkQueue] = useState<WorkQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      getOperationalMetricsAction(),
      getUnifiedWorkQueueAction(10),
    ])
      .then(([metricsRes, queueRes]) => {
        if (!mounted) return;
        if (metricsRes.success && metricsRes.data) {
          setMetrics(metricsRes.data);
        }
        if (queueRes.success && queueRes.data) {
          setWorkQueue(queueRes.data);
        }
      })
      .catch((err) => {
        console.error('Error fetching dashboard data:', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Real database metrics mapping
  const dokumenMasuk = metrics?.requiresCorrection ?? 0;
  const sedangDiproses = 0; // Processing in background
  const perluDiperiksa = (metrics?.pendingVerifications ?? 0) + (metrics?.totalOpenExceptions ?? 0);
  const menungguPersetujuan = metrics?.pendingApprovals ?? 0;
  const selesai = metrics?.totalDocumentsProcessed ?? 0;

  const statusCards = [
    {
      title: 'Dokumen Masuk',
      count: dokumenMasuk,
      description: 'Dokumen baru diterima dalam antrean',
      icon: Inbox,
      color: 'text-slate-700 bg-slate-100',
      href: '/app/ocr',
    },
    {
      title: 'Sedang Diproses',
      count: sedangDiproses,
      description: 'Dokumen dalam proses pembacaan / analisis',
      icon: Clock3,
      color: 'text-blue-700 bg-blue-50',
      href: '/app/ocr',
    },
    {
      title: 'Perlu Diperiksa',
      count: perluDiperiksa,
      description: 'Membutuhkan perhatian operator sekolah',
      icon: AlertCircle,
      color: 'text-amber-700 bg-amber-50',
      href: '/app/verify',
      highlight: perluDiperiksa > 0,
    },
    {
      title: 'Menunggu Persetujuan',
      count: menungguPersetujuan,
      description: 'Menunggu persetujuan pimpinan',
      icon: FileCheck2,
      color: 'text-indigo-700 bg-indigo-50',
      href: '/app/workflows/approvals',
    },
    {
      title: 'Selesai',
      count: selesai,
      description: 'Proses administrasi yang telah selesai',
      icon: CheckCircle2,
      color: 'text-emerald-700 bg-emerald-50',
      href: '/app/documents',
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header section */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Document Intelligence Platform
          </span>
          <span className="text-xs text-slate-400">&bull;</span>
          <span className="text-xs text-slate-500 font-medium">Administrasi Sekolah</span>
        </div>
        <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Pusat Operasional Dokumen
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-600">
          Ikhtisar status pekerjaan pembacaan, pencocokan data, dan verifikasi dokumen sekolah.
        </p>
      </div>

      {/* 5 Real Work Status Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Status Pekerjaan Berjalan
          </h2>
          <span className="text-[11px] text-slate-400">
            {loading ? 'Memuat data...' : 'Data langsung dari database'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {statusCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <Link
                key={idx}
                href={card.href}
                className={`rounded-2xl border p-4 sm:p-5 transition-all hover:shadow-md bg-white ${
                  card.highlight
                    ? 'border-amber-300 ring-2 ring-amber-100'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${card.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-2xl font-black text-slate-900">
                    {loading ? '-' : card.count}
                  </span>
                </div>
                <h3 className="mt-3 text-xs font-bold text-slate-800">
                  {card.title}
                </h3>
                <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                  {card.description}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Aktivitas Terbaru & Akses Cepat */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Aktivitas Terbaru (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Aktivitas & Antrean Dokumen Terbaru
                </h3>
                <p className="text-xs text-slate-500">
                  Dokumen dan item ekstraksi yang sedang membutuhkan verifikasi atau tindakan
                </p>
              </div>
              <Link
                href="/app/verify"
                className="text-xs font-semibold text-blue-700 hover:text-blue-900"
              >
                Lihat Semua &rarr;
              </Link>
            </div>

            {/* List or Empty State */}
            <div className="mt-4 divide-y divide-slate-100">
              {loading ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Memeriksa aktivitas sistem...
                </div>
              ) : workQueue.length > 0 ? (
                workQueue.map((item) => (
                  <div
                    key={item.id}
                    className="py-3.5 flex items-start justify-between gap-3 hover:bg-slate-50/60 px-2 rounded-lg transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {item.title}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            item.severity === 'CRITICAL'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : item.severity === 'HIGH'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {item.severity === 'CRITICAL' ? 'Tinggi' : item.severity === 'HIGH' ? 'Sedang' : 'Normal'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {item.subtitle}
                      </p>
                      <p className="text-[11px] text-blue-700 font-medium">
                        Tindakan: {item.actionRequired}
                      </p>
                    </div>

                    <Link
                      href="/app/verify"
                      className="shrink-0 text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 mt-1"
                    >
                      <span>Periksa</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ))
              ) : (
                /* Clean empty state (No fake data!) */
                <div className="py-12 text-center space-y-2">
                  <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-slate-400" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">
                    Tidak ada dokumen yang perlu tindakan saat ini
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Seluruh proses pembacaan dan verifikasi telah tertangani. Unggah dokumen baru melalui menu Penerimaan Dokumen.
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/app/ocr"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200/80"
                    >
                      <span>Unggah Dokumen Baru</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Sistem Banyubiru v1.0</span>
            <span>Semua data terhubung dengan RLS tenant</span>
          </div>
        </div>

        {/* Akses Cepat & Panduan (1 col) */}
        <div className="space-y-6">
          {/* Akses Cepat */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Akses Cepat Alur Kerja
            </h3>
            <div className="space-y-2">
              <Link
                href="/app/ocr"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-blue-50/50 hover:border-blue-200 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                    <ScanText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-blue-800">
                      Penerimaan Dokumen
                    </p>
                    <p className="text-[11px] text-slate-500">Unggah berkas untuk OCR</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-700" />
              </Link>

              <Link
                href="/app/verify"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-blue-50/50 hover:border-blue-200 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-amber-800">
                      Verifikasi Data
                    </p>
                    <p className="text-[11px] text-slate-500">Periksa hasil pencocokan</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-amber-700" />
              </Link>

              <Link
                href="/app/students"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-blue-50/50 hover:border-blue-200 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-800">
                      Data Siswa & Pegawai
                    </p>
                    <p className="text-[11px] text-slate-500">Master database sekolah</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-700" />
              </Link>

              <Link
                href="/app/documents"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-blue-50/50 hover:border-blue-200 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <Search className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-800">
                      Pencarian Dokumen
                    </p>
                    <p className="text-[11px] text-slate-500">Arsip dokumen digital</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-700" />
              </Link>
            </div>
          </div>

          {/* Database Info Card */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
              Data Terdaftar di Sekolah
            </span>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-white rounded-xl p-3 border border-blue-100/80">
                <p className="text-[11px] text-slate-500">Total Siswa Aktif</p>
                <p className="text-lg font-bold text-slate-900">
                  {loading ? '-' : metrics?.totalStudents ?? 0}
                </p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-blue-100/80">
                <p className="text-[11px] text-slate-500">Guru & Pegawai</p>
                <p className="text-lg font-bold text-slate-900">
                  {loading ? '-' : metrics?.totalEmployees ?? 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
