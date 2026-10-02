'use client';

import { useState, useEffect } from 'react';
import {
  Building,
  Image as ImageIcon,
  FileText,
  UserCheck,
  ShieldAlert,
  Sliders,
  Send,
  CheckCircle2,
  XCircle,
  Save,
  Upload,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  getSchoolProfileAction,
  updateSchoolProfileAction,
  updateSchoolSignersAction,
  uploadSchoolLogoAction,
} from '@/platform/actions/school-profile';
import type {
  SchoolProfileDTO,
  SchoolSigner,
  SchoolLetterheadConfig,
} from '@/platform/types/school-profile';

export default function AdminSettingsPage() {
  const [activeSection, setActiveSection] = useState('profil');
  const [profile, setProfile] = useState<SchoolProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State
  const [namaSekolah, setNamaSekolah] = useState('');
  const [npsn, setNpsn] = useState('');
  const [alamat, setAlamat] = useState('');
  const [telepon, setTelepon] = useState('');
  const [email, setEmail] = useState('');
  const [kopSurat, setKopSurat] = useState<SchoolLetterheadConfig>({
    headerInstansi: 'PEMERINTAH PROVINSI DAERAH KHUSUS IBUKOTA JAKARTA\nDINAS PENDIDIKAN',
    namaSekolah: '',
    alamatBaris1: '',
    alamatBaris2: '',
    kontakDanWebsite: '',
  });
  const [signers, setSigners] = useState<SchoolSigner[]>([]);

  useEffect(() => {
    let mounted = true;
    getSchoolProfileAction()
      .then((res) => {
        if (!mounted) return;
        if (res.success && res.data) {
          const d = res.data;
          setProfile(d);
          setNamaSekolah(d.namaSekolah || '');
          setNpsn(d.npsn || '');
          setAlamat(d.alamat || '');
          setTelepon(d.telepon || '');
          setEmail(d.email || '');
          if (d.kopSurat) {
            setKopSurat(d.kopSurat);
          } else {
            setKopSurat({
              headerInstansi: 'PEMERINTAH PROVINSI DAERAH KHUSUS IBUKOTA JAKARTA\nDINAS PENDIDIKAN',
              namaSekolah: d.namaSekolah || '',
              alamatBaris1: d.alamat || '',
              alamatBaris2: '',
              kontakDanWebsite: d.telepon ? `Telp: ${d.telepon}` : '',
            });
          }
          setSigners(d.penandatangan || []);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await updateSchoolProfileAction({
        namaSekolah,
        npsn,
        alamat,
        telepon,
        email,
        kopSurat,
      });

      if (res.success && res.data) {
        setProfile(res.data);
        showNotification('success', 'Identitas Sekolah dan Kop Surat berhasil disimpan.');
      } else {
        showNotification('error', res.error?.message || 'Gagal menyimpan Identitas Sekolah.');
      }
    } catch (err: unknown) {
      showNotification('error', 'Terjadi kesalahan sistem saat menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSigners = async () => {
    setSaving(true);
    try {
      const res = await updateSchoolSignersAction(signers);
      if (res.success && res.data) {
        setSigners(res.data);
        showNotification('success', 'Daftar Penandatangan berhasil diperbarui.');
      } else {
        showNotification('error', res.error?.message || 'Gagal menyimpan Penandatangan.');
      }
    } catch {
      showNotification('error', 'Terjadi kesalahan saat menyimpan Penandatangan.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('logo', file);

    setSaving(true);
    try {
      const res = await uploadSchoolLogoAction(formData);
      if (res.success && res.data) {
        showNotification('success', 'Logo Sekolah berhasil diperbarui.');
        setProfile((prev) => (prev ? { ...prev, logoPath: res.data!.logoPath } : null));
      } else {
        showNotification('error', res.error?.message || 'Gagal mengunggah Logo Sekolah.');
      }
    } catch {
      showNotification('error', 'Terjadi kesalahan saat mengunggah logo.');
    } finally {
      setSaving(false);
    }
  };

  const addSigner = () => {
    setSigners([
      ...signers,
      {
        nama: '',
        nip: '',
        nik: '',
        jabatan: 'Kepala Sekolah',
        isActive: true,
      },
    ]);
  };

  const removeSigner = (index: number) => {
    setSigners(signers.filter((_, idx) => idx !== index));
  };

  const updateSignerField = (index: number, field: keyof SchoolSigner, value: any) => {
    const updated = [...signers];
    updated[index] = { ...updated[index], [field]: value };
    setSigners(updated);
  };

  const sections = [
    { id: 'profil', name: 'Identitas Sekolah', icon: Building, desc: 'Identitas resmi NPSN, nama sekolah, alamat, kontak' },
    { id: 'logo', name: 'Logo Sekolah', icon: ImageIcon, desc: 'Berkas lambang sekolah untuk kop surat dan dokumen' },
    { id: 'kop', name: 'Kop Surat', icon: FileText, desc: 'Pengaturan tata letak kepala surat resmi dinas' },
    { id: 'penandatangan', name: 'Penandatangan', icon: UserCheck, desc: 'Daftar pejabat berwenang penandatangan surat' },
    { id: 'pengguna', name: 'Pengguna & Hak Akses', icon: ShieldAlert, desc: 'Manajemen akun administrator dan operator' },
    { id: 'pengaturan_dokumen', name: 'Pengaturan Dokumen', icon: Sliders, desc: 'Batas ukuran, format berkas, dan masa simpan' },
    { id: 'formulir_pengumpulan', name: 'Formulir Pengumpulan Dokumen', icon: Send, desc: 'Tautan formulir publik untuk pengumpulan berkas' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Administrasi
          </span>
          <span className="text-xs text-slate-400">&bull;</span>
          <span className="text-xs text-slate-500 font-medium">Pengaturan Institusi</span>
        </div>
        <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Administrasi &amp; Identitas Sekolah
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-600">
          Konfigurasi resmi Identitas Sekolah, Logo Sekolah, Kop Surat, dan Penandatangan dokumen keluaran.
        </p>
      </div>

      {notification && (
        <div
          className={`flex items-center gap-2 p-4 rounded-xl border text-xs font-medium ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Navigation Sidebar List */}
        <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xs space-y-1">
          {sections.map((s) => {
            const Icon = s.icon;
            const isCurrent = activeSection === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-colors ${
                  isCurrent
                    ? 'bg-[#0f2b5c] text-white font-bold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isCurrent ? 'text-white' : 'text-slate-500'}`} />
                <span className="truncate">{s.name}</span>
              </button>
            );
          })}
        </div>

        {/* Content Pane */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          {/* Section: Identitas Sekolah */}
          {activeSection === 'profil' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">Identitas Sekolah</h3>
                <p className="text-xs text-slate-500">
                  Data resmi sekolah sebagai sumber kebenaran (single source of truth) untuk dokumen dan Template Surat.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">Nama Sekolah Resmi</label>
                  <input
                    type="text"
                    value={namaSekolah}
                    onChange={(e) => setNamaSekolah(e.target.value)}
                    placeholder="Contoh: SMA Negeri 1 Jakarta"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">NPSN (Nomor Pokok Sekolah Nasional)</label>
                  <input
                    type="text"
                    value={npsn}
                    onChange={(e) => setNpsn(e.target.value)}
                    placeholder="Contoh: 20100001"
                    maxLength={10}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 font-mono outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Kode Satuan Pendidikan</label>
                  <input
                    type="text"
                    readOnly
                    value={profile?.kodeSekolah || ''}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">Alamat Lengkap</label>
                  <textarea
                    rows={2}
                    value={alamat}
                    onChange={(e) => setAlamat(e.target.value)}
                    placeholder="Contoh: Jl. Budi Utomo No. 7, Pasar Baru, Sawah Besar, Jakarta Pusat"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Nomor Telepon Sekolah</label>
                  <input
                    type="text"
                    value={telepon}
                    onChange={(e) => setTelepon(e.target.value)}
                    placeholder="Contoh: (021) 3865001"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Alamat Email Resmi</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Contoh: info@sman1jkt.sch.id"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveProfile}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f2b5c] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-800 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Identitas Sekolah'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Section: Logo Sekolah */}
          {activeSection === 'logo' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">Logo Sekolah</h3>
                <p className="text-xs text-slate-500">
                  Berkas lambang resmi sekolah untuk ditempatkan pada Kop Surat dan dokumen keluaran.
                </p>
              </div>

              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-3 bg-slate-50/50">
                <ImageIcon className="mx-auto h-10 w-10 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold text-slate-800">
                    {profile?.logoPath ? `Logo Aktif: ${profile.logoPath}` : 'Belum ada Logo Sekolah yang diunggah'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Format didukung: PNG, JPEG, SVG, atau WEBP. Tersimpan terisolasi pada storage sekolah.
                  </p>
                </div>

                <label className="inline-flex items-center gap-2 rounded-lg bg-white border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer">
                  <Upload className="h-4 w-4 text-blue-700" />
                  <span>{profile?.logoPath ? 'Ganti Logo Sekolah' : 'Unggah Logo Sekolah'}</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/svg+xml, image/webp"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Section: Kop Surat */}
          {activeSection === 'kop' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">Kop Surat</h3>
                <p className="text-xs text-slate-500">
                  Konfigurasi tata letak dan baris kepala surat dinas resmi untuk Template Surat.
                </p>
              </div>

              {/* Preview Kop Surat */}
              <div className="rounded-xl border border-slate-300 p-6 bg-white shadow-xs space-y-1 text-center font-serif border-b-4 border-b-slate-900">
                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                  {kopSurat.headerInstansi || 'PEMERINTAH DAERAH / DINAS PENDIDIKAN'}
                </p>
                <p className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  {namaSekolah || profile?.namaSekolah || 'NAMA SEKOLAH RESMI'}
                </p>
                <p className="text-[10px] text-slate-600 font-sans">
                  {alamat || profile?.alamat || 'Alamat Sekolah Belum Diatur'}
                </p>
                <p className="text-[10px] text-slate-500 font-sans">
                  {telepon ? `Telp: ${telepon}` : ''} {email ? `| Email: ${email}` : ''}
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Baris 1: Header Instansi Pembina</label>
                  <input
                    type="text"
                    value={kopSurat.headerInstansi || ''}
                    onChange={(e) => setKopSurat({ ...kopSurat, headerInstansi: e.target.value })}
                    placeholder="Contoh: PEMERINTAH PROVINSI DKI JAKARTA / DINAS PENDIDIKAN"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Baris Tambahan / Keterangan Kop</label>
                  <input
                    type="text"
                    value={kopSurat.kontakDanWebsite || ''}
                    onChange={(e) => setKopSurat({ ...kopSurat, kontakDanWebsite: e.target.value })}
                    placeholder="Contoh: Laman: www.sman1jkt.sch.id | Kode Pos: 10710"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveProfile}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f2b5c] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-800 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Kop Surat'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Section: Penandatangan */}
          {activeSection === 'penandatangan' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Penandatangan</h3>
                  <p className="text-xs text-slate-500">
                    Konfigurasi pejabat pimpinan sekolah yang berwenang menandatangani surat dinas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addSigner}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 px-3 py-1.5 text-xs font-semibold hover:bg-blue-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah Penandatangan</span>
                </button>
              </div>

              {signers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
                  Belum ada penandatangan yang ditambahkan. Klik &quot;Tambah Penandatangan&quot; untuk menambahkan pimpinan sekolah.
                </div>
              ) : (
                <div className="space-y-4">
                  {signers.map((s, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">
                          Pejabat Penandatangan #{idx + 1}
                        </span>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={s.isActive}
                              onChange={(e) => updateSignerField(idx, 'isActive', e.target.checked)}
                              className="rounded text-blue-700"
                            />
                            <span className={s.isActive ? 'font-bold text-emerald-700' : 'text-slate-400'}>
                              {s.isActive ? 'Aktif' : 'Tidak Aktif'}
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={() => removeSigner(idx)}
                            className="text-rose-600 hover:text-rose-800"
                            title="Hapus"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600">Nama Lengkap &amp; Gelar</label>
                          <input
                            type="text"
                            value={s.nama}
                            onChange={(e) => updateSignerField(idx, 'nama', e.target.value)}
                            placeholder="Contoh: Drs. H. Mulyadi, M.Pd."
                            className="mt-1 w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600">Jabatan Resmi</label>
                          <input
                            type="text"
                            value={s.jabatan}
                            onChange={(e) => updateSignerField(idx, 'jabatan', e.target.value)}
                            placeholder="Contoh: Kepala Sekolah"
                            className="mt-1 w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600">NIP (jika tersedia)</label>
                          <input
                            type="text"
                            value={s.nip || ''}
                            onChange={(e) => updateSignerField(idx, 'nip', e.target.value)}
                            placeholder="Contoh: 196805121993031005"
                            className="mt-1 w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 font-mono outline-none focus:border-blue-600"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600">NIK (jika tersedia)</label>
                          <input
                            type="text"
                            value={s.nik || ''}
                            onChange={(e) => updateSignerField(idx, 'nik', e.target.value)}
                            placeholder="Contoh: 3171010101850001"
                            className="mt-1 w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 font-mono outline-none focus:border-blue-600"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveSigners}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f2b5c] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-800 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Penandatangan'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Section: Pengguna & Hak Akses */}
          {activeSection === 'pengguna' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Pengguna &amp; Hak Akses Sekolah</h3>
                <p className="text-xs text-slate-500">Pemberian wewenang peran: Administrator, Operator, dan Verifikator.</p>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Manajemen akun terikat pada tenant sekolah dengan isolasi data RLS (Row-Level Security).
              </p>
            </div>
          )}

          {/* Section: Pengaturan Dokumen */}
          {activeSection === 'pengaturan_dokumen' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Kebijakan Pemrosesan Dokumen</h3>
                <p className="text-xs text-slate-500">Pengaturan resolusi OCR, batas ukuran berkas, dan retensi audit trail.</p>
              </div>
              <div className="text-xs text-slate-600 space-y-2">
                <p>&bull; <strong>Format Dokumen Didukung:</strong> PDF, JPEG, PNG, WEBP</p>
                <p>&bull; <strong>Batas Ukuran Berkas:</strong> Maksimal 15 MB per dokumen</p>
                <p>&bull; <strong>Audit Log:</strong> Tersimpan permanen dengan jejak hash SHA-256</p>
              </div>
            </div>
          )}

          {/* Section: Formulir Pengumpulan */}
          {activeSection === 'formulir_pengumpulan' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Formulir Pengumpulan Dokumen Publik</h3>
                <p className="text-xs text-slate-500">Pengaturan tautan aman untuk pengumpulan berkas dari orang tua siswa dan mitra.</p>
              </div>
              <p className="text-xs text-slate-600">
                Pengumpulan dokumen menggunakan token aman sekali pakai dengan batas waktu kedaluwarsa otomatis.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
