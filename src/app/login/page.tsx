'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  ShieldCheck,
  UserRound,
  Database,
  BrainCircuit,
} from 'lucide-react';
import { useState } from 'react';
import { loginAction } from '@/platform/actions/auth';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col px-5 py-5 sm:px-8 lg:px-10 lg:py-6">

        {/* Header */}
        <header className="flex shrink-0 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/brand/banyubiru-icon.png"
              alt="Banyubiru"
              className="h-9 w-9 object-contain"
            />

            <div className="leading-none">
              <div className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900">
                Banyubiru
              </div>
              <div className="mt-1 text-[8px] font-medium uppercase tracking-[0.18em] text-slate-400">
                Digital Solution
              </div>
            </div>
          </Link>

          <Link
            href="/"
            className="hidden text-sm font-medium text-slate-500 transition hover:text-slate-900 sm:block"
          >
            Kembali ke beranda
          </Link>
        </header>

        {/* Main */}
        <section className="grid flex-1 items-center py-7 lg:grid-cols-2 lg:gap-6 lg:py-8">

          {/* Brand / Information Panel */}
          <div className="relative flex min-h-[560px] overflow-hidden rounded-[24px] bg-[#071b4b] text-white lg:min-h-[650px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_15%_90%,rgba(37,99,235,0.20),transparent_35%)]" />

            <div className="relative flex w-full flex-col p-8 sm:p-10 lg:p-12">

              <div className="flex items-center gap-3">
                <img
                  src="/brand/banyubiru-icon.png"
                  alt=""
                  className="h-10 w-10 object-contain"
                />
                <div>
                  <p className="text-[15px] font-semibold tracking-[-0.02em]">
                    Banyubiru
                  </p>
                  <p className="mt-1 text-[8px] font-medium uppercase tracking-[0.18em] text-blue-200/70">
                    Digital Solution
                  </p>
                </div>
              </div>

              <div className="mt-auto max-w-[520px]">
                <div className="mb-5 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-medium tracking-wide text-cyan-200">
                  ADMINISTRASI SEKOLAH
                </div>

                <h1 className="max-w-[520px] text-[36px] font-semibold leading-[1.08] tracking-[-0.045em] sm:text-[42px] lg:text-[48px]">
                  Satu ruang untuk
                  <span className="block text-cyan-300">
                    administrasi sekolah.
                  </span>
                </h1>

                <p className="mt-5 max-w-[480px] text-[14px] leading-6 text-blue-100/75">
                  Banyubiru membantu sekolah mengelola data, dokumen,
                  formulir, dan arsip secara terstruktur dengan kecerdasan
                  buatan yang berjalan pada server sekolah.
                </p>

                <div className="mt-8 grid max-w-[500px] gap-3 sm:grid-cols-3">
                  <InfoItem
                    icon={Database}
                    title="Data"
                    text="Terpusat"
                  />
                  <InfoItem
                    icon={FileText}
                    title="Dokumen"
                    text="Terorganisir"
                  />
                  <InfoItem
                    icon={BrainCircuit}
                    title="AI"
                    text="Terintegrasi"
                  />
                </div>
              </div>

              <div className="mt-8 border-t border-white/10 pt-5">
                <p className="text-[11px] text-blue-200/60">
                  Data dan dokumen dikelola pada infrastruktur sekolah.
                </p>
              </div>
            </div>
          </div>

          {/* Login Panel */}
          <div className="flex min-h-[560px] items-center rounded-[24px] border border-slate-200/90 bg-white px-7 py-9 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:px-10 lg:min-h-[650px] lg:px-14">
            <div className="mx-auto w-full max-w-[410px]">

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-600">
                  Akses Sekolah
                </p>

                <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.04em] text-slate-900 sm:text-[34px]">
                  Selamat datang kembali.
                </h2>

                <p className="mt-3 max-w-[360px] text-[13px] leading-6 text-slate-500">
                  Masuk menggunakan akun yang telah terdaftar pada
                  sistem administrasi sekolah.
                </p>
              </div>

              <form
                action={async (formData) => {
                  setError(null);
                  setPending(true);

                  const result = await loginAction(formData);

                  if (!result.ok) {
                    setError(result.error);
                    setPending(false);
                  }
                }}
                className="mt-8 space-y-5"
              >
                <div>
                  <label
                    htmlFor="username"
                    className="mb-2 block text-[12px] font-medium text-slate-700"
                  >
                    Nama pengguna
                  </label>

                  <div className="flex h-[46px] items-center rounded-[12px] border border-slate-200 bg-slate-50/40 px-3.5 transition focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10">
                    <UserRound className="h-[16px] w-[16px] shrink-0 text-slate-400" />

                    <input
                      id="username"
                      name="username"
                      autoComplete="username"
                      className="w-full bg-transparent px-3 text-[13px] text-slate-900 outline-none placeholder:text-slate-400"
                      placeholder="Masukkan nama pengguna"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-[12px] font-medium text-slate-700"
                  >
                    Kata sandi
                  </label>

                  <div className="flex h-[46px] items-center rounded-[12px] border border-slate-200 bg-slate-50/40 px-3.5 transition focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10">
                    <KeyRound className="h-[16px] w-[16px] shrink-0 text-slate-400" />

                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      className="w-full bg-transparent px-3 text-[13px] text-slate-900 outline-none placeholder:text-slate-400"
                      placeholder="Masukkan kata sandi"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="shrink-0 text-slate-400 transition hover:text-slate-700"
                      aria-label={
                        showPassword
                          ? 'Sembunyikan kata sandi'
                          : 'Tampilkan kata sandi'
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-[16px] w-[16px]" />
                      ) : (
                        <Eye className="h-[16px] w-[16px]" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-3 text-[12px] leading-5 text-red-700"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="flex h-[46px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#0f172a] px-5 text-[13px] font-semibold text-white transition hover:bg-[#172554] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? 'Memproses...' : 'Masuk ke Banyubiru'}

                  {!pending && (
                    <ArrowRight className="h-[15px] w-[15px]" />
                  )}
                </button>
              </form>

              <div className="mt-7 flex items-start gap-3 border-t border-slate-100 pt-6">
                <ShieldCheck className="mt-0.5 h-[17px] w-[17px] shrink-0 text-blue-600" />

                <div>
                  <p className="text-[12px] font-medium text-slate-700">
                    Akses terkelola sekolah
                  </p>

                  <p className="mt-1 text-[11px] leading-5 text-slate-400">
                    Akses sistem diberikan sesuai akun dan peran
                    yang terdaftar pada sekolah.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="flex shrink-0 items-center justify-between border-t border-slate-200 py-4 text-[10px] text-slate-400">
          <span>© 2026 Banyubiru Digital Solution</span>
          <span className="hidden sm:block">
            Administrative Intelligence for Schools
          </span>
        </footer>
      </div>
    </main>
  );
}

function InfoItem({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Database;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[12px] border border-white/10 bg-white/[0.045] px-3.5 py-3">
      <Icon className="h-[16px] w-[16px] text-cyan-300" />

      <p className="mt-2 text-[11px] font-semibold text-white">
        {title}
      </p>

      <p className="mt-0.5 text-[10px] text-blue-200/60">
        {text}
      </p>
    </div>
  );
}
