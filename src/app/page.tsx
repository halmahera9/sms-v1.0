import Link from 'next/link';

const features = [
  {
    title: 'Administrasi Terpusat',
    text: 'Data dan administrasi sekolah tersimpan dalam satu sistem yang terstruktur.',
  },
  {
    title: 'Dokumen Digital',
    text: 'Kelola surat, berkas, formulir, dan arsip sekolah tanpa bergantung pada tumpukan dokumen fisik.',
  },
  {
    title: 'Form Digital',
    text: 'Sediakan formulir untuk guru, pegawai, siswa, dan orang tua dengan proses pengumpulan yang lebih rapi.',
  },
  {
    title: 'Kecerdasan Buatan',
    text: 'AI membantu membaca, mengolah, mencocokkan, dan memvalidasi informasi dari dokumen sekolah.',
  },
  {
    title: 'Verifikasi Admin',
    text: 'Keputusan administratif tetap berada pada operator dan admin sekolah.',
  },
  {
    title: 'Penyimpanan Sekolah',
    text: 'Database, berkas, dan dokumen dikelola pada server sekolah sebagai pusat penyimpanan.',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src="/brand/banyubiru-icon.png"
            alt="Banyubiru"
            className="h-9 w-9 shrink-0 object-contain"
          />

          <div className="flex flex-col">
            <span className="text-[15px] font-semibold leading-[18px] tracking-[-0.02em] text-slate-900">
              Banyubiru
            </span>
            <span className="mt-[2px] text-[8px] font-medium uppercase leading-[11px] tracking-[0.18em] text-slate-400">
              Digital Solution
            </span>
          </div>
        </Link>

        <Link
          href="/login"
          className="rounded-full bg-[#0f172a] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#172554]"
        >
          Masuk
        </Link>
      </nav>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-14 lg:px-8 lg:pb-28 lg:pt-24">
        <div className="max-w-4xl">
          <div className="mb-6 inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-500 shadow-sm">
            Administrasi Sekolah · Data · Dokumen · AI
          </div>

          <h1 className="max-w-4xl text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-[#0f172a] sm:text-5xl lg:text-7xl">
            Administrasi sekolah,
            <br />
            <span className="text-[#2563eb]">lebih terstruktur.</span>
          </h1>

          <p className="mt-7 max-w-2xl text-base leading-7 text-slate-500 sm:text-lg">
            Banyubiru Digital Solution membantu sekolah mengelola data,
            dokumen, formulir, dan arsip dalam satu sistem—dengan kecerdasan
            buatan yang berjalan pada server sekolah.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-full bg-[#2563eb] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]"
            >
              Masuk ke Sistem
            </Link>
            <a
              href="/"
              className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300"
            >
              Lihat kemampuan
            </a>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 lg:grid-cols-3 lg:px-8">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
              Satu pusat data
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
              Data sekolah tetap berada dalam kendali sekolah.
            </h2>
          </div>

          <p className="text-sm leading-7 text-slate-500 lg:col-span-2 lg:max-w-2xl">
            Server sekolah menjadi pusat penyimpanan database, berkas, dan
            dokumen. Banyubiru menyediakan lapisan aplikasi untuk membantu
            mengelola informasi tersebut secara lebih teratur dan mudah
            digunakan.
          </p>
        </div>
      </section>

      <section id="fitur" className="mx-auto max-w-6xl px-6 py-20 lg:px-8 lg:py-24">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
            Kemampuan
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            Dari data masuk sampai menjadi arsip yang siap digunakan.
          </h2>
          <p className="mt-4 text-sm leading-6 text-slate-500">
            Dibangun untuk kebutuhan administrasi sekolah sehari-hari, bukan
            sekadar mengganti formulir kertas menjadi formulir digital.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)]"
            >
              <h3 className="text-base font-semibold tracking-[-0.015em]">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {feature.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#0f172a]">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-16 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-400">
              Banyubiru Digital Solution
            </div>
            <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.035em] text-white sm:text-4xl">
              Teknologi yang membantu administrasi sekolah bekerja lebih rapi.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              AI membantu pekerjaan administratif. Operator dan admin tetap
              memegang kendali atas data, verifikasi, dan keputusan.
            </p>
          </div>

          <Link
            href="/login"
            className="inline-flex w-fit rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0f172a] transition hover:bg-slate-100"
          >
            Masuk ke Banyubiru
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-7 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span>Banyubiru Digital Solution</span>
          <span>Administrative Intelligence for Schools</span>
        </div>
      </footer>
    </main>
  );
}
