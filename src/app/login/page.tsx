'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, Eye, EyeOff, FileText, KeyRound, ShieldCheck, UserRound, UsersRound, BarChart3 } from 'lucide-react';
import { useState } from 'react';
import { loginAction } from '@/platform/actions/auth';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <main className="min-h-screen bg-[#f5f8fc] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#082b78] shadow-sm">
              <span className="text-xl font-black text-cyan-300">B</span>
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">Banyubiru</div>
              <div className="text-xs text-slate-500">Administrative Intelligence Platform</div>
            </div>
          </Link>

          <Link
            href="/"
            className="hidden items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 sm:flex"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Beranda
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-6 py-8 lg:grid-cols-2 lg:gap-8">
          {/* Brand panel */}
          <div className="relative min-h-[620px] overflow-hidden rounded-[28px] bg-[#082b78] p-8 text-white shadow-xl sm:p-10 lg:p-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(34,211,238,.22),transparent_35%),linear-gradient(145deg,#061d58,#0b347f)]" />

            <div className="relative z-10 flex h-full flex-col">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-300">
                BANYUBIRU DIGITAL SOLUTION
              </p>

              <h1 className="mt-7 max-w-lg text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
                Administrasi sekolah
                <span className="block text-cyan-300">lebih mudah dan bermakna.</span>
              </h1>

              <p className="mt-6 max-w-lg text-sm leading-7 text-blue-100 sm:text-base">
                Kelola data siswa, pegawai, dokumen, dan proses layanan sekolah
                dalam satu platform yang aman, terpadu, dan terpercaya.
              </p>

              <div className="mt-9 space-y-5">
                <Feature icon={FileText} title="Pengelolaan Dokumen" text="Digital, rapi, dan terintegrasi" />
                <Feature icon={UsersRound} title="Data Siswa & Pegawai" text="Akurat dan selalu terbarui" />
                <Feature icon={BarChart3} title="Proses Layanan" text="Lebih cepat dan transparan" />
                <Feature icon={ShieldCheck} title="Aman & Terpercaya" text="Berbasis peran dan multi-tenant" />
              </div>

              <div className="mt-auto border-t border-white/15 pt-6">
                <div className="mb-3 h-1 w-12 rounded-full bg-cyan-300" />
                <p className="text-sm font-bold">SMP Negeri 99 Jakarta</p>
                <p className="mt-1 text-xs text-blue-200">
                  Bersama menuju sekolah yang lebih baik.
                </p>
              </div>
            </div>
          </div>

          {/* Login panel */}
          <div className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-xl sm:p-10 lg:p-11">
            <div className="max-w-xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-blue-600">
                AKUN SEKOLAH
              </p>

              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                Masuk ke Pusat Dokumen
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                Gunakan akun operator, guru, atau siswa yang sudah dibuat oleh sekolah.
              </p>

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
                  <label htmlFor="username" className="mb-2 block text-sm font-semibold text-slate-700">
                    Nama pengguna
                  </label>
                  <div className="flex items-center rounded-xl border border-slate-200 bg-white px-4 shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
                    <UserRound className="h-4 w-4 text-slate-400" />
                    <input
                      id="username"
                      name="username"
                      autoComplete="username"
                      className="w-full bg-transparent px-3 py-3.5 text-sm font-medium outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">
                    Kata sandi
                  </label>
                  <div className="flex items-center rounded-xl border border-slate-200 bg-white px-4 shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
                    <KeyRound className="h-4 w-4 text-slate-400" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      className="w-full bg-transparent px-3 py-3.5 text-sm font-medium outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
                >
                  {pending ? "Memproses..." : "Masuk"}
                  {!pending && <ArrowRight className="h-4 w-4" />}
                </button>
              </form>

              <div className="my-7 flex items-center gap-4 text-xs text-slate-400">
                <div className="h-px flex-1 bg-slate-200" />
                atau
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
                <div className="flex gap-3">
                  <div className="mt-0.5 text-blue-600">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="text-sm">
                    <p className="font-bold text-blue-700">Akun sekolah</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Gunakan kredensial yang diberikan oleh administrator sekolah.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="mx-auto mt-7 flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                <span className="text-cyan-500">◈</span>
                Masuk dengan token publik
              </button>
            </div>
          </div>
        </section>

        <footer className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 py-5 text-xs text-slate-500 sm:flex-row">
          <span>© 2026 Banyubiru Digital Solution. All rights reserved.</span>
          <div className="flex gap-3">
            <span>Privasi</span>
            <span>•</span>
            <span>Ketentuan</span>
            <span>•</span>
            <span>Bantuan</span>
          </div>
        </footer>
      </div>
    </main>
  );
}

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof FileText;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-cyan-200 ring-1 ring-white/10">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-0.5 text-xs text-blue-200">{text}</p>
      </div>
    </div>
  );
}
