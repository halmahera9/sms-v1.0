'use client';

import React, { useState, useEffect } from 'react';
import { Student, OCRDocument, ExtractedItem, AbsenceStatus } from '../types';
import {
  getStoredStudents,
  getStoredDocuments,
  saveStudents,
  saveDocuments,
  addAuditLog,
} from '@/lib/storage';
import {
  Users,
  ScanText,
  CheckSquare,
  FileSpreadsheet,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Upload,
  Download,
  Edit3,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { exportStudentAbsenceExcel } from '../export';

export const StudentWorkspace: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'students' | 'ocr' | 'verify' | 'export'>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [documents, setDocuments] = useState<OCRDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [uploadResultDoc, setUploadResultDoc] = useState<OCRDocument | null>(null);

  useEffect(() => {
    const stds = getStoredStudents();
    const docs = getStoredDocuments();
    setStudents(stds);
    setDocuments(docs);
    if (docs.length > 0) setSelectedDocId(docs[0].id);
  }, []);

  const filteredStudents = students.filter(
    (s) =>
      !searchTerm ||
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.nisn.includes(searchTerm) ||
      s.class.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentDoc = documents.find((d) => d.id === selectedDocId);

  const handleVerifyItem = (itemId: string) => {
    if (!currentDoc) return;
    const updatedDocs = documents.map((doc) => {
      if (doc.id === currentDoc.id) {
        const updatedItems = doc.items.map((item) =>
          item.id === itemId ? { ...item, verificationStatus: 'verified' as const } : item
        );
        const verifiedCount = updatedItems.filter(
          (i) => i.verificationStatus === 'verified' || i.verificationStatus === 'edited'
        ).length;
        const allVerified = verifiedCount === doc.extractedCount;

        return {
          ...doc,
          items: updatedItems,
          verifiedCount,
          status: allVerified ? ('completed' as const) : ('needs_verification' as const),
          workflowState: allVerified ? ('VERIFIED' as const) : ('NEEDS_VERIFICATION' as const),
        };
      }
      return doc;
    });

    setDocuments(updatedDocs);
    saveDocuments(updatedDocs);
    addAuditLog('Operator Workspace', 'VERIFY_ITEM', itemId, 'Verifikasi item ketidakhadiran siswa');
  };

  const handleSimulateOCRUpload = () => {
    const newDoc: OCRDocument = {
      id: `doc-ocr-${Date.now()}`,
      fileName: `Surat_Izin_Ketidakhadiran_${Date.now().toString().slice(-4)}.png`,
      fileSize: 1024 * 520,
      uploadedAt: new Date().toISOString(),
      imageUrl: '/placeholder-doc.png',
      status: 'needs_verification',
      workflowState: 'NEEDS_VERIFICATION',
      extractedCount: 2,
      verifiedCount: 0,
      items: [
        {
          id: `item-${Date.now()}-1`,
          ocrText: 'Citra Dewi - X IPA 1 - Sakit flu berat',
          matchedStudentId: 'std-3',
          matchedStudentName: 'Citra Dewi',
          matchedNisn: '0051234569',
          confidence: 92,
          class: 'X IPA 1',
          date: new Date().toISOString().slice(0, 10),
          status: 'Sakit',
          notes: 'Flu dan demam 2 hari',
          verificationStatus: 'pending',
        },
        {
          id: `item-${Date.now()}-2`,
          ocrText: 'Dewi L - X IPA 2 - Izin acara',
          matchedStudentId: 'std-4',
          matchedStudentName: 'Dewi Lestari',
          matchedNisn: '0051234570',
          confidence: 68,
          class: 'X IPA 2',
          date: new Date().toISOString().slice(0, 10),
          status: 'Izin',
          notes: 'Izin urusan keluarga',
          verificationStatus: 'pending',
        },
      ],
    };

    const updated = [newDoc, ...documents];
    setDocuments(updated);
    saveDocuments(updated);
    setSelectedDocId(newDoc.id);
    setUploadResultDoc(newDoc);
    addAuditLog('Operator Workspace', 'UPLOAD_OCR', newDoc.id, `Mengunggah dokumen OCR ${newDoc.fileName}`);
  };

  const handleExportExcel = () => {
    const success = exportStudentAbsenceExcel('Semua');
    if (!success) {
      alert('Tidak ada data terverifikasi untuk diekspor. Selesaikan verifikasi manual terlebih dahulu.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-semibold mb-2">
            <Users className="w-3.5 h-3.5" />
            <span>Student Administration Domain Module</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Unified Student Workspace</h1>
          <p className="text-xs text-slate-400 mt-1">
            Pengelolaan Master Data Siswa (Dapodik), Ekstraksi OCR Dokumen Izin/Sakit, dan Antrean Verifikasi Ketidakhadiran.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleSimulateOCRUpload}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow flex items-center space-x-2 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Upload OCR Baru</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl px-4 pt-2 space-x-2 shadow-sm">
        <button
          onClick={() => setActiveSubTab('students')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-2 transition-all ${
            activeSubTab === 'students'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Master Data Siswa ({students.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('verify')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-2 transition-all relative ${
            activeSubTab === 'verify'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Antrean Verifikasi OCR</span>
          {documents.some((d) => d.status === 'needs_verification') && (
            <span className="bg-amber-500 text-slate-950 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              !
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('ocr')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-2 transition-all ${
            activeSubTab === 'ocr'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ScanText className="w-4 h-4" />
          <span>Dokumen OCR ({documents.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('export')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-2 transition-all ${
            activeSubTab === 'export'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Rekap Excel</span>
        </button>
      </div>

      {/* SUB-TAB 1: MASTER DATA SISWA */}
      {activeSubTab === 'students' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center">
            <div className="relative w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Cari Nama, NISN, Kelas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-9 pr-4 py-2 rounded-lg text-xs text-slate-900 dark:text-white"
              />
            </div>
            <span className="text-xs text-slate-500">
              Menampilkan {filteredStudents.length} siswa terdaftar di Dapodik
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-500 uppercase">
                <tr>
                  <th className="py-3 px-4">No</th>
                  <th className="py-3 px-4">NISN / NIS</th>
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4">Jenis Kelamin</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredStudents.map((std, idx) => (
                  <tr key={std.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {std.nisn} <span className="text-slate-400 font-normal">({std.nis || '-'})</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{std.name}</td>
                    <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">{std.class}</td>
                    <td className="py-3 px-4">{std.gender === 'L' ? 'Laki-Laki' : 'Perempuan'}</td>
                    <td className="py-3 px-4">
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded">
                        {std.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: ANTREAN VERIFIKASI OCR */}
      {activeSubTab === 'verify' && (
        <div className="space-y-4">
          {currentDoc ? (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    {currentDoc.fileName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Status: <span className="font-bold text-amber-600">{currentDoc.status}</span> | Terverifikasi: {currentDoc.verifiedCount}/{currentDoc.extractedCount} item
                  </p>
                </div>

                {documents.length > 1 && (
                  <select
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  >
                    {documents.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fileName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-3">
                {currentDoc.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {idx + 1}. {item.matchedStudentName || item.ocrText}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            item.confidence >= 70
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          Akurasi OCR: {item.confidence}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Kelas: {item.class} | Status: <span className="font-bold text-blue-600">{item.status}</span> | Catatan: {item.notes || '-'}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      {item.verificationStatus !== 'verified' ? (
                        <button
                          onClick={() => handleVerifyItem(item.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold shadow flex items-center space-x-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Verifikasi Manual ✓</span>
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                          Terverifikasi ✓
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-8">Belum ada dokumen OCR terdaftar.</p>
          )}
        </div>
      )}

      {/* SUB-TAB 3: DOKUMEN OCR LIST */}
      {activeSubTab === 'ocr' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-500 uppercase">
              <tr>
                <th className="py-3 px-4">Nama File</th>
                <th className="py-3 px-4">Tanggal Upload</th>
                <th className="py-3 px-4">Ekstraksi</th>
                <th className="py-3 px-4">Terverifikasi</th>
                <th className="py-3 px-4">Status Workflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {documents.map((d) => (
                <tr
                  key={d.id}
                  className={`hover:bg-slate-50 ${selectedDocId === d.id ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                >
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <span>{d.fileName}</span>
                    {selectedDocId === d.id && (
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Dipilih</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">
                    {new Date(d.uploadedAt).toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-4 font-bold text-blue-600">{d.extractedCount} item</td>
                  <td className="py-3 px-4 font-bold text-emerald-600">{d.verifiedCount} item</td>
                  <td className="py-3 px-4">
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded">
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SUB-TAB 4: EXPORT REKAP EXCEL */}
      {activeSubTab === 'export' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 max-w-xl mx-auto text-center">
          <FileSpreadsheet className="w-12 h-12 text-emerald-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Export Rekap Ketidakhadiran Siswa (.xlsx)
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Unduh seluruh data hasil verifikasi ketidakhadiran siswa dalam format file Excel Spreadsheet resmi.
          </p>

          <button
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-lg text-xs font-bold shadow-lg flex items-center space-x-2 mx-auto transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download Rekap Excel</span>
          </button>
        </div>
      )}

      {/* Processing Result Modal */}
      {uploadResultDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center space-x-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Dokumen Berhasil Diproses</h3>
                <p className="text-xs text-slate-400 font-mono">{uploadResultDoc.fileName}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Hasil Ekstraksi OCR:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {uploadResultDoc.extractedCount} Item Ditemukan
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Perlu Verifikasi:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {uploadResultDoc.extractedCount - uploadResultDoc.verifiedCount} Item
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status Dokumen:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {uploadResultDoc.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  setSelectedDocId(uploadResultDoc.id);
                  setActiveSubTab('verify');
                  setUploadResultDoc(null);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2.5 rounded-lg font-bold shadow flex items-center justify-center space-x-2"
              >
                <CheckSquare className="w-4 h-4" />
                <span>Verifikasi Sekarang</span>
              </button>

              <button
                onClick={() => {
                  setSelectedDocId(uploadResultDoc.id);
                  setActiveSubTab('ocr');
                  setUploadResultDoc(null);
                }}
                className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs py-2.5 rounded-lg font-bold flex items-center justify-center space-x-2"
              >
                <ScanText className="w-4 h-4" />
                <span>Lihat Dokumen OCR</span>
              </button>

              <button
                onClick={() => setUploadResultDoc(null)}
                className="w-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs py-1.5 font-medium text-center"
              >
                Kembali
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
