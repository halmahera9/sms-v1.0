'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Upload,
  Search,
  Download,
  Plus,
  Eye,
  Edit2,
  X,
  CalendarDays,
  UserRound,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  applyDapodikEmployeeAction,
  previewDapodikAction,
} from '@/platform/actions/dapodik-import';
import {
  getEmployeesAction,
  saveEmployeeAction,
} from '@/platform/actions/employee';

type Employee = any;

function formatDate(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('id-ID');
}

function calculateWorkPeriod(value: unknown) {
  if (!value) return '—';

  const start = new Date(String(value));
  const now = new Date();

  if (Number.isNaN(start.getTime()) || start > now) return '—';

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();

  if (now.getDate() < start.getDate()) months--;

  if (months < 0) {
    years--;
    months += 12;
  }

  return `${years} tahun ${months} bulan`;
}

export default function MasterEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const [employeeType, setEmployeeType] = useState<'guru' | 'karyawan'>('guru');

  const [previewEmployee, setPreviewEmployee] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [showDapodikPreview, setShowDapodikPreview] = useState(false);
  const [dapodikPreview, setDapodikPreview] = useState<any>(null);
  const [dapodikPreviewFilter, setDapodikPreviewFilter] =
    useState<'REVIEW' | 'ALL' | 'UNCHANGED'>('REVIEW');
  const [dapodikFile, setDapodikFile] = useState<File | null>(null);
  const [isApplyingDapodik, setIsApplyingDapodik] = useState(false);

  const [form, setForm] = useState<any>({
    id: undefined,
    nip: '',
    nrk: '',
    nik: '',
    nuptk: '',
    fullName: '',
    jabatan: '',
    unitKerja: '',
    instansi: '',
    statusKepegawaian: 'PNS',
    pangkatGolongan: '',
    tmtPengangkatan: '',
    tempatLahir: '',
    tanggalLahir: '',
    email: '',
  });

  const loadEmployees = async () => {
    const result = await getEmployeesAction({ limit: 200 });
    if (result.success) {
      setEmployees(result.data ?? []);
    }
  };

  useEffect(() => {
    const type =
      new URLSearchParams(window.location.search).get('type') === 'karyawan'
        ? 'karyawan'
        : 'guru';

    setEmployeeType(type);
    void loadEmployees();
  }, []);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return employees.filter((employee) => {
      const haystack = [
        employee.fullName,
        employee.nip,
        employee.nrk,
        employee.nik,
        employee.nuptk,
        employee.jabatan,
        employee.unitKerja,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return !q || haystack.includes(q);
    });
  }, [employees, searchQuery]);

  const displayedEmployees =
    pageSize === 0
      ? filteredEmployees
      : filteredEmployees.slice((page - 1) * pageSize, page * pageSize);

  const totalPages =
    pageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredEmployees.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [searchQuery, pageSize, employeeType]);

  const openCreate = () => {
    setEditingEmployee(null);
    setForm({
      id: undefined,
      nip: '',
      nrk: '',
      nik: '',
      nuptk: '',
      fullName: '',
      jabatan: '',
      unitKerja: '',
      instansi: 'SMP Negeri 99 Jakarta',
      statusKepegawaian: 'PNS',
      pangkatGolongan: '',
      tmtPengangkatan: '',
      tempatLahir: '',
      tanggalLahir: '',
      email: '',
    });
  };

  const openEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setForm({
      ...employee,
      tmtPengangkatan: employee.tmtPengangkatan
        ? String(employee.tmtPengangkatan).slice(0, 10)
        : '',
      tanggalLahir: employee.tanggalLahir
        ? String(employee.tanggalLahir).slice(0, 10)
        : '',
    });
  };

  const handleSave = async () => {
    const result = await saveEmployeeAction({
      id: form.id,
      nip: form.nip || null,
      nrk: form.nrk || null,
      nik: form.nik || null,
      fullName: form.fullName,
      jabatan: form.jabatan || '',
      unitKerja: form.unitKerja || '',
      instansi: form.instansi || '',
      statusKepegawaian: form.statusKepegawaian,
    });

    if (!result.success) {
      alert(result.error?.message ?? 'Gagal menyimpan data guru.');
      return;
    }

    setEditingEmployee(null);
    await loadEmployees();
  };

  const handleDapodikFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';

    if (!file) return;

    if (
      !file.name.toLowerCase().endsWith('.xls') &&
      !file.name.toLowerCase().endsWith('.xlsx')
    ) {
      alert('File Dapodik harus berformat .xls atau .xlsx.');
      return;
    }

    const formData = new FormData();
    formData.append('mode', 'employee');
    formData.append('file', file);

    try {
      const result = await previewDapodikAction(formData);
      setDapodikFile(file);
      setDapodikPreview(result);
      setDapodikPreviewFilter('REVIEW');
      setShowDapodikPreview(true);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Gagal melakukan preview Dapodik.',
      );
    }
  };

  const handleApplyDapodik = async () => {
    if (!dapodikFile) return;

    setIsApplyingDapodik(true);

    try {
      const formData = new FormData();
      formData.append('file', dapodikFile);

      const result = await applyDapodikEmployeeAction(formData);

      if (!result.ok) {
        alert(result.errorMessage ?? 'Apply Dapodik gagal.');
        return;
      }

      setShowDapodikPreview(false);
      setDapodikPreview(null);
      setDapodikFile(null);
      await loadEmployees();

      alert(
        `Update selesai. ${result.updated} data diperbarui, ${result.skipped} tidak berubah.`,
      );
    } finally {
      setIsApplyingDapodik(false);
    }
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        NIP: '',
        NRK: '',
        NIK: '',
        NUPTK: '',
        Nama: '',
        'Pangkat Golongan': '',
        'TMT Pengangkatan': '',
        Jabatan: '',
        'Status Kepegawaian': '',
        'Tempat Lahir': '',
        'Tanggal Lahir': '',
        Email: '',
      },
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Dapodik_PTK');
    XLSX.writeFile(wb, 'Template_Import_Guru_Pegawai_Dapodik.xlsx');
  };

  const title = employeeType === 'guru' ? 'Master Data Guru' : 'Master Data Karyawan';
  const label = employeeType === 'guru' ? 'guru' : 'karyawan';

  return (
    <div className="space-y-6">
      {/* HERO — mengikuti Master Data Siswa */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-blue-50 px-6 py-6 shadow-sm">
        <div className="absolute -right-10 -top-16 h-40 w-40 rounded-full border border-blue-100 bg-blue-50/50" />
        <div className="absolute right-16 -bottom-20 h-36 w-36 rounded-full border border-cyan-100 bg-cyan-50/40" />
        <div className="relative flex items-center justify-between gap-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-1 text-[11px] font-medium text-blue-600 shadow-sm">
              <UserRound className="h-3.5 w-3.5" />
              GTK Administration Domain Module
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {title}
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              Perbarui dan sinkronkan data master {label} berdasarkan data terbaru
              dari Dapodik tanpa mengubah data yang sudah tersimpan.
            </p>
          </div>

          <label className="relative z-10 flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700">
            <Upload className="h-4 w-4" />
            <span>Update Data {employeeType === 'guru' ? 'Guru' : 'Karyawan'}</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleDapodikFileChange}
              className="hidden"
            />
          </label>
        </div>
      </section>

      {/* TOOLBAR */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, NIP, NIKKI, jabatan"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <span className="hidden text-xs text-slate-500 sm:block">
              Menampilkan{' '}
              <span className="font-semibold text-slate-700">
                {displayedEmployees.length}
              </span>{' '}
              dari {filteredEmployees.length} {label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Tambah Data {employeeType === 'guru' ? 'Guru' : 'Karyawan'}
            </button>

            <span className="ml-2 text-[11px] text-slate-400">Tampilkan</span>

            {[10, 20, 0].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setPageSize(size)}
                className={[
                  'rounded-lg border px-3 py-2 text-[11px] font-medium',
                  pageSize === size
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
                ].join(' ')}
              >
                {size === 0 ? 'Semua' : size}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* TABLE */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1800px] w-full text-left text-xs font-sans">
            <thead className="bg-slate-50 text-[10px] font-medium tracking-[0.04em] text-slate-500 uppercase">
              <tr>
                <th className="py-3 px-4 w-12">No</th>
                <th className="py-3 px-4">Nama</th>
                <th className="py-3 px-4">NIP/NIKKI</th>
                <th className="py-3 px-4">Pangkat/Golongan</th>
                <th className="py-3 px-4">TMT</th>
                <th className="py-3 px-4">Jabatan</th>
                <th className="py-3 px-4">Status Kepegawaian</th>
                <th className="py-3 px-4">Tmp. Lahir</th>
                <th className="py-3 px-4">Tgl Lahir</th>
                <th className="py-3 px-4">Masa Kerja</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-700">
              {displayedEmployees.length > 0 ? (
                displayedEmployees.map((employee, idx) => (
                  <tr
                    key={employee.id}
                    className="hover:bg-blue-50/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-xs font-normal text-slate-400">
                      {(page - 1) * (pageSize === 0 ? filteredEmployees.length : pageSize) + idx + 1}
                    </td>

                    <td className="py-3 px-4 text-xs font-normal text-slate-700">
                      {employee.fullName || '—'}
                    </td>

                    <td className="py-3 px-4 text-xs font-normal text-slate-600">
                      <span className="font-mono">
                        {employee.nip || employee.nrk || employee.nik || '—'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-xs font-normal text-slate-600">
                      {employee.pangkatGolongan || '—'}
                    </td>

                    <td className="py-3 px-4 text-xs font-normal text-slate-600">
                      {formatDate(employee.tmtPengangkatan)}
                    </td>

                    <td className="py-3 px-4 text-xs font-normal text-slate-600">
                      {employee.jabatan || '—'}
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
                        {employee.statusKepegawaian || '—'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-xs font-normal text-slate-600">
                      {employee.tempatLahir || '—'}
                    </td>

                    <td className="py-3 px-4 text-xs font-normal text-slate-600">
                      {formatDate(employee.tanggalLahir)}
                    </td>

                    <td className="py-3 px-4 text-xs font-normal text-slate-600">
                      {calculateWorkPeriod(employee.tmtPengangkatan)}
                    </td>

                    <td className="py-3 px-4 text-xs font-normal text-slate-600">
                      {employee.email || '—'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setPreviewEmployee(employee)}
                          className="text-slate-600 hover:text-blue-600 font-normal text-xs"
                        >
                          Preview
                        </button>

                        <button
                          type="button"
                          onClick={() => openEdit(employee)}
                          className="text-blue-600 hover:text-blue-700 hover:underline font-normal text-xs inline-flex items-center space-x-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400">
                    Tidak ada data {label} yang cocok dengan pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100 px-4 py-3 bg-white">
          <div className="text-xs text-slate-400">
            Menampilkan
            <span className="mx-1 font-medium text-slate-600">
              {filteredEmployees.length === 0
                ? 0
                : (page - 1) * (pageSize === 0 ? filteredEmployees.length : pageSize) + 1}
            </span>
            –
            <span className="mx-1 font-medium text-slate-600">
              {Math.min(
                page * (pageSize === 0 ? filteredEmployees.length : pageSize),
                filteredEmployees.length
              )}
            </span>
            dari
            <span className="mx-1 font-medium text-slate-600">
              {filteredEmployees.length}
            </span>
            {label}
          </div>

          <div className="flex items-center gap-3">
            {pageSize !== 0 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 disabled:opacity-40"
                >
                  Sebelumnya
                </button>

                <span className="px-2 text-xs text-slate-500">
                  {page} / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 disabled:opacity-40"
                >
                  Berikutnya
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* PREVIEW PROFIL */}
      {previewEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-blue-600">
                  Master Data Guru
                </div>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {previewEmployee.fullName}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {previewEmployee.nip || previewEmployee.nrk || previewEmployee.nik || 'Identitas belum tersedia'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPreviewEmployee(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['NIP', previewEmployee.nip],
                  ['NIKKI / NRK', previewEmployee.nrk],
                  ['NIK', previewEmployee.nik],
                  ['NUPTK', previewEmployee.nuptk],
                  ['Pangkat/Golongan', previewEmployee.pangkatGolongan],
                  ['TMT Pengangkatan', formatDate(previewEmployee.tmtPengangkatan)],
                  ['Jabatan', previewEmployee.jabatan],
                  ['Status Kepegawaian', previewEmployee.statusKepegawaian],
                  ['Jenis PTK', previewEmployee.jenisPtk],
                  ['Tempat Lahir', previewEmployee.tempatLahir],
                  ['Tanggal Lahir', formatDate(previewEmployee.tanggalLahir)],
                  ['Jenis Kelamin', previewEmployee.jenisKelamin],
                  ['Agama', previewEmployee.agama],
                  ['TMT PNS', formatDate(previewEmployee.tmtPns)],
                  ['Email', previewEmployee.email],
                  ['HP', previewEmployee.hp],
                  ['Alamat', previewEmployee.alamatJalan],
                  ['Nama Ibu Kandung', previewEmployee.namaIbuKandung],
                  ['Status Perkawinan', previewEmployee.statusPerkawinan],
                  ['Nama Suami/Istri', previewEmployee.namaSuamiIstri],
                  ['SK Pengangkatan', previewEmployee.skPengangkatan],
                  ['Lembaga Pengangkatan', previewEmployee.lembagaPengangkatan],
                  ['Sumber Gaji', previewEmployee.sumberGaji],
                  ['NPWP', previewEmployee.npwp],
                  ['No. KK', previewEmployee.noKk],
                  ['Karpeg', previewEmployee.karpeg],
                  ['Karis/Karsu', previewEmployee.karisKarsu],
                  ['NUKS', previewEmployee.nuks],
                  ['Bank', previewEmployee.bank],
                  ['No. Rekening', previewEmployee.nomorRekeningBank],
                  ['Atas Nama Rekening', previewEmployee.rekeningAtasNama],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      {label}
                    </div>
                    <div className="mt-1 break-words text-xs font-medium text-slate-800">
                      {value || '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  const employee = previewEmployee;
                  setPreviewEmployee(null);
                  openEdit(employee);
                }}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Edit Data
              </button>

              <button
                type="button"
                onClick={() => setPreviewEmployee(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT */}
      {editingEmployee !== null || form.id === undefined ? (
        form.fullName || editingEmployee ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
            <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {editingEmployee ? 'Edit Data Guru' : 'Tambah Data Guru'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Kelola data master GTK.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[65vh] overflow-y-auto p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    ['fullName', 'Nama', true],
                    ['nip', 'NIP', false],
                    ['nrk', 'NIKKI / NRK', false],
                    ['nik', 'NIK', false],
                    ['nuptk', 'NUPTK', false],
                    ['pangkatGolongan', 'Pangkat/Golongan', false],
                    ['tmtPengangkatan', 'TMT Pengangkatan', false],
                    ['jabatan', 'Jabatan', false],
                    ['unitKerja', 'Unit Kerja', false],
                    ['tempatLahir', 'Tempat Lahir', false],
                    ['tanggalLahir', 'Tanggal Lahir', false],
                    ['email', 'Email', false],
                  ].map(([key, label, required]) => (
                    <label key={String(key)} className="space-y-1">
                      <span className="text-[11px] font-medium text-slate-600">
                        {String(label)}{required ? ' *' : ''}
                      </span>
                      <input
                        type={
                          key === 'tmtPengangkatan' || key === 'tanggalLahir'
                            ? 'date'
                            : key === 'email'
                              ? 'email'
                              : 'text'
                        }
                        value={form[String(key) as keyof typeof form] ?? ''}
                        onChange={(e) =>
                          setForm((current: any) => ({
                            ...current,
                            [String(key)]: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                  ))}

                  <label className="space-y-1">
                    <span className="text-[11px] font-medium text-slate-600">
                      Status Kepegawaian
                    </span>
                    <select
                      value={form.statusKepegawaian ?? 'PNS'}
                      onChange={(e) =>
                        setForm((current: any) => ({
                          ...current,
                          statusKepegawaian: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    >
                      <option value="PNS">PNS</option>
                      <option value="PPPK">PPPK</option>
                      <option value="HONORER">HONORER</option>
                      <option value="NON_ASN">NON ASN</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        ) : null
      ) : null}

      {/* DAPODIK PREVIEW */}
      {showDapodikPreview && dapodikPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-xl max-h-[70vh] overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-bold text-slate-900">
                Preview Update Data Dapodik
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Periksa perubahan sebelum menerapkan data ke master {label}.
              </p>
            </div>

            <div className="grid grid-cols-5 gap-2 px-5 py-4">
              {[
                ['Total', dapodikPreview.total],
                ['Baru', dapodikPreview.newCount],
                ['Isi Kosong', dapodikPreview.fillBlankCount],
                ['Konflik', dapodikPreview.conflictCount],
                ['Tidak Berubah', dapodikPreview.unchangedCount],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl bg-slate-50 p-2 text-center">
                  <div className="text-lg font-bold text-slate-900">{value}</div>
                  <div className="text-[10px] text-slate-500">{label}</div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 px-5 pb-3">
              {([
                ['REVIEW', 'Perlu Review'],
                ['ALL', 'Semua'],
                ['UNCHANGED', 'Tidak Berubah'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDapodikPreviewFilter(value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    dapodikPreviewFilter === value
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="max-h-[32vh] overflow-y-auto px-5 pb-4">
              {(dapodikPreview.items ?? [])
                .filter((item: any) => {
                  if (dapodikPreviewFilter === 'ALL') return true;
                  if (dapodikPreviewFilter === 'UNCHANGED') {
                    return item.status === 'UNCHANGED';
                  }
                  return item.status !== 'UNCHANGED';
                })
                .map((item: any) => (
                  <div
                    key={`${item.row}-${item.identifier}`}
                    className="mb-2 rounded-xl border border-slate-200 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-900">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {item.identifier}
                        </div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold">
                        {item.status}
                      </span>
                    </div>

                    {item.fields?.map((field: any) => (
                      <div
                        key={`${item.row}-${field.field}`}
                        className="mt-1 flex justify-between gap-3 text-[10px]"
                      >
                        <span className="text-slate-500">{field.label}</span>
                        <span className="font-medium text-slate-800">
                          {field.currentValue || '(kosong)'} → {field.incomingValue || '(kosong)'}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              {dapodikPreview.fillBlankCount > 0 && (
                <button
                  type="button"
                  onClick={handleApplyDapodik}
                  disabled={isApplyingDapodik}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {isApplyingDapodik
                    ? 'Menerapkan...'
                    : `Terapkan ${dapodikPreview.fillBlankCount} Isi Kosong`}
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowDapodikPreview(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
