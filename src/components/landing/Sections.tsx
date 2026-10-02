import Link from 'next/link';
import {
  FileText,
  ScanText,
  Search,
  CheckCircle2,
  Workflow,
  FileCheck,
  Building,
  GraduationCap,
  Users,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Inbox,
  Clock,
  Layers,
} from 'lucide-react';

export default function Sections() {
  const steps = [
    {
      num: '01',
      title: 'Dokumen Masuk',
      desc: 'Dokumen dapat berasal dari unggahan file, hasil pemindaian, kamera, formulir pengumpulan dokumen, dokumen kiriman instansi, atau sumber digital lainnya.',
      icon: Inbox,
    },
    {
      num: '02',
      title: 'Dokumen Dibaca',
      desc: 'Sistem membaca teks dan informasi dari dokumen. OCR digunakan untuk membantu mengenali teks dari PDF, hasil pemindaian scanner, foto, dan gambar dokumen.',
      icon: ScanText,
    },
    {
      num: '03',
      title: 'Isi Dokumen Dipahami',
      desc: 'Sistem mengenali jenis dokumen, nama, nomor identitas, tanggal, tujuan, daftar penerima, intisari penting, dan informasi kontekstual lainnya.',
      icon: Layers,
    },
    {
      num: '04',
      title: 'Data Dicocokkan',
      desc: 'Informasi dokumen dicocokkan dengan database sekolah: data Siswa (nama, NISN, NIK, kelas), Guru (nama, NIP, NIK, jabatan), maupun Karyawan.',
      icon: Users,
    },
    {
      num: '05',
      title: 'Data Divalidasi',
      desc: 'Hasil pencocokan diperiksa berdasarkan aturan yang berlaku. Jika data tidak jelas, berbeda, atau tidak ditemukan, sistem menandainya sebagai "Perlu Diperiksa".',
      icon: CheckCircle2,
    },
    {
      num: '06',
      title: 'Proses Administrasi',
      desc: 'Data yang cocok digunakan untuk menjalankan pekerjaan administrasi, misalnya mengidentifikasi kriteria guru yang ditugaskan dalam surat dinas.',
      icon: Workflow,
    },
    {
      num: '07',
      title: 'Dokumen Dihasilkan',
      desc: 'Berdasarkan data dan template yang tersedia, sistem membantu menghasilkan draft dokumen seperti Surat Tugas, Surat Keterangan, atau Surat Pengantar.',
      icon: FileCheck,
    },
  ];

  return (
    <div className="space-y-24 py-16 sm:py-24">
      {/* ------------------------------------------------------------- */}
      {/* 1. APA ITU DOCUMENT INTELLIGENCE?                             */}
      {/* ------------------------------------------------------------- */}
      <section id="document-intelligence" className="scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 lg:p-16 shadow-sm">
            <div className="max-w-3xl">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                Konsep Inti Produk
              </span>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-4xl">
                Apa itu Document Intelligence?
              </h2>
              <p className="mt-6 text-base sm:text-lg text-slate-600 leading-relaxed">
                Sekolah menerima banyak dokumen setiap hari. Ada dokumen siswa, guru, karyawan,
                surat dari dinas, surat undangan, surat edaran, sertifikat, dan berbagai dokumen
                administrasi lainnya.
              </p>
              <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
                Masalahnya, informasi di dalam dokumen tersebut sering masih harus dibaca dan
                dipindahkan secara manual satu per satu ke lembar kerja atau sistem lain.
              </p>
              <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
                Banyubiru membantu membaca dokumen tersebut, memahami informasi penting di
                dalamnya, lalu mencocokkannya dengan data yang sudah dimiliki sekolah.
              </p>

              <div className="mt-8 rounded-2xl bg-blue-50/70 border border-blue-200/80 p-5 sm:p-6">
                <p className="text-sm sm:text-base font-semibold text-[#0f2b5c] leading-relaxed">
                  &ldquo;Dengan Document Intelligence, dokumen tidak hanya disimpan sebagai arsip
                  file. Informasi di dalamnya dapat digunakan secara langsung untuk menjalankan
                  pekerjaan administrasi sekolah.&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 2. CARA KERJA BANYUBIRU (7 TAHAP)                              */}
      {/* ------------------------------------------------------------- */}
      <section id="cara-kerja" className="scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
              7 Tahap Kerja
            </span>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Cara Kerja Banyubiru
            </h2>
            <p className="mt-4 text-sm sm:text-base text-slate-600">
              Alur kerja terstruktur yang menggabungkan pembacaan otomatis dokumen dengan
              kendali penuh pada administrator sekolah.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-black tracking-wider text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-md">
                        TAHAP {s.num}
                      </span>
                      <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-[#0f2b5c]">
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      {s.title}
                    </h3>
                    <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {s.desc}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Invariant Note Card */}
            <div className="rounded-2xl border border-slate-200 bg-slate-900 text-white p-6 flex flex-col justify-between">
              <div>
                <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-blue-300 mb-4">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Kendali Penuh Verifikasi
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Banyubiru tidak mengambil keputusan mutlak secara sepihak. Setiap data yang tidak
                  pasti ditandai sebagai <strong>Perlu Diperiksa</strong> agar administrator atau
                  operator sekolah tetap memegang kendali validasi akhir.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. CONTOH KASUS UTAMA                                         */}
      {/* ------------------------------------------------------------- */}
      <section id="contoh-kasus" className="scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/40 p-8 sm:p-12 lg:p-14 shadow-sm">
            <div className="max-w-3xl">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                Studi Kasus Administrasi
              </span>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                Surat Dinas &rarr; Data Sekolah &rarr; Surat Tugas
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-600">
                Bagaimana Banyubiru mengubah surat edaran kegiatan dinas menjadi dokumen tugas resmi
                sekolah tanpa pencarian manual satu per satu.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Skenario Deskripsi */}
              <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0f2b5c] uppercase tracking-wide">
                  <Building className="h-4 w-4 text-blue-700" />
                  <span>Skenario Masuk</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  Sekolah menerima surat edaran dari Dinas Pendidikan yang ditujukan kepada sekolah.
                  Isi surat meminta keikutsertaan guru matematika dan staf kurikulum dalam bimbingan teknis
                  penilaian terpadu.
                </p>
                <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">Alur yang biasanya terjadi:</span> Operator
                  harus membaca fisik surat, mencari nama guru yang sesuai di lemari arsip/spreadsheet,
                  menyalin NIP dan pangkat, mengetik ulang template surat tugas, lalu meminta tanda tangan.
                </div>
              </div>

              {/* Langkah Banyubiru */}
              <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-700 uppercase tracking-wide">
                  <Sparkles className="h-4 w-4" />
                  <span>Dengan Banyubiru</span>
                </div>
                <ol className="space-y-2 text-xs sm:text-sm text-slate-700 list-decimal list-inside">
                  <li>Sistem membaca isi dan perihal surat edaran.</li>
                  <li>Mengenali kriteria jabatan dan kegiatan yang disebutkan.</li>
                  <li>Mencocokkannya dengan database guru dan staf sekolah.</li>
                  <li>Menemukan pegawai yang memenuhi kriteria secara otomatis.</li>
                  <li>Mengambil data NIP, NIK, dan jabatan resmi yang relevan.</li>
                  <li>Mempersiapkan proses administrasi tindak lanjut.</li>
                  <li>Menerapkan format template Surat Tugas resmi sekolah.</li>
                  <li>Menghasilkan draft Surat Tugas siap periksa bagi kepala sekolah.</li>
                </ol>
              </div>
            </div>

            <div className="mt-8 rounded-xl bg-blue-100/60 p-4 border border-blue-200 flex items-center justify-between flex-wrap gap-3">
              <p className="text-xs sm:text-sm font-medium text-slate-800">
                <strong>Prinsip:</strong> Satu dokumen masuk &rarr; banyak informasi ditemukan &rarr; data sekolah digunakan &rarr; pekerjaan administrasi berikutnya disiapkan.
              </p>
              <span className="text-[11px] font-semibold text-blue-800 bg-white px-3 py-1 rounded-md border border-blue-200">
                Keputusan tetap pada pengguna yang berwenang
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. DOKUMEN YANG DAPAT DIPROSES                                */}
      {/* ------------------------------------------------------------- */}
      <section id="dokumen" className="scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
              Cakupan Luas
            </span>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Dokumen yang Dapat Diproses
            </h2>
            <p className="mt-4 text-sm sm:text-base text-slate-600">
              Banyubiru dirancang untuk menangani seluruh dokumen administratif sekolah dalam jumlah besar
              secara konsisten dan terhubung ke database.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Siswa */}
            <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-[#0f2b5c] border border-blue-100 flex items-center justify-center mb-5">
                <GraduationCap className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Dokumen Siswa
              </h3>
              <p className="mt-2 text-xs text-slate-500">
                Dokumen kependudukan dan pencatatan akademik siswa untuk identitas dan pelaporan.
              </p>
              <ul className="mt-5 space-y-2.5 text-xs sm:text-sm text-slate-700">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Kartu Keluarga (KK)
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Kartu Tanda Penduduk (KTP)
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Akta Kelahiran
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Ijazah &amp; Surat Keterangan Lulus
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Buku Rapor Siswa
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Sertifikat Prestasi &amp; Lomba
                </li>
              </ul>
            </div>

            {/* Guru & Karyawan */}
            <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-[#0f2b5c] border border-blue-100 flex items-center justify-center mb-5">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Dokumen Guru &amp; Karyawan
              </h3>
              <p className="mt-2 text-xs text-slate-500">
                Arsip kepegawaian pendidik dan tenaga kependidikan untuk penugasan dan kualifikasi.
              </p>
              <ul className="mt-5 space-y-2.5 text-xs sm:text-sm text-slate-700">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Surat Keputusan (SK)
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Surat Tugas
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Sertifikat Pendidik &amp; Pelatihan
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Surat Keterangan Mengajar
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Dokumen Kepegawaian Lainnya
                </li>
              </ul>
            </div>

            {/* Administrasi Sekolah */}
            <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-[#0f2b5c] border border-blue-100 flex items-center justify-center mb-5">
                <Building className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Administrasi Sekolah
              </h3>
              <p className="mt-2 text-xs text-slate-500">
                Surat kedinasan keluar dan masuk antar instansi, dinas, orang tua, dan mitra.
              </p>
              <ul className="mt-5 space-y-2.5 text-xs sm:text-sm text-slate-700">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Surat Edaran Dinas
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Surat Undangan Kegiatan
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Surat Permohonan
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Surat Pernyataan
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Surat Pengantar
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Dokumen Pendukung Lainnya
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 5. MANUAL VS BANYUBIRU                                        */}
      {/* ------------------------------------------------------------- */}
      <section id="perbandingan" className="scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
              Perbandingan Alur
            </span>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Manual vs Banyubiru
            </h2>
            <p className="mt-4 text-sm sm:text-base text-slate-600">
              Perubahan alur kerja operasional sekolah dari proses fisik berulang menuju alur kerja cerdas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Cara Manual */}
            <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-700">
                  Cara Manual
                </h3>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded">
                  Tradisional
                </span>
              </div>
              <div className="space-y-3 pt-2">
                {[
                  'Surat masuk diterima fisik',
                  'Dibaca satu per satu oleh staf',
                  'Mencari nama orang yang disebutkan',
                  'Membuka buku atau spreadsheet database',
                  'Mencari data pegawai/siswa secara manual',
                  'Mencocokkan identitas data',
                  'Menyalin data ke dokumen baru',
                  'Mengetik ulang surat keluar',
                  'Memeriksa ketepatan ketik',
                  'Menyimpan salinan fisik ke lemari arsip',
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-600">
                    <span className="text-[11px] font-bold text-slate-400 mt-0.5 w-4">
                      {idx + 1}.
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dengan Banyubiru */}
            <div className="rounded-2xl border-2 border-blue-500/80 bg-blue-50/20 p-7 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-blue-100">
                <h3 className="text-base font-bold text-[#0f2b5c]">
                  Dengan Banyubiru
                </h3>
                <span className="text-xs font-bold text-blue-700 bg-blue-100/80 px-2.5 py-1 rounded">
                  Document Intelligence
                </span>
              </div>
              <div className="space-y-3 pt-2">
                {[
                  'Dokumen masuk (unggah scan, foto, atau kiriman digital)',
                  'Dibaca secara otomatis menggunakan OCR',
                  'Informasi penting dan konteks dokumen dikenali',
                  'Data sekolah dicocokkan otomatis dengan database',
                  'Hasil pencocokan diperiksa oleh operator sekolah',
                  'Template surat resmi sekolah langsung diterapkan',
                  'Draft dokumen disiapkan siap disetujui pimpinan',
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-800 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 6. CALL TO ACTION & FOOTER                                    */}
      {/* ------------------------------------------------------------- */}
      <section className="border-t border-slate-200 bg-white pt-16 pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
            Mulai Pengelolaan Dokumen Cerdas di Sekolah Anda
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto">
            Masuk ke portal administrasi Banyubiru untuk mengakses pembacaan dokumen, verifikasi,
            dan alur kerja sekolah.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0f2b5c] px-7 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 transition-colors"
            >
              <span>Masuk ke Banyubiru</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="pt-16 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <p>
              &copy; {new Date().getFullYear()} Banyubiru. School Document Intelligence Platform.
            </p>
            <p>
              Dirancang untuk administrator, operator, dan pengelola administrasi sekolah.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
