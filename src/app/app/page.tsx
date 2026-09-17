'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  FileText,
  Clock3,
  CheckCircle2,
  Upload,
  ShieldCheck,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
import { getStoredStudents, getStoredDocuments } from '@/lib/storage';
import { Student, OCRDocument } from '@/types/sms';

export default function DashboardPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [documents, setDocuments] = useState<OCRDocument[]>([]);

  useEffect(() => {
    setStudents(getStoredStudents());
    setDocuments(getStoredDocuments());
  }, []);

  const totalExtracted = documents.reduce(
    (sum, document) => sum + document.extractedCount,
    0,
  );

  const totalVerified = documents.reduce(
    (sum, document) => sum + document.verifiedCount,
    0,
  );

  const pendingCount = Math.max(totalExtracted - totalVerified, 0);

  const metrics = [
    {
      title: 'Master Data Siswa',
      value: students.length,
      description: 'Siswa terdaftar dari Dapodik',
      href: '/app/students',
      icon: Users,
    },
    {
      title: 'Dokumen Diproses',
      value: documents.length,
      description: `${totalExtracted} nama berhasil diekstraksi`,
      href: '/app/ocr',
      icon: FileText,
    },
    {
      title: 'Perlu Verifikasi',
      value: pendingCount,
      description: 'Menunggu persetujuan operator',
      href: '/app/verify',
      icon: Clock3,
    },
    {
      title: 'Terverifikasi',
      value: totalVerified,
      description: 'Siap diekspor ke Excel & PDF',
      href: '/app/export',
      icon: CheckCircle2,
    },
  ];

  const quickActions = [
    {
      title: 'Upload Dokumen',
      description: 'Unggah dokumen baru',
      href: '/app/ocr',
      icon: Upload,
    },
    {
      title: 'Verifikasi Dokumen',
      description: 'Proses verifikasi',
      href: '/app/verify',
      icon: CheckCircle2,
    },
    {
      title: 'Lihat Data Siswa',
      description: 'Akses master data',
      href: '/app/students',
      icon: Users,
    },
    {
      title: 'Ekspor Excel',
      description: 'Unduh data',
      href: '/app/export',
      icon: FileText,
    },
    {
      title: 'Audit Trail',
      description: 'Lihat riwayat aktivitas',
      href: '/app/audit',
      icon: ShieldCheck,
    },
    {
      title: 'Analitik',
      description: 'Lihat ringkasan sistem',
      href: '/app/audit',
      icon: BarChart3,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6">

      {/* Page heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-blue-600">
            SISTEM MANAJEMEN SEKOLAH
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            Beranda
          </h1>
        </div>

        <Link
          href="/app/ocr"
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-slate-900 shadow-sm transition hover:bg-blue-700"
        >
          <Upload className="h-4 w-4" />
          Upload Dokumen
        </Link>
      </div>

      {/* Hero */}
      <section className="relative min-h-[250px] overflow-hidden rounded-[24px] border border-blue-100 bg-[#eef6ff]">
        <div className="absolute inset-y-0 right-0 w-[58%]">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://kelulusan.smpn99jkt.sch.id/assets/img/header/banner22.jpg')",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#eef6ff] via-[#eef6ff]/75 to-transparent" />
        </div>

        <div className="relative z-10 flex min-h-[250px] items-center px-7 py-8 sm:px-10">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-blue-600">
              SMP NEGERI 99 JAKARTA
            </p>

            <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight text-[#102b5f] sm:text-4xl">
              Selamat datang di{' '}
              <span className="text-blue-600">Banyubiru.</span>
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
              Kelola data sekolah, dokumen, dan proses administrasi dengan lebih
              mudah, cepat, dan terorganisir.
            </p>

            <div className="mt-5 inline-flex rounded-xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-medium text-slate-700 backdrop-blur">
              Administrasi yang baik, mendukung pendidikan yang lebih baik.
            </div>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.title}
              href={item.href}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              <p className="mt-5 text-sm font-semibold text-slate-600">
                {item.title}
              </p>

              <p className="mt-1 text-3xl font-black tracking-tight text-slate-900">
                {item.value}
              </p>

              <p className="mt-1 text-xs text-slate-600">
                {item.description}
              </p>

              <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-blue-600">
                Lihat detail
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </section>

      {/* Lower dashboard */}
      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">

        {/* Quick actions */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Aksi Cepat</h3>
              <p className="mt-1 text-xs text-slate-600">
                Pilih layanan yang sering digunakan
              </p>
            </div>

            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group rounded-xl border border-slate-200 bg-white px-4 py-5 text-center transition hover:border-blue-200 hover:bg-blue-50/40"
                >
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Icon className="h-5 w-5" />
                  </div>

                  <p className="mt-3 text-sm font-bold text-slate-900">
                    {item.title}
                  </p>

                  <p className="mt-1 text-xs text-slate-600">
                    {item.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Activity summary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <BarChart3 className="h-5 w-5" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Ringkasan Aktivitas
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Kondisi data saat ini
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <Activity label="Data siswa" value={`${students.length} siswa terdaftar`} />
            <Activity label="Dokumen" value={`${documents.length} dokumen diproses`} />
            <Activity label="Verifikasi" value={`${pendingCount} item menunggu`} />
            <Activity label="Selesai" value={`${totalVerified} item terverifikasi`} />
          </div>
        </div>
      </section>
    </div>
  );
}

function Activity({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <span className="text-xs text-slate-600">{value}</span>
    </div>
  );
}
