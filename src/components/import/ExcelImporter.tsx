'use client';

import React, { useState } from 'react';
import { parseNominatifExcel } from '@/lib/excel-import';
import { AwardProposal } from '@/types/award';
import { Upload, FileSpreadsheet, CheckCircle2, ArrowRight } from 'lucide-react';

interface ExcelImporterProps {
  onImportComplete: (newProposals: AwardProposal[]) => void;
}

export const ExcelImporter: React.FC<ExcelImporterProps> = ({ onImportComplete }) => {
  const [parsedData, setParsedData] = useState<AwardProposal[] | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = async (file: File) => {
    setIsProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = parseNominatifExcel(buffer);
      setParsedData(result.proposals);
      setLogs(result.logs);
    } catch (err) {
      console.error(err);
      setLogs(['Gagal membaca file Excel. Pastikan format file .xlsx valid.']);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSaveImport = () => {
    if (parsedData && parsedData.length > 0) {
      onImportComplete(parsedData);
      setParsedData(null);
      setLogs(['Impor data nominatif berhasil disimpan ke dalam sistem!']);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
          <span>Import Nominatif Usulan Penghargaan (.xlsx)</span>
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Unggah file Excel `daftar nominatif penghargaan.xlsx` untuk menambahkan atau memperbarui data usulan pegawai. Sistem akan secara otomatis memisahkan jenis usulan **Masa Kerja** vs **Satyalancana**.
        </p>
      </div>

      {/* Drag and Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`bg-white dark:bg-slate-900 p-8 rounded-2xl border-2 border-dashed text-center transition-all cursor-pointer ${
          dragActive
            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400'
        }`}
      >
        <input
          type="file"
          accept=".xlsx, .xls"
          id="excel-file-input"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileChange(e.target.files[0]);
            }
          }}
        />
        <label htmlFor="excel-file-input" className="cursor-pointer space-y-3 block">
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <Upload className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {isProcessing ? 'Memproses File Excel...' : 'Klik untuk Pilih File atau Drag & Drop File Excel di sini'}
            </p>
            <p className="text-xs text-slate-400 mt-1">Mendukung format .XLSX dan .XLS</p>
          </div>
        </label>
      </div>

      {/* Logs / Messages */}
      {logs.length > 0 && (
        <div className="bg-slate-900 text-slate-200 p-4 rounded-xl text-xs font-mono space-y-1">
          {logs.map((log, i) => (
            <div key={i} className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{log}</span>
            </div>
          ))}
        </div>
      )}

      {/* Preview Table */}
      {parsedData && parsedData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Preview Data Impor ({parsedData.length} Entri)
              </h3>
              <p className="text-xs text-slate-500">Periksa sampel data sebelum disimpan ke sistem.</p>
            </div>

            <button
              onClick={handleSaveImport}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg text-xs font-bold shadow flex items-center space-x-2 transition-all"
            >
              <span>Simpan ke Database</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg max-h-80">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="py-2.5 px-3">No</th>
                  <th className="py-2.5 px-3">NRK</th>
                  <th className="py-2.5 px-3">Nama Pegawai</th>
                  <th className="py-2.5 px-3">Jabatan</th>
                  <th className="py-2.5 px-3">UKPD / Wilayah</th>
                  <th className="py-2.5 px-3">Usulan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {parsedData.slice(0, 10).map((p, idx) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-2 px-3 font-mono font-semibold text-slate-800 dark:text-slate-200">{p.employee.nrk}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">{p.employee.nama}</td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{p.employee.jabatan}</td>
                    <td className="py-2 px-3 text-slate-500">{p.employee.ukpd} ({p.employee.wilayah})</td>
                    <td className="py-2 px-3 font-bold text-blue-600 dark:text-blue-400">
                      {p.jenisPenghargaan} ({p.nilaiUsulan})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsedData.length > 10 && (
            <p className="text-xs text-slate-400 text-center font-mono">
              ...dan {parsedData.length - 10} entri lainnya.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
