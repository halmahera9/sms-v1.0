'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  UserRound,
  FileText,
  Clock3,
  Upload,
  CheckCircle2,
  FileSpreadsheet,
  History,
  ArrowUpRight,
  Database,
} from 'lucide-react';

import { getOperationalMetricsAction } from '@/platform/actions/operational';
import type { OperationalMetrics } from '@/platform/repositories/operational-query';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<OperationalMetrics | null>(null);

  useEffect(() => {
    let mounted = true;

    getOperationalMetricsAction().then((result) => {
      if (mounted && result.success && result.data) {
        setMetrics(result.data);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const students = metrics?.totalStudents ?? 0;
  const employees = metrics?.totalEmployees ?? 0;
  const documents = metrics?.totalDocumentsProcessed ?? 0;
  const pending = metrics?.pendingVerifications ?? 0;

  const totalSchoolPeople = students + employees;

  const overviewCards = [
    {
      title: 'Siswa',
      value: students,
      description: 'Data siswa terdaftar',
      href: '/app/students',
      icon: Users,
    },
    {
      title: 'Guru & Karyawan',
      value: employees,
      description: 'Data tenaga sekolah',
      href: '/app/employees',
      icon: UserRound,
    },
    {
      title: 'Dokumen',
      value: documents,
      description: 'Dokumen yang tersimpan',
      href: '/app/ocr',
      icon: FileText,
    },
    {
      title: 'Menunggu Verifikasi',
      value: pending,
      description: 'Perlu ditinjau operator',
      href: '/app/verify',
      icon: Clock3,
    },
  ];

  const quickActions = [
    {
      title: 'Unggah Dokumen',
      description: 'Tambahkan dokumen baru',
      href: '/app/ocr',
      icon: Upload,
    },
    {
      title: 'Verifikasi',
      description: 'Tinjau dokumen yang masuk',
      href: '/app/verify',
      icon: CheckCircle2,
    },
    {
      title: 'Data Siswa',
      description: 'Kelola data siswa',
      href: '/app/students',
      icon: Users,
    },
    {
      title: 'Guru & Karyawan',
      description: 'Kelola data tenaga sekolah',
      href: '/app/employees',
      icon: UserRound,
    },
    {
      title: 'Ekspor Data',
      description: 'Unduh data administrasi',
      href: '/app/export',
      icon: FileSpreadsheet,
    },
    {
      title: 'Riwayat Aktivitas',
      description: 'Lihat aktivitas sistem',
      href: '/app/audit',
      icon: History,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
      {/* Header */}
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-blue-600">
            BANYUBIRU DIGITAL SOLUTION
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#111b33] sm:text-4xl">
            Pusat administrasi sekolah.
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Kelola data siswa, guru, karyawan, dokumen, dan proses administrasi
            sekolah dalam satu ruang kerja yang terstruktur.
          </p>
        </div>

        <Link
          href="/app/ocr"
          className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Upload className="h-4 w-4" />
          Unggah Dokumen
        </Link>
      </section>

      {/* Hero */}
      <section className="relative mt-7 min-h-[235px] overflow-hidden rounded-[24px] border border-blue-100 bg-[#eef6ff]">
        <div className="absolute inset-y-0 right-0 w-full lg:w-[58%]">
          <div
            className="absolute inset-0 bg-cover bg-center"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-[#eef6ff] via-[#eef6ff]/90 to-[#eef6ff]/20 lg:via-[#eef6ff]/75 lg:to-transparent" />
        </div>

        <div className="relative z-10 flex min-h-[235px] items-center px-7 py-8 sm:px-10">
          <div className="max-w-2xl">
              {/* Decorative geometry */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden"
              >
                {/* soft cyan glow */}
                <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />

                {/* soft blue glow */}
                <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-blue-600/10 blur-3xl" />

                {/* geometric ring */}
                <div className="absolute -right-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full border border-blue-600/[0.08]" />
                <div className="absolute -right-8 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full border border-cyan-400/[0.10]" />

                {/* diagonal grid */}
                <div
                  className="absolute right-8 top-8 h-28 w-28 opacity-[0.16]"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, transparent 49%, rgba(37,99,235,0.35) 50%, transparent 51%), linear-gradient(45deg, transparent 49%, rgba(6,182,212,0.25) 50%, transparent 51%)",
                    backgroundSize: "18px 18px",
                  }}
                />

                {/* small accent blocks */}
                <div className="absolute right-12 bottom-10 h-3 w-3 rounded-full bg-cyan-400/30" />
                <div className="absolute right-20 bottom-16 h-1.5 w-1.5 rounded-full bg-blue-600/30" />

                {/* subtle vertical line */}
                <div className="absolute right-[31%] top-0 h-full w-px bg-gradient-to-b from-transparent via-blue-600/[0.06] to-transparent" />
              </div>

            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-blue-600">
              SMP NEGERI 99 JAKARTA
            </p>

            <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight text-[#12346b] sm:text-4xl">
              Selamat datang di{' '}
              <span className="text-blue-600">Banyubiru.</span>
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
              Satu ruang untuk mengelola data sekolah, dokumen, dan kebutuhan
              administrasi sehari-hari dengan lebih rapi dan terstruktur.
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/85 px-4 py-2.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur">
              <Database className="h-3.5 w-3.5 text-blue-600" />
              Data dan dokumen tetap dikelola dalam lingkungan sekolah.
            </div>
          </div>
        </div>
      </section>

      {/* Data overview */}
      <section className="mt-8">
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-blue-600">
            DATA SEKOLAH
          </p>

          <h2 className="mt-1 text-xl font-black tracking-tight text-[#111b33]">
            Gambaran data saat ini
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Icon className="h-5 w-5" />
                  </div>

                  <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-blue-500" />
                </div>

                <p className="mt-5 text-xs font-medium text-slate-500">
                  {item.title}
                </p>

                <p className="mt-1 text-3xl font-black tracking-tight text-[#111b33]">
                  {item.value}
                </p>

                <p className="mt-1 text-[11px] text-slate-400">
                  {item.description}
                </p>
              </Link>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Database className="h-4 w-4 text-blue-600" />
            Total data warga sekolah
          </div>

          <span className="text-sm font-black text-[#111b33]">
            {totalSchoolPeople}
          </span>
        </div>
      </section>

      {/* Quick actions */}
      <section className="mt-8">
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-blue-600">
            AKSES CEPAT
          </p>

          <h2 className="mt-1 text-xl font-black tracking-tight text-[#111b33]">
            Pekerjaan yang sering dilakukan
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Icon className="h-5 w-5" />
                  </div>

                  <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-blue-500" />
                </div>

                <p className="mt-4 text-sm font-bold text-[#111b33]">
                  {item.title}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {item.description}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Bottom summary */}
      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">
            KONDISI DATA
          </p>

          <h3 className="mt-2 text-lg font-black text-[#111b33]">
            Ringkasan administrasi
          </h3>

          <div className="mt-5 space-y-2">
            <SummaryRow label="Siswa" value={`${students} data`} />
            <SummaryRow
              label="Guru & karyawan"
              value={`${employees} data`}
            />
            <SummaryRow label="Dokumen" value={`${documents} dokumen`} />
            <SummaryRow
              label="Menunggu verifikasi"
              value={`${pending} item`}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-[#eef6ff] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">
            BANYUBIRU
          </p>

          <h3 className="mt-2 text-lg font-black text-[#12346b]">
            Administrasi yang baik, mendukung pendidikan yang lebih baik.
          </h3>

          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Banyubiru dirancang sebagai ruang kerja administrasi sekolah,
            bukan sekadar tempat menyimpan data dan dokumen.
          </p>
        </div>
      </section>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <span className="text-xs font-bold text-[#111b33]">{value}</span>
    </div>
  );
}
