'use client';

import { useState, useEffect } from 'react';
import { 
  Upload, 
  Search, 
  CheckCircle2, 
  X,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { importDapodikAction, previewDapodikAction } from '@/platform/actions/dapodik-import';
import { getEmployeesAction } from '@/platform/actions/employee';

export default function MasterEmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    const loadEmployees = async () => {
      const result = await getEmployeesAction({ limit: 200 });
      if (result.success) {
        setEmployees(result.data ?? []);
      }
    };
    void loadEmployees();
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('Semua');
  const [notification, setNotification] = useState<string | null>(null);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewDapodikAction>> | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  // New Student Form State
  const [newName, setNewName] = useState('');

  useEffect(() => {
  }, []);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Filter students
  const filteredEmployees = employees.filter((s) => {
    const matchesSearch = 
      s.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.nip?.includes(searchQuery);
    const matchesClass = selectedClass === 'Semua' || s.unitKerja === selectedClass;
    return matchesSearch && matchesClass;
  });

  const availableClasses = ['Semua', ...Array.from(new Set(employees.map((s) => s.unitKerja).filter(Boolean)))];

  // Dapodik / Excel Preview Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.set("mode", "employee");
      formData.set("file", file);

      const result = await previewDapodikAction(formData);
      setPreview(result);
      setPreviewFile(file);

      showNotification(
        `Preview ${file.name}: ${result.total} baris, ${result.newCount} baru, ${result.changedCount} berubah, ${result.errorCount} bermasalah.`
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Gagal melakukan preview Dapodik.");
    } finally {
      e.target.value = "";
    }
  };

  // Download Sample Template Excel
  const handleDownloadTemplate = () => {
    const sampleData = [
      {
        NIP: '197001011990031001',
        NRK: '123456',
        Nama: 'Contoh Nama Guru',
        Jabatan: 'Guru Mata Pelajaran',
        'Unit Kerja': 'SMP Negeri 99 Jakarta',
        Instansi: 'SMP Negeri 99 Jakarta',
        'Status Kepegawaian': 'PNS',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Master_Pegawai');
    XLSX.writeFile(wb, 'Template_Import_Pegawai_SMS.xlsx');
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Master Data Guru/Pegawai</h1>
          <p className="text-xs text-slate-600 mt-1">
            Database utama siswa yang digunakan sebagai referensi Fuzzy Matching OCR.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3.5 py-2 text-xs font-medium rounded transition-colors"
          >
            <Download className="h-4 w-4 text-blue-600" />
            <span>Download Template</span>
          </button>

          <label className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-semibold rounded cursor-pointer transition-colors shadow-sm shadow-blue-600/10">
            <Upload className="h-4 w-4" />
            <span>Import Dapodik Guru/Pegawai</span>
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              onChange={handleFileUpload} 
              className="hidden" 
            />
          </label>

        </div>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div className="flex items-center gap-2 p-4 bg-blue-600/20 border border-slate-200 rounded-lg text-slate-900 text-xs font-mono">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-600" />
          <input
            type="text"
            placeholder="Cari NISN atau Nama Siswa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2 text-xs text-slate-900 rounded outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-600 font-mono">Filter Jabatan / Unit Kerja:</span>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="bg-white border border-slate-200 px-3 py-1.5 text-xs text-slate-900 rounded outline-none focus:border-blue-600"
          >
            {availableClasses.map((cls) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>
      </div>

      {preview && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Preview Import Dapodik</h2>
              <p className="text-xs text-slate-600 mt-1">
                {preview.total} data · {preview.newCount} baru · {preview.changedCount} berubah · {preview.errorCount} bermasalah
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={!previewFile || preview?.errorCount > 0}
                onClick={async () => {
                  if (!previewFile) return;
                  const formData = new FormData();
                  formData.set("mode", "employee");
                  formData.set("dryRun", "false");
                  formData.set("file", previewFile);
                  const result = await importDapodikAction(formData);
                  if (!result.ok) {
                    alert(result.errorMessage ?? "Import Dapodik gagal.");
                    return;
                  }
                  setPreview(null);
                  setPreviewFile(null);
                  showNotification(
                    `Import berhasil: ${result.created} baru, ${result.updated} diperbarui, ${result.skipped} dilewati.`
                  );
                }}
                className="px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Setujui & Import
              </button>
              <button
                onClick={() => {
                  setPreview(null);
                  setPreviewFile(null);
                }}
                className="text-slate-600 hover:text-slate-900"
                aria-label="Tutup preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white text-slate-600">
                <tr>
                  <th className="p-3">Baris</th>
                  <th className="p-3">NISN</th>
                  <th className="p-3">Nama</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {preview.items.map((item) => (
                  <tr key={`${item.row}-${item.identifier}`}>
                    <td className="p-3 text-slate-600">{item.row}</td>
                    <td className="p-3 text-slate-700">{item.identifier}</td>
                    <td className="p-3 text-slate-900">{item.name}</td>
                    <td className="p-3">
                      <span className="font-medium">
                        {item.status === "NEW" && "DATA BARU"}
                        {item.status === "CHANGED" && "DATA BERUBAH"}
                        {item.status === "UNCHANGED" && "TIDAK ADA PERUBAHAN"}
                        {item.status === "ERROR" && "DATA BERMASALAH"}
                      </span>
                      {item.message && (
                        <div className="text-[11px] text-slate-900 mt-1">{item.message}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Employees Table */}
      <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 font-mono uppercase text-[11px] border-b border-slate-200">
              <tr>
                <th className="p-4">NIP / NRK</th>
                <th className="p-4">Nama Guru/Pegawai</th>
                <th className="p-4">Jabatan / Unit Kerja</th>
                <th className="p-4">Status Kepegawaian</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-600 font-mono">
                    Tidak ada data guru/pegawai ditemukan.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-mono">
                      <div className="text-slate-900 font-medium">{s.nip}</div>
                      {s.nrk && <div className="text-[10px] text-slate-600">NIS: {s.nrk}</div>}
                    </td>
                    <td className="p-4 font-semibold text-slate-900">{s.fullName}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-blue-600/10 text-blue-600 border border-blue-200 font-mono text-[11px]">
                        {s.jabatan}
                      </span>
                    </td>
                    <td className="p-4 font-mono">{s.unitKerja || 'L'}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-blue-600/15 text-slate-900 border border-slate-200 text-[10px]">
                        {s.statusKepegawaian}
                      </span>
                    </td>
                    <td className="p-4 text-right">—</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-200 text-xs text-slate-600 font-mono flex justify-between">
          <span>Menampilkan {filteredEmployees.length} dari {employees.length} guru/pegawai</span>
          <span>Total Jabatan / Unit Kerja: {availableClasses.length - 1}</span>
        </div>
      </div>

    </div>
  );
}
