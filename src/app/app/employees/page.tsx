'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { FeedbackModal, type FeedbackState } from '@/components/ui/FeedbackModal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import * as XLSX from 'xlsx';
import {
  applyDapodikEmployeeAction,
  previewDapodikAction,
} from '@/platform/actions/dapodik-import';
import {
  deleteEmployeeAction,
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
  const [isHydrated, setIsHydrated] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const [sortConfig, setSortConfig] = useState<{
    key:
      | 'fullName'
      | 'identity'
      | 'pangkatGolongan'
      | 'tmtPengangkatan'
      | 'jabatan'
      | 'statusKepegawaian'
      | 'tempatLahir'
      | 'tanggalLahir'
      | 'workPeriod'
      | 'email';
    direction: 'asc' | 'desc';
  } | null>(null);

  const [employeeType, setEmployeeType] = useState<'guru' | 'karyawan'>('guru');

  const [previewEmployee, setPreviewEmployee] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [formError, setFormError] = useState('');

  const [showDapodikPreview, setShowDapodikPreview] = useState(false);
  const [dapodikPreview, setDapodikPreview] = useState<any>(null);
  const [dapodikPreviewFilter, setDapodikPreviewFilter] =
    useState<'REVIEW' | 'ALL' | 'UNCHANGED'>('REVIEW');
  const [dapodikFile, setDapodikFile] = useState<File | null>(null);
  const [isApplyingDapodik, setIsApplyingDapodik] = useState(false);
  const dapodikPreviewListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showDapodikPreview) return;

    requestAnimationFrame(() => {
      if (dapodikPreviewListRef.current) {
        dapodikPreviewListRef.current.scrollTop = 0;
      }
    });
  }, [showDapodikPreview, dapodikPreviewFilter]);

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

    const result = employees.filter((employee) => {
      const haystack = [
        employee.fullName,
        employee.nip,
        employee.nrk,
        employee.nik,
        employee.nuptk,
        employee.jabatan,
        employee.unitKerja,
        employee.pangkatGolongan,
        employee.statusKepegawaian,
        employee.tempatLahir,
        employee.email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return !q || haystack.includes(q);
    });

    if (!sortConfig) {
      return result;
    }

    const getValue = (employee: Employee) => {
      switch (sortConfig.key) {
        case 'fullName':
          return String(employee.fullName ?? '').toLowerCase();

        case 'identity':
          return String(
            employee.nip || employee.nrk || employee.nik || ''
          ).toLowerCase();

        case 'pangkatGolongan':
          return String(employee.pangkatGolongan ?? '').toLowerCase();

        case 'tmtPengangkatan':
        case 'workPeriod':
          return employee.tmtPengangkatan
            ? new Date(String(employee.tmtPengangkatan)).getTime()
            : 0;

        case 'jabatan':
          return String(employee.jabatan ?? '').toLowerCase();

        case 'statusKepegawaian':
          return String(
            employee.statusKepegawaian ?? ''
          ).toLowerCase();

        case 'tempatLahir':
          return String(employee.tempatLahir ?? '').toLowerCase();

        case 'tanggalLahir':
          return employee.tanggalLahir
            ? new Date(String(employee.tanggalLahir)).getTime()
            : 0;

        case 'email':
          return String(employee.email ?? '').toLowerCase();

        default:
          return '';
      }
    };

    return [...result].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);

      if (typeof av === 'number' && typeof bv === 'number') {
        return sortConfig.direction === 'asc'
          ? av - bv
          : bv - av;
      }

      const comparison = String(av).localeCompare(
        String(bv),
        'id',
        {
          numeric: true,
          sensitivity: 'base',
        }
      );

      return sortConfig.direction === 'asc'
        ? comparison
        : -comparison;
    });
  }, [employees, searchQuery, sortConfig]);

  const handleSort = (
    key:
      | 'fullName'
      | 'identity'
      | 'pangkatGolongan'
      | 'tmtPengangkatan'
      | 'jabatan'
      | 'statusKepegawaian'
      | 'tempatLahir'
      | 'tanggalLahir'
      | 'workPeriod'
      | 'email'
  ) => {
    setSortConfig((current) => ({
      key,
      direction:
        current?.key === key && current.direction === 'asc'
          ? 'desc'
          : 'asc',
    }));

    setPage(1);
  };

  const sortIcon = (
    key:
      | 'fullName'
      | 'identity'
      | 'pangkatGolongan'
      | 'tmtPengangkatan'
      | 'jabatan'
      | 'statusKepegawaian'
      | 'tempatLahir'
      | 'tanggalLahir'
      | 'workPeriod'
      | 'email'
  ) => {
    if (sortConfig?.key !== key) {
      return (
        <ArrowUpDown className="h-3 w-3 text-slate-400" />
      );
    }

    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-blue-600" />
    ) : (
      <ArrowDown className="h-3 w-3 text-blue-600" />
    );
  };

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
    setShowEmployeeForm(true);
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
      noKk: '',
      jenisKelamin: '',
      agama: '',
      alamatJalan: '',
      hp: '',
      jenisPtk: '',
      tugasTambahan: '',
      skPengangkatan: '',
      lembagaPengangkatan: '',
      sumberGaji: '',
      namaIbuKandung: '',
      statusPerkawinan: '',
      namaSuamiIstri: '',
      tmtPns: '',
      npwp: '',
      kewarganegaraan: '',
      bank: '',
      nomorRekeningBank: '',
      rekeningAtasNama: '',
      karpeg: '',
      karisKarsu: '',
      nuks: '',
    });
  };

  const openEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setShowEmployeeForm(true);
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

  const handleDeleteEmployee = async (employee: Employee) => {
    setDeleteTarget(employee);
  };

  const confirmDeleteEmployee = async () => {
    if (!deleteTarget) return;

    const employee = deleteTarget;
    setDeleteTarget(null);

    const result = await deleteEmployeeAction(employee.id);

    if (!result.success) {
      setFeedback({
        type: 'error',
        title: 'Hapus Data Guru Gagal',
        message:
          typeof result.error === 'string'
            ? result.error
            : result.error?.message || 'Data guru tidak berhasil dihapus.',
      });
      return;
    }

    setPreviewEmployee(null);
    await loadEmployees();

    setFeedback({
      type: 'success',
      title: 'Hapus Data Guru Selesai',
      message: `Data guru "${employee.fullName}" berhasil dihapus.`,
    });
  };

  const handleSave = async () => {
    setFormError('');

    const nik = String(form.nik ?? '').trim();

    if (nik && !/^\d{16}$/.test(nik)) {
      setFormError('NIK tidak valid. NIK harus tepat 16 angka.');
      return;
    }

    const lengthLimits: Array<[keyof typeof form, string, number]> = [
      ['nip', 'NIP', 18],
      ['nrk', 'NIKKI / NRK', 10],
      ['nuptk', 'NUPTK', 20],
      ['noKk', 'No. KK', 16],
      ['jenisKelamin', 'Jenis kelamin', 20],
      ['tempatLahir', 'Tempat lahir', 100],
      ['agama', 'Agama', 50],
      ['alamatJalan', 'Alamat', 255],
      ['hp', 'HP', 30],
      ['email', 'Email', 255],
      ['jenisPtk', 'Jenis PTK', 100],
      ['tugasTambahan', 'Tugas tambahan', 255],
      ['skPengangkatan', 'SK pengangkatan', 100],
      ['lembagaPengangkatan', 'Lembaga pengangkatan', 255],
      ['pangkatGolongan', 'Pangkat/golongan', 100],
      ['sumberGaji', 'Sumber gaji', 100],
      ['namaIbuKandung', 'Nama ibu kandung', 255],
      ['statusPerkawinan', 'Status perkawinan', 50],
      ['namaSuamiIstri', 'Nama suami/istri', 255],
      ['npwp', 'NPWP', 30],
      ['kewarganegaraan', 'Kewarganegaraan', 50],
      ['bank', 'Bank', 100],
      ['nomorRekeningBank', 'Nomor rekening bank', 50],
      ['rekeningAtasNama', 'Nama pemilik rekening', 255],
      ['karpeg', 'Karpeg', 50],
      ['karisKarsu', 'Karis/Karsu', 50],
      ['nuks', 'NUKS', 50],
    ];

    for (const [field, label, max] of lengthLimits) {
      const value = form[field];
      if (typeof value === 'string' && value.trim().length > max) {
        setFormError(`${label} maksimal ${max} karakter.`);
        return;
      }
    }

    if (!String(form.fullName ?? '').trim()) {
      setFormError('Nama lengkap wajib diisi.');
      return;
    }

    if (!String(form.jabatan ?? '').trim()) {
      setFormError('Jabatan wajib diisi.');
      return;
    }

    if (
      form.statusPerkawinan === 'Kawin' &&
      !String(form.namaSuamiIstri ?? '').trim()
    ) {
      setFormError('Nama Suami/Istri wajib diisi untuk status Kawin.');
      return;
    }

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
      nuptk: form.nuptk || null,
      noKk: form.noKk || null,
      jenisKelamin: form.jenisKelamin || null,
      tempatLahir: form.tempatLahir || null,
      tanggalLahir: form.tanggalLahir || null,
      agama: form.agama || null,
      alamatJalan: form.alamatJalan || null,
      hp: form.hp || null,
      email: form.email || null,
      jenisPtk: form.jenisPtk || null,
      tugasTambahan: form.tugasTambahan || null,
      skPengangkatan: form.skPengangkatan || null,
      tmtPengangkatan: form.tmtPengangkatan || null,
      lembagaPengangkatan: form.lembagaPengangkatan || null,
      pangkatGolongan: form.pangkatGolongan || null,
      sumberGaji: form.sumberGaji || null,
      namaIbuKandung: form.namaIbuKandung || null,
      statusPerkawinan: form.statusPerkawinan || null,
      namaSuamiIstri: form.namaSuamiIstri || null,
      tmtPns: form.tmtPns || null,
      npwp: form.npwp || null,
      kewarganegaraan: form.kewarganegaraan || null,
      bank: form.bank || null,
      nomorRekeningBank: form.nomorRekeningBank || null,
      rekeningAtasNama: form.rekeningAtasNama || null,
      karpeg: form.karpeg || null,
      karisKarsu: form.karisKarsu || null,
      nuks: form.nuks || null,
    });

    if (!result.success) {
      setFeedback({
        type: 'error',
        title: 'Simpan Data Guru Gagal',
        message:
          typeof result.error === 'string'
            ? result.error
            : result.error?.message ?? 'Gagal menyimpan data guru.',
      });
      return;
    }

    const savedName = String(form.fullName ?? '').trim();
    const isEdit = Boolean(form.id);

    setEditingEmployee(null);
    setShowEmployeeForm(false);
    await loadEmployees();

    setFeedback({
      type: 'success',
      title: isEdit ? 'Update Data Guru Selesai' : 'Tambah Data Guru Selesai',
      message: isEdit
        ? `Data guru "${savedName}" berhasil diperbarui.`
        : `Data guru "${savedName}" berhasil ditambahkan.`,
    });
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
      setFeedback({
        type: 'error',
        title: 'Preview Dapodik Gagal',
        message: 'File Dapodik harus berformat .xls atau .xlsx.',
      });
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
      setFeedback({
        type: 'error',
        title: 'Preview Dapodik Gagal',
        message:
          error instanceof Error
            ? error.message
            : 'Gagal melakukan preview Dapodik.',
      });
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
        setFeedback({
          type: 'error',
          title: 'Apply Dapodik Gagal',
          message: result.errorMessage ?? 'Apply Dapodik gagal.',
        });
        return;
      }

      setShowDapodikPreview(false);
      setDapodikPreview(null);
      setDapodikFile(null);
      await loadEmployees();

      setFeedback({
        type: 'success',
        title: 'Update Data Guru Selesai',
        message: `Data baru ditambahkan: ${result.created ?? 0}
Data dilengkapi: ${result.updated ?? 0}
Data tidak berubah: ${result.skipped ?? 0}
Error: 0`,
      });
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
              onClick={() => openCreate()}
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
                <th className="py-3 px-4 w-12">
                  No
                </th>

                {[
                  ['fullName', 'Nama'],
                  ['identity', 'NIP/NIKKI'],
                  ['pangkatGolongan', 'Pangkat/Golongan'],
                  ['tmtPengangkatan', 'TMT'],
                  ['jabatan', 'Jabatan'],
                  ['statusKepegawaian', 'Status Kepegawaian'],
                  ['tempatLahir', 'Tmp. Lahir'],
                  ['tanggalLahir', 'Tgl Lahir'],
                  ['workPeriod', 'Masa Kerja'],
                  ['email', 'Email'],
                ].map(([key, label]) => (
                  <th
                    key={key}
                    className="py-3 px-4"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(key as any)}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap hover:text-blue-600"
                      title={`Urutkan ${label}`}
                    >
                      <span>{label}</span>
                      {sortIcon(key as any)}
                    </button>
                  </th>
                ))}

                <th className="py-3 px-4 text-right">
                  Aksi
                </th>
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
                        <button
                          type="button"
                          onClick={() => handleDeleteEmployee(employee)}
                          className="text-red-600 hover:text-red-700 hover:underline font-normal text-xs"
                        >
                          Hapus
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
      {showEmployeeForm && (
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
                  onClick={() => { setEditingEmployee(null); setShowEmployeeForm(false); }}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[65vh] overflow-y-auto p-6">
                {formError && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {formError}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    ['fullName', 'Nama', true],
                    ['nip', 'NIP', false],
                    ['nrk', 'NIKKI / NRK', false],
                    ['nik', 'NIK', false],
                    ['nuptk', 'NUPTK', false],
                    ['noKk', 'No. KK', false],
                    ['pangkatGolongan', 'Pangkat/Golongan', false],
                    ['tmtPengangkatan', 'TMT Pengangkatan', false],
                    ['jabatan', 'Jabatan', false],
                    ['unitKerja', 'Unit Kerja', false],
                    ['instansi', 'Instansi', false],
                    ['jenisPtk', 'Jenis PTK', false],
                    ['tugasTambahan', 'Tugas Tambahan', false],
                    ['tempatLahir', 'Tempat Lahir', false],
                    ['tanggalLahir', 'Tanggal Lahir', false],
                    ['jenisKelamin', 'Jenis Kelamin', false],
                    ['agama', 'Agama', false],
                    ['alamatJalan', 'Alamat', false],
                    ['hp', 'HP', false],
                    ['email', 'Email', false],
                    ['skPengangkatan', 'SK Pengangkatan', false],
                    ['lembagaPengangkatan', 'Lembaga Pengangkatan', false],
                    ['sumberGaji', 'Sumber Gaji', false],
                    ['namaIbuKandung', 'Nama Ibu Kandung', false],
                    ['statusPerkawinan', 'Status Perkawinan', false],
                    ['namaSuamiIstri', 'Nama Suami/Istri', false],
                    ['tmtPns', 'TMT PNS', false],
                    ['npwp', 'NPWP', false],
                    ['kewarganegaraan', 'Kewarganegaraan', false],
                    ['bank', 'Bank', false],
                    ['nomorRekeningBank', 'Nomor Rekening Bank', false],
                    ['rekeningAtasNama', 'Rekening Atas Nama', false],
                    ['karpeg', 'Karpeg', false],
                    ['karisKarsu', 'Karis/Karsu', false],
                    ['nuks', 'NUKS', false],
                  ].map(([key, label, required]) => (
                    <label key={String(key)} className="space-y-1">
                      <span className="text-[11px] font-medium text-slate-600">
                        {String(label)}{required ? ' *' : ''}
                      </span>
                      {key === 'jenisKelamin' ? (
                        <select
                          value={form[String(key)] ?? ''}
                          onChange={(e) => setForm((current: any) => ({ ...current, [String(key)]: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                        >
                          <option value="">Pilih Jenis Kelamin</option>
                          <option value="Laki-laki">Laki-laki</option>
                          <option value="Perempuan">Perempuan</option>
                        </select>
                      ) : key === 'agama' ? (
                        <select
                          value={form[String(key)] ?? ''}
                          onChange={(e) => setForm((current: any) => ({ ...current, [String(key)]: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                        >
                          <option value="">Pilih Agama</option>
                          <option value="Islam">Islam</option>
                          <option value="Kristen">Kristen</option>
                          <option value="Katolik">Katolik</option>
                          <option value="Hindu">Hindu</option>
                          <option value="Buddha">Buddha</option>
                          <option value="Konghucu">Konghucu</option>
                          <option value="Kepercayaan terhadap Tuhan YME">
                            Kepercayaan terhadap Tuhan YME
                          </option>
                        </select>
                      ) : (
                      <input
                        type={
                          key === 'tmtPengangkatan' ||
                          key === 'tanggalLahir' ||
                          key === 'tmtPns'
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
                      )}
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
                  onClick={() => { setEditingEmployee(null); setShowEmployeeForm(false); }}
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
        )}

      {/* DAPODIK PREVIEW — canonical Student UX */}
      {showDapodikPreview && dapodikPreview && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white font-sans shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Preview Update Data Dapodik
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Periksa perubahan sebelum data diterapkan ke master guru.
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup preview Dapodik"
                onClick={() => {
                  setShowDapodikPreview(false);
                  setDapodikPreview(null);
                  setDapodikFile(null);
                }}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-5">
              {[
                ["Total", dapodikPreview.total, "text-slate-900"],
                ["Baru", dapodikPreview.newCount, "text-blue-600"],
                ["Isi Kosong", dapodikPreview.fillBlankCount, "text-emerald-600"],
                ["Konflik", dapodikPreview.conflictCount, "text-amber-600"],
                ["Tidak Berubah", dapodikPreview.items?.filter((item: any) => item.status === "UNCHANGED").length ?? 0, "text-slate-600"],
              ].map(([label, value, color]) => (
                <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="text-[11px] text-slate-500">{label}</div>
                  <div className={`text-lg font-semibold ${color}`}>{value}</div>
                </div>
              ))}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-3">
              <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {[
                  ["REVIEW", "Perlu Review"],
                  ["ALL", "Semua"],
                  ["UNCHANGED", "Tidak Berubah"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDapodikPreviewFilter(value as "REVIEW" | "ALL" | "UNCHANGED")}
                    className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
                      dapodikPreviewFilter === value
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-400">
                Menampilkan {(dapodikPreview.items ?? []).filter((item: any) =>
                  dapodikPreviewFilter === "ALL" ||
                  (dapodikPreviewFilter === "REVIEW" && ["NEW", "FILL_BLANK", "CONFLICT", "ERROR"].includes(item.status)) ||
                  (dapodikPreviewFilter === "UNCHANGED" && item.status === "UNCHANGED")
                ).length} dari {dapodikPreview.total} data Guru
              </span>
            </div>

            <div ref={dapodikPreviewListRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {(dapodikPreview.items ?? []).filter((item: any) =>
                dapodikPreviewFilter === "ALL" ||
                (dapodikPreviewFilter === "REVIEW" && ["NEW", "FILL_BLANK", "CONFLICT", "ERROR"].includes(item.status)) ||
                (dapodikPreviewFilter === "UNCHANGED" && item.status === "UNCHANGED")
              ).length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  Tidak ada data pada filter ini.
                </div>
              ) : (
                (dapodikPreview.items ?? []).filter((item: any) =>
                  dapodikPreviewFilter === "ALL" ||
                  (dapodikPreviewFilter === "REVIEW" && ["NEW", "FILL_BLANK", "CONFLICT", "ERROR"].includes(item.status)) ||
                  (dapodikPreviewFilter === "UNCHANGED" && item.status === "UNCHANGED")
                ).map((item: any, index: number) => (
                  <div key={`${item.row}-${item.identifier}-${index}`} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{item.name || "-"}</div>
                        <div className="text-[11px] text-slate-500">
                          Baris {item.row} · {item.identifier || "-"}
                        </div>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                        item.status === "NEW" ? "bg-blue-50 text-blue-700" :
                        item.status === "FILL_BLANK" ? "bg-emerald-50 text-emerald-700" :
                        item.status === "CONFLICT" || item.status === "ERROR" ? "bg-amber-50 text-amber-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {item.status}
                      </span>
                    </div>

                    {(item.fields ?? []).length > 0 && (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-left text-slate-500">
                              <th className="py-2 pr-3">Field</th>
                              <th className="py-2 pr-3">Master</th>
                              <th className="py-2">Dapodik</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(item.fields ?? []).map((field: any) => (
                              <tr key={field.field} className="border-b last:border-0">
                                <td className="py-2 pr-3 font-medium">{field.label}</td>
                                <td className="py-2 pr-3 text-slate-500">{field.currentValue || "-"}</td>
                                <td className="py-2 font-medium text-slate-900">{field.incomingValue || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {item.message && (
                      <div className="mt-2 text-[11px] text-slate-500">{item.message}</div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-4">
              {Number(dapodikPreview.newCount) > 0 && (
                <button
                  type="button"
                  onClick={handleApplyDapodik}
                  disabled={isApplyingDapodik}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isApplyingDapodik ? "Menerapkan..." : `Tambahkan ${dapodikPreview.newCount} Data Baru ke Master`}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowDapodikPreview(false);
                  setDapodikPreview(null);
                  setDapodikFile(null);
                }}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        open={!!deleteTarget}
        title="Hapus Data Guru?"
        message={
          deleteTarget
            ? `Data "${deleteTarget.fullName}" akan dihapus.\n\nData yang dihapus tidak dapat dipulihkan.`
            : ''
        }
        confirmLabel="Hapus"
        onConfirm={confirmDeleteEmployee}
        onClose={() => setDeleteTarget(null)}
      />

      <FeedbackModal
        feedback={feedback}
        onClose={() => setFeedback(null)}
      />

    </div>
  );
}
