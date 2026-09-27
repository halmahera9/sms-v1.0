'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  Check,
  CheckCircle2,
  FileText,
  UserCheck,
  FileSpreadsheet
} from 'lucide-react';
import {
  getOCRDocumentsAction,
  verifyExtractedItemAction,
} from '@/platform/actions/student-workflow';
import type {
  OCRDocumentDTO,
} from '@/platform/actions/student-workflow';

function isSuccessfulOCRResult(
  result: Awaited<ReturnType<typeof getOCRDocumentsAction>>
): result is { success: true; data: OCRDocumentDTO[] } {
  return result.success && Array.isArray(result.data);
}

export default function VerificationPage() {
  const [documents, setDocuments] = useState<OCRDocumentDTO[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    async function loadDocuments() {
      const result = await getOCRDocumentsAction();

      if (!mounted || !result.success || !Array.isArray(result.data)) return;

      const data = result.data;

      setDocuments(data);

      if (data.length > 0) {
        setSelectedDocId(data[0].id);
      }
    }

    void loadDocuments();

    return () => {
      mounted = false;
    };
  }, []);

  const currentDoc = documents.find((d) => d.id === selectedDocId);

  const handleVerifyItem = async (itemId: string) => {
    const result = await verifyExtractedItemAction({
      itemId,
      decision: 'PASSED',
    });

    if (!result.success) {
      console.error(result.error);
      return;
    }

    const refreshed = await getOCRDocumentsAction();

    if (isSuccessfulOCRResult(refreshed)) {
      setDocuments(refreshed.data);
    }
  };



  const handleVerifyAll = async () => {
    if (!currentDoc) return;

    for (const item of currentDoc.items) {
      if (item.verificationStatus !== 'verified') {
        const result = await verifyExtractedItemAction({
          itemId: item.id,
          decision: 'PASSED',
        });

        if (!result.success) {
          console.error(result.error);
          return;
        }
      }
    }

    const refreshed = await getOCRDocumentsAction();

    if (isSuccessfulOCRResult(refreshed)) {
      setDocuments(refreshed.data);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Antarmuka Verifikasi Operator</h1>
          <p className="text-xs text-slate-600 mt-1">
            Modul Human-in-the-Loop: Operator meninjau, mengoreksi, dan mengonfirmasi hasil pencocokan OCR.
          </p>
        </div>

        {currentDoc && (
          <div className="flex gap-2">
            <button
              onClick={handleVerifyAll}
              className="flex items-center gap-2 bg-emerald-400 hover:bg-emerald-300 text-white px-4 py-2 text-xs font-bold rounded shadow-md shadow-emerald-500/20 transition-all"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Verifikasi Semua Data Selesai</span>
            </button>
          </div>
        )}
      </div>

      {/* Document Selector Header */}
      {documents.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <FileText className="h-5 w-5 text-blue-600" />
            <span className="text-xs font-mono text-slate-600">Pilih Dokumen:</span>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="bg-white border border-slate-200 px-3 py-1.5 text-xs text-slate-900 rounded outline-none focus:border-blue-600"
            >
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.fileName} ({doc.verifiedCount}/{doc.extractedCount} Selesai)
                </option>
              ))}
            </select>
          </div>

          {currentDoc && (
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-slate-600">Status Dokumen:</span>
              <span className={`px-2.5 py-0.5 rounded ${
                currentDoc.status === 'completed'
                  ? 'bg-blue-600/20 text-slate-900 border border-slate-200'
                  : 'bg-blue-500/20 text-slate-900 border border-slate-200'
              }`}>
                {currentDoc.status === 'completed' ? 'SELESAI TERVERIFIKASI' : 'PERLU VERIFIKASI'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main Split View: Image Viewer vs Verification Table */}
      {!currentDoc ? (
        <div className="bg-white shadow-sm p-12 rounded-xl border border-slate-200 text-center space-y-3">
          <CheckSquare className="h-10 w-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-900">Belum Ada Dokumen Untuk Diverifikasi</p>
          <p className="text-xs text-slate-600 max-w-sm mx-auto">
            Unggah dokumen scan/foto daftar hadir kelas terlebih dahulu di menu Upload &amp; OCR.
          </p>
          <Link
            href="/app/ocr"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 text-xs font-bold rounded mt-2 hover:bg-blue-700"
          >
            Unggah Dokumen Baru
          </Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_1.8fr] gap-6">
          {/* Left: Document Image Viewer */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-700 uppercase">File Fisik Original</span>
              <span className="text-[11px] font-mono text-blue-600">{currentDoc.fileName}</span>
            </div>
            <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-white flex-1 min-h-[300px] flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={currentDoc.imageUrl} alt="Document" className="max-h-full object-contain" />
            </div>
          </div>

          {/* Right: Verification Items List */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-blue-600" />
                <span>Hasil Ekstraksi &amp; Matching Siswa ({currentDoc.items.length} Item)</span>
              </h3>

              <Link
                href="/app/export"
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Ekspor ke Excel</span>
              </Link>
            </div>

            <div className="space-y-3">
              {currentDoc.items.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition-all ${
                    item.verificationStatus === 'verified' || item.verificationStatus === 'edited'
                      ? 'bg-slate-50 border-slate-200'
                      : item.confidence >= 85
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-amber-950/20 border-slate-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Item Details */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-600">OCR Teks:</span>
                        <span className="text-xs font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          &ldquo;{item.ocrText}&rdquo;
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-sm font-bold text-slate-900">
                          {item.matchedStudentName || 'Tidak Teridentifikasi'}
                        </span>
                        {item.matchedNisn && (
                          <span className="text-xs text-slate-600 font-mono">({item.matchedNisn})</span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-blue-600/10 text-blue-600 font-mono text-[10px]">
                          Kelas {item.class}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-600 pt-1">
                        <span className="font-semibold text-slate-900 font-mono">Absen: {item.status}</span>
                        <span>•</span>
                        <span className="truncate max-w-xs">&ldquo;{item.notes}&rdquo;</span>
                      </div>
                    </div>

                    {/* Confidence & Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className={`inline-block px-2.5 py-1 rounded text-xs font-mono font-bold ${
                          item.confidence >= 85
                            ? 'bg-blue-600/20 text-slate-900 border border-slate-200'
                            : item.confidence >= 70
                            ? 'bg-blue-500/20 text-slate-900 border border-slate-200'
                            : 'bg-blue-600/20 text-slate-900 border border-blue-200'
                        }`}>
                          {item.confidence}% Match
                        </span>
                      </div>

                      {item.verificationStatus === 'verified' || item.verificationStatus === 'edited' ? (
                        <div className="flex items-center gap-1 text-blue-600 text-xs font-mono font-semibold bg-blue-600/10 px-3 py-1.5 rounded border border-blue-600/20">
                          <Check className="h-4 w-4" />
                          <span>Terverifikasi</span>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleVerifyItem(item.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-white font-bold text-xs rounded shadow-sm shadow-emerald-500/20 transition-all"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Konfirmasi</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>


                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
