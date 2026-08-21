'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  Upload, 
  Plus, 
  Search, 
  FileSpreadsheet, 
  Trash2, 
  CheckCircle2, 
  X,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { getStoredStudents, saveStudents, addAuditLog } from '@/lib/storage';
import { Student } from '@/types/sms';

export default function MasterStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('Semua');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // New Student Form State
  const [newNisn, setNewNisn] = useState('');
  const [newName, setNewName] = useState('');
  const [newClass, setNewClass] = useState('9A');
  const [newGender, setNewGender] = useState<'L' | 'P'>('L');

  useEffect(() => {
    setStudents(getStoredStudents());
  }, []);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Filter students
  const filteredStudents = students.filter((s) => {
    const matchesSearch = 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.nisn.includes(searchQuery);
    const matchesClass = selectedClass === 'Semua' || s.class === selectedClass;
    return matchesSearch && matchesClass;
  });

  const availableClasses = ['Semua', ...Array.from(new Set(students.map((s) => s.class)))];

  // Excel / CSV File Import Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        if (data.length === 0) {
          alert('File Excel kosong atau format tidak sesuai.');
          return;
        }

        const imported: Student[] = data.map((row: any, idx: number) => ({
          id: `std-imp-${Date.now()}-${idx}`,
          nisn: String(row.NISN || row.nisn || `000${Date.now()}${idx}`),
          nis: String(row.NIS || row.nis || ''),
          name: String(row.Nama || row.NAMA || row.name || `Siswa ${idx + 1}`),
          class: String(row.Kelas || row.KELAS || row.class || '9A'),
          gender: (row.JK || row.Gender || row.gender || 'L').toUpperCase().startsWith('P') ? 'P' : 'L',
          status: 'Aktif',
        }));

        const updated = [...students, ...imported];
        setStudents(updated);
        saveStudents(updated);
        addAuditLog(
          'Operator TU - Budi',
          'IMPORT_STUDENTS',
          file.name,
          `Mengimpor ${imported.length} siswa dari file spreadsheet.`
        );
        showNotification(`Berhasil mengimpor ${imported.length} data siswa dari ${file.name}`);
      } catch (err) {
        alert('Gagal membaca file Excel. Pastikan format file .xlsx atau .csv');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Add Student Manually
  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newNisn) return;

    const newStudent: Student = {
      id: `std-${Date.now()}`,
      nisn: newNisn,
      name: newName,
      class: newClass,
      gender: newGender,
      status: 'Aktif',
    };

    const updated = [newStudent, ...students];
    setStudents(updated);
    saveStudents(updated);
    addAuditLog('Operator TU - Budi', 'ADD_STUDENT', newName, `Menambahkan siswa baru (NISN: ${newNisn}, Kelas: ${newClass})`);
    
    setIsAddModalOpen(false);
    setNewName('');
    setNewNisn('');
    showNotification(`Siswa ${newName} berhasil ditambahkan.`);
  };

  // Delete Student
  const handleDeleteStudent = (id: string, name: string) => {
    if (!confirm(`Hapus ${name} dari Master Data?`)) return;
    const updated = students.filter((s) => s.id !== id);
    setStudents(updated);
    saveStudents(updated);
    addAuditLog('Operator TU - Budi', 'DELETE_STUDENT', name, 'Menghapus data siswa dari Master Data.');
    showNotification(`Data ${name} berhasil dihapus.`);
  };

  // Download Sample Template Excel
  const handleDownloadTemplate = () => {
    const sampleData = [
      { NISN: '0054819211', NIS: '21221011', Nama: 'Rian Ardianto', Kelas: '9A', JK: 'L' },
      { NISN: '0054819212', NIS: '21221012', Nama: 'Siti Badriah', Kelas: '9B', JK: 'P' },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Master_Siswa');
    XLSX.writeFile(wb, 'Template_Import_Siswa_SMS.xlsx');
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Master Data Siswa</h1>
          <p className="text-xs text-slate-400 mt-1">
            Database utama siswa yang digunakan sebagai referensi Fuzzy Matching OCR.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 px-3.5 py-2 text-xs font-medium rounded transition-colors"
          >
            <Download className="h-4 w-4 text-sky-400" />
            <span>Download Template</span>
          </button>

          <label className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3.5 py-2 text-xs font-semibold rounded cursor-pointer transition-colors shadow-sm shadow-emerald-500/20">
            <Upload className="h-4 w-4" />
            <span>Import Dapodik / Excel</span>
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              onChange={handleFileUpload} 
              className="hidden" 
            />
          </label>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-sky-400 hover:bg-sky-300 text-slate-950 px-3.5 py-2 text-xs font-semibold rounded transition-colors shadow-sm shadow-sky-500/20"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Siswa</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div className="flex items-center gap-2 p-4 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs font-mono">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="panel p-4 rounded-xl border border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari NISN atau Nama Siswa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-white/15 pl-9 pr-4 py-2 text-xs text-white rounded outline-none focus:border-sky-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 font-mono">Filter Kelas:</span>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="bg-slate-900 border border-white/15 px-3 py-1.5 text-xs text-white rounded outline-none focus:border-sky-400"
          >
            {availableClasses.map((cls) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Students Table */}
      <div className="panel rounded-xl overflow-hidden border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 font-mono uppercase text-[11px] border-b border-white/10">
              <tr>
                <th className="p-4">NISN / NIS</th>
                <th className="p-4">Nama Lengkap Siswa</th>
                <th className="p-4">Kelas</th>
                <th className="p-4">JK</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-mono">
                    Tidak ada data siswa ditemukan.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 font-mono">
                      <div className="text-white font-medium">{s.nisn}</div>
                      {s.nis && <div className="text-[10px] text-slate-400">NIS: {s.nis}</div>}
                    </td>
                    <td className="p-4 font-semibold text-white">{s.name}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 font-mono text-[11px]">
                        {s.class}
                      </span>
                    </td>
                    <td className="p-4 font-mono">{s.gender || 'L'}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px]">
                        {s.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDeleteStudent(s.id, s.name)}
                        className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded transition-colors"
                        title="Hapus Siswa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-white/10 text-xs text-slate-400 font-mono flex justify-between">
          <span>Menampilkan {filteredStudents.length} dari {students.length} siswa</span>
          <span>Total Kelas: {availableClasses.length - 1}</span>
        </div>
      </div>

      {/* Add Student Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="panel p-6 rounded-2xl w-full max-w-md border border-white/20 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white">Tambah Siswa Baru</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-mono mb-1">NISN *</label>
                <input
                  required
                  type="text"
                  placeholder="Contoh: 0054819210"
                  value={newNisn}
                  onChange={(e) => setNewNisn(e.target.value)}
                  className="w-full bg-slate-900 border border-white/15 px-3 py-2 text-white rounded outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-mono mb-1">Nama Lengkap Siswa *</label>
                <input
                  required
                  type="text"
                  placeholder="Contoh: Muhammad Rizky"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-900 border border-white/15 px-3 py-2 text-white rounded outline-none focus:border-sky-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-mono mb-1">Kelas</label>
                  <input
                    type="text"
                    placeholder="9A"
                    value={newClass}
                    onChange={(e) => setNewClass(e.target.value)}
                    className="w-full bg-slate-900 border border-white/15 px-3 py-2 text-white rounded outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-mono mb-1">Jenis Kelamin</label>
                  <select
                    value={newGender}
                    onChange={(e) => setNewGender(e.target.value as 'L' | 'P')}
                    className="w-full bg-slate-900 border border-white/15 px-3 py-2 text-white rounded outline-none focus:border-sky-400"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-1/2 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 bg-sky-400 text-slate-950 hover:bg-sky-300 rounded font-semibold"
                >
                  Simpan Siswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
