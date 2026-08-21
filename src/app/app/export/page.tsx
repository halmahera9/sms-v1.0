'use client';

import { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  FileText, 
  Download, 
  CheckCircle2, 
  Filter, 
  Building2,
  Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getStoredDocuments, addAuditLog } from '@/lib/storage';
import { OCRDocument, ExtractedItem } from '@/types/sms';

export default function ExportReportsPage() {
  const [documents, setDocuments] = useState<OCRDocument[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('Semua');

  useEffect(() => {
    setDocuments(getStoredDocuments());
  }, []);

  // Collect all verified items from all documents
  const allVerifiedItems: { docName: string; item: ExtractedItem }[] = [];
  documents.forEach((doc) => {
    doc.items.forEach((item) => {
      if (item.verificationStatus === 'verified' || item.verificationStatus === 'edited') {
        allVerifiedItems.push({ docName: doc.fileName, item });
      }
    });
  });

  const filteredItems = allVerifiedItems.filter(
    (row) => selectedClass === 'Semua' || row.item.class === selectedClass
  );

  const availableClasses = ['Semua', ...Array.from(new Set(allVerifiedItems.map((r) => r.item.class)))];

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    if (filteredItems.length === 0) {
      alert('Tidak ada data terverifikasi untuk diekspor.');
      return;
    }

    const excelRows = filteredItems.map((row, idx) => ({
      No: idx + 1,
      Tanggal: row.item.date,
      NISN: row.item.matchedNisn || '—',
      'Nama Siswa': row.item.matchedStudentName || row.item.ocrText,
      Kelas: row.item.class,
      Status: row.item.status,
      Keterangan: row.item.notes || '—',
      Dokumen: row.docName,
      'Status Verifikasi': 'Terverifikasi (Human-in-the-Loop)',
    }));

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap_Ketidakhadiran');
    
    const fileName = `Rekap_SMS_Ketidakhadiran_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    addAuditLog(
      'Operator TU - Budi',
      'EXPORT_EXCEL',
      fileName,
      `Mengekspor ${filteredItems.length} baris data rekap ketidakhadiran ke format Excel.`
    );
  };

  // Export to PDF
  const handleExportPDF = () => {
    if (filteredItems.length === 0) {
      alert('Tidak ada data terverifikasi untuk diekspor.');
      return;
    }

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(16);
    doc.text('BANYUBIRU DIGITAL SOLUTION - SMS', 14, 18);
    doc.setFontSize(11);
    doc.text('REKAPITULASI KETIDAKHADIRAN SISWA TERVERIFIKASI', 14, 25);
    doc.setFontSize(9);
    doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')} | Filter Kelas: ${selectedClass}`, 14, 31);
    doc.line(14, 34, 196, 34);

    const tableRows = filteredItems.map((row, idx) => [
      idx + 1,
      row.item.date,
      row.item.matchedNisn || '—',
      row.item.matchedStudentName || row.item.ocrText,
      row.item.class,
      row.item.status,
      row.item.notes || '—',
    ]);

    autoTable(doc, {
      startY: 38,
      head: [['No', 'Tanggal', 'NISN', 'Nama Siswa', 'Kelas', 'Status', 'Catatan/Keterangan']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
    });

    const fileName = `Rekap_SMS_Ketidakhadiran_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);

    addAuditLog(
      'Operator TU - Budi',
      'EXPORT_PDF',
      fileName,
      `Mengekspor ${filteredItems.length} baris data rekap ketidakhadiran ke format PDF.`
    );
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
            className="flex items-center gap-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 px-4 py-2 text-xs font-bold rounded shadow-md shadow-emerald-500/20 transition-all"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Ekspor Excel (.xlsx)</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 bg-sky-400 hover:bg-sky-300 text-slate-950 px-4 py-2 text-xs font-bold rounded shadow-md shadow-sky-500/20 transition-all"
          >
            <FileText className="h-4 w-4" />
            <span>Ekspor PDF</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="panel p-4 rounded-xl border border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-sky-400" />
          <span className="text-xs text-slate-300 font-mono">Filter Kelas:</span>
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

        <div className="text-xs font-mono text-slate-400">
          Total Terverifikasi: <span className="text-emerald-400 font-bold">{filteredItems.length} Data Siswa</span>
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
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 font-mono">
                    Belum ada data terverifikasi. Selesaikan verifikasi di menu Verifikasi Operator terlebih dahulu.
                  </td>
                </tr>
              ) : (
                filteredItems.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="p-3 text-slate-400">{idx + 1}</td>
                    <td className="p-3 text-slate-300">{row.item.date}</td>
                    <td className="p-3 text-slate-400">{row.item.matchedNisn || '—'}</td>
                    <td className="p-3 font-semibold text-white">
                      {row.item.matchedStudentName || row.item.ocrText}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 text-[10px]">
                        {row.item.class}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-amber-300">{row.item.status}</td>
                    <td className="p-3 text-slate-400 text-[11px] truncate max-w-xs">{row.item.notes || '—'}</td>
                    <td className="p-3 text-right">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px]">
                        Terverifikasi
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
