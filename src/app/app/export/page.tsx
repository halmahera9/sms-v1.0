'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  FileSpreadsheet, 
  FileText, 
  CheckCircle2, 
  Filter,
  Loader2,
  AlertCircle
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  getStudentAbsenceExportDataAction,
  StudentAbsenceExportRowDTO,
} from '@/platform/actions/student-export';
import {
  mapDtoRowsToExportRows,
  downloadStudentAbsenceExcel,
} from '@/domains/student/export';

export default function ExportReportsPage() {
  const [rows, setRows] = useState<StudentAbsenceExportRowDTO[]>([]);
  const [filename, setFilename] = useState<string>('Rekap_SMS_Ketidakhadiran.xlsx');
  const [selectedClass, setSelectedClass] = useState<string>('Semua');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const fetchData = useCallback(async (cls: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStudentAbsenceExportDataAction({ selectedClass: cls });
      if (res.success && res.data) {
        setRows(res.data.rows);
        setFilename(res.data.filename);
      } else {
        setError(res.error?.message || 'Gagal memuat data rekapitulasi.');
      }
    } catch (err) {
      console.error('Failed to fetch export data:', err);
      setError('Terjadi kesalahan koneksi saat memuat data rekapitulasi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(selectedClass);
  }, [fetchData, selectedClass]);

  const availableClasses = [
    'Semua',
    'X IPA 1',
    'X IPA 2',
    'X IPS 1',
    'XI IPA 1',
    'XI IPS 1',
    'XII IPA 1',
  ];

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    if (rows.length === 0) {
      alert('Tidak ada data terverifikasi untuk diekspor.');
      return;
    }

    setIsExporting(true);
    try {
      const exportRows = mapDtoRowsToExportRows(rows);
      const success = downloadStudentAbsenceExcel(exportRows, filename);
      if (!success) {
        alert('Gagal membuat file Excel.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Export to PDF
  const handleExportPDF = () => {
    if (rows.length === 0) {
      alert('Tidak ada data terverifikasi untuk diekspor.');
      return;
    }

    setIsExporting(true);
    try {
      const doc = new jsPDF();

      // Header
      doc.setFontSize(16);
      doc.text('BANYUBIRU DIGITAL SOLUTION - SMS', 14, 18);
      doc.setFontSize(11);
      doc.text('REKAPITULASI KETIDAKHADIRAN SISWA TERVERIFIKASI', 14, 25);
      doc.setFontSize(9);
      doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')} | Filter Kelas: ${selectedClass}`, 14, 31);
      doc.line(14, 34, 196, 34);

      const tableRows = rows.map((r, idx) => [
        idx + 1,
        r.date,
        r.nisn,
        r.studentName,
        r.className,
        r.status,
        r.notes,
      ]);

      autoTable(doc, {
        startY: 38,
        head: [['No', 'Tanggal', 'NISN', 'Nama Siswa', 'Kelas', 'Status', 'Catatan/Keterangan']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42] },
      });

      const pdfFilename = filename.replace('.xlsx', '.pdf');
      doc.save(pdfFilename);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Pusat Ekspor Laporan Sekolah</h1>
          <p className="text-xs text-slate-400 mt-1">
            Unduh rekapitulasi data yang telah lolos verifikasi operator dalam format Excel (.xlsx) atau PDF.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportExcel}
            disabled={isExporting || loading || rows.length === 0}
            className="flex items-center gap-2 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-slate-950 px-4 py-2 text-xs font-bold rounded shadow-md shadow-emerald-500/20 transition-all"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Ekspor Excel (.xlsx)</span>
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isExporting || loading || rows.length === 0}
            className="flex items-center gap-2 bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-slate-950 px-4 py-2 text-xs font-bold rounded shadow-md shadow-sky-500/20 transition-all"
          >
            <FileText className="h-4 w-4" />
            <span>Ekspor PDF</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-500/30 rounded-lg flex items-center space-x-2 text-red-400 text-xs font-mono">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="panel p-4 rounded-xl border border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-sky-400" />
          <span className="text-xs text-slate-300 font-mono">Filter Kelas:</span>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            disabled={loading}
            className="bg-slate-900 border border-white/15 px-3 py-1.5 text-xs text-white rounded outline-none focus:border-sky-400 disabled:opacity-50"
          >
            {availableClasses.map((cls) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>

        <div className="text-xs font-mono text-slate-400">
          Total Terverifikasi: <span className="text-emerald-400 font-bold">{rows.length} Data Siswa</span>
        </div>
      </div>

      {/* Report Preview Table */}
      <div className="panel rounded-xl overflow-hidden border border-white/10">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>Preview Data Rekapitulasi Siap Ekspor</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-400">Banyubiru SMS v1.0</span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-mono">Memuat data rekapitulasi terverifikasi...</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 font-mono text-[11px] uppercase border-b border-white/10">
                <tr>
                  <th className="p-3">No</th>
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">NISN</th>
                  <th className="p-3">Nama Siswa</th>
                  <th className="p-3">Kelas</th>
                  <th className="p-3">Status Absen</th>
                  <th className="p-3">Catatan / Alasan</th>
                  <th className="p-3 text-right">Verifikasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 font-mono">
                      Belum ada data terverifikasi untuk kelas yang dipilih.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.no} className="hover:bg-slate-800/40">
                      <td className="p-3 text-slate-400">{row.no}</td>
                      <td className="p-3 text-slate-300">{row.date}</td>
                      <td className="p-3 text-slate-400">{row.nisn}</td>
                      <td className="p-3 font-semibold text-white">
                        {row.studentName}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 text-[10px]">
                          {row.className}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-amber-300">{row.status}</td>
                      <td className="p-3 text-slate-400 text-[11px] truncate max-w-xs">{row.notes}</td>
                      <td className="p-3 text-right">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px]">
                          {row.verificationStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
