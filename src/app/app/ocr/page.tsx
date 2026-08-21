'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Upload, 
  ScanText, 
  FileText, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import { getStoredStudents, getStoredDocuments, saveDocuments, addAuditLog } from '@/lib/storage';
import { findBestStudentMatch } from '@/lib/fuzzy';
import { OCRDocument, ExtractedItem, AbsenceStatus } from '@/types/sms';

export default function OCRUploadPage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedResult, setExtractedResult] = useState<OCRDocument | null>(null);

  // Preset sample attendance sheets for easy 1-click testing
  const samplePresets = [
    {
      name: 'Daftar_Hadir_Kelas_9B_Agustus.jpg',
      url: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80',
      sampleNames: ['Dini Supriyatin', 'Eko Prasetya', 'Fikry Haikal', 'Gita Gutawaa'],
      class: '9B',
    },
    {
      name: 'Formulir_Izin_Kelas_9C.png',
      url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=800&q=80',
      sampleNames: ['Hendra Setiawann', 'Indah Kusumah'],
      class: '9C',
    }
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setExtractedResult(null);
    }
  };

  const handleSelectPreset = (preset: typeof samplePresets[0]) => {
    setPreviewUrl(preset.url);
    setSelectedFile(new File(['sample'], preset.name, { type: 'image/jpeg' }));
    setExtractedResult(null);
  };

  const processOCR = () => {
    if (!previewUrl) return;
    setIsProcessing(true);

    setTimeout(() => {
      const masterStudents = getStoredStudents();
      
      // Determine sample names to extract
      const rawNames = selectedFile?.name.includes('9C') 
        ? ['Hendra Setiawann', 'Indah Kusumah']
        : ['Dini Supriyatin', 'Eko Prasetya', 'Fikri Haekal', 'Gita Gutawaa'];

      const statuses: AbsenceStatus[] = ['Sakit', 'Izin', 'Alpha', 'Sakit'];
      const notesList = [
        'Demam berdarah',
        'Acara keluarga ke luar kota',
        'Tanpa keterangan wali kelas',
        'Lomba paduan suara'
      ];

      const extractedItems: ExtractedItem[] = rawNames.map((ocrName, idx) => {
        const match = findBestStudentMatch(ocrName, masterStudents);
        return {
          id: `item-${Date.now()}-${idx}`,
          ocrText: ocrName,
          matchedStudentId: match.student?.id,
          matchedStudentName: match.student?.name,
          matchedNisn: match.student?.nisn,
          confidence: match.confidence,
          class: match.student?.class || '9B',
          date: new Date().toISOString().split('T')[0],
          status: statuses[idx % statuses.length],
          notes: notesList[idx % notesList.length],
          verificationStatus: 'pending',
        };
      });

      const newDoc: OCRDocument = {
        id: `doc-${Date.now()}`,
        fileName: selectedFile?.name || 'Scan_Daftar_Hadir.jpg',
        fileSize: selectedFile?.size || 1250000,
        uploadedAt: new Date().toISOString(),
        imageUrl: previewUrl,
        status: 'needs_verification',
        extractedCount: extractedItems.length,
        verifiedCount: 0,
        items: extractedItems,
      };

      const existingDocs = getStoredDocuments();
      const updatedDocs = [newDoc, ...existingDocs];
      saveDocuments(updatedDocs);

      addAuditLog(
        'Operator TU - Budi',
        'PROCESS_OCR',
        newDoc.fileName,
        `Mengekstraksi ${extractedItems.length} baris data dan mencocokkan dengan Master Siswa.`
      );

      setExtractedResult(newDoc);
      setIsProcessing(false);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="border-b border-white/10 pb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Upload &amp; OCR Dokumen Sekolah</h1>
        <p className="text-xs text-slate-400 mt-1">
          Unggah scan/foto daftar ketidakhadiran fisik. Mesin OCR SMS akan membaca teks &amp; mencocokkan siswa secara otomatis.
        </p>
      </div>

      {/* Main Upload / Preset Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Upload Box */}
        <div className="panel p-6 rounded-xl border border-white/10 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Upload className="h-4 w-4 text-sky-400" />
            <span>Unggah Dokumen (Foto / Scan / PDF)</span>
          </h3>

          <label className="border-2 border-dashed border-white/15 hover:border-sky-400 bg-slate-900/60 p-8 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all text-center">
            <ScanText className="h-10 w-10 text-sky-400 mb-3 animate-pulse" />
            <span className="text-xs font-semibold text-white">Klik untuk pilih file atau seret ke sini</span>
            <span className="text-[11px] text-slate-400 mt-1">Mendukung JPG, PNG, WEBP, PDF (Maks 10MB)</span>
            <input type="file" accept="image/*, application/pdf" onChange={handleFileChange} className="hidden" />
          </label>

          {/* Quick Presets */}
          <div className="pt-2">
            <span className="text-[11px] font-mono text-slate-400 block mb-2">Atau gunakan Contoh Sampel Dokumen:</span>
            <div className="grid grid-cols-2 gap-2">
              {samplePresets.map((preset, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectPreset(preset)}
                  className="flex items-center gap-2 p-2.5 bg-slate-900 hover:bg-slate-800 border border-white/10 rounded text-left transition-colors"
                >
                  <ImageIcon className="h-4 w-4 text-sky-400 shrink-0" />
                  <div className="truncate">
                    <div className="text-[11px] font-semibold text-white truncate">{preset.name}</div>
                    <div className="text-[10px] text-slate-400">Kelas {preset.class}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview & Action Box */}
        <div className="panel p-6 rounded-xl border border-white/10 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-cyan-400" />
              <span>Preview Dokumen &amp; Pemrosesan</span>
            </h3>

            {previewUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-white/15 bg-black h-56 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Preview" className="max-h-full object-contain" />
              </div>
            ) : (
              <div className="h-56 rounded-lg border border-dashed border-white/10 bg-slate-900/40 flex items-center justify-center text-slate-500 text-xs font-mono">
                Pilih atau unggah file untuk melihat preview
              </div>
            )}
          </div>

          <div className="pt-4">
            <button
              disabled={!previewUrl || isProcessing}
              onClick={processOCR}
              className="w-full flex items-center justify-center gap-2 py-3 bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-slate-950 text-xs font-bold rounded shadow-lg shadow-sky-500/20 transition-all"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-slate-950" />
                  <span>Mengekstraksi Teks &amp; Fuzzy Matching...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Jalankan OCR &amp; Ekstraksi Data</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Extraction Results Preview */}
      {extractedResult && (
        <div className="panel p-6 rounded-xl border border-emerald-500/30 bg-emerald-950/10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Ekstraksi OCR Berhasil!</h3>
                <p className="text-xs text-slate-400">
                  Ditemukan {extractedResult.extractedCount} baris nama siswa dengan hasil matching otomatis.
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push('/app/verify')}
              className="flex items-center gap-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 px-4 py-2 text-xs font-bold rounded shadow-md shadow-emerald-500/20 transition-all"
            >
              <span>Buka Antarmuka Verifikasi</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 font-mono text-[11px] uppercase">
                <tr>
                  <th className="p-3">Teks Asli OCR</th>
                  <th className="p-3">Hasil Match Master Data</th>
                  <th className="p-3">NISN</th>
                  <th className="p-3">Skor Confidence</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {extractedResult.items.map((item) => (
                  <tr key={item.id}>
                    <td className="p-3 text-slate-300">{item.ocrText}</td>
                    <td className="p-3 font-semibold text-white">{item.matchedStudentName || '—'}</td>
                    <td className="p-3 text-slate-400">{item.matchedNisn || '—'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        item.confidence >= 85 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : item.confidence >= 70
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {item.confidence}% Match
                      </span>
                    </td>
                    <td className="p-3 text-sky-400">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
