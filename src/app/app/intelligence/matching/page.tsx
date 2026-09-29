'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import {
  getMatchingResultAction,
  confirmMatchingCandidateAction,
  rejectMatchingCandidatesAction,
} from '@/platform/actions/match-document-data';
import type {
  MatchingResultWithCandidatesDTO,
  MatchingCandidateDTO,
} from '@/platform/types/matching';
import { AlertCircle, CheckCircle2, XCircle, ChevronUp, Loader2 } from 'lucide-react';

interface MatchingPageProps {
  searchParams: {
    resultId?: string;
  };
}

export default function MatchingConfirmationPage({ searchParams }: MatchingPageProps) {
  const resultId = searchParams.resultId;
  const [result, setResult] = useState<MatchingResultWithCandidatesDTO | null | undefined>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load matching result
  const handleLoadResult = async () => {
    if (!resultId) {
      setError('No matching result ID provided.');
      return;
    }

    setLoading(true);
    setError(null);

    const response = await getMatchingResultAction(resultId);
    setLoading(false);

    if (!response.success) {
      setError(response.error?.message || 'Failed to load matching result.');
      return;
    }

    setResult(response.data);
    setSelectedCandidateId(null);
  };

  // Confirm candidate action
  const [confirmState, confirmAction, confirmPending] = useActionState(
    async (_: any, formData: FormData) => {
      const matchingResultId = formData.get('matchingResultId') as string;
      const candidateId = formData.get('candidateId') as string;

      const response = await confirmMatchingCandidateAction({
        matchingResultId,
        candidateId,
      });

      if (response.success) {
        // Reload result
        const reloadResponse = await getMatchingResultAction(matchingResultId);
        if (reloadResponse.success) {
          setResult(reloadResponse.data);
          setSelectedCandidateId(null);
        }
      }

      return response;
    },
    null
  );

  // Reject all candidates action
  const [rejectState, rejectAction, rejectPending] = useActionState(
    async (_: any, formData: FormData) => {
      const matchingResultId = formData.get('matchingResultId') as string;

      const response = await rejectMatchingCandidatesAction({
        matchingResultId,
      });

      if (response.success) {
        // Reload result
        const reloadResponse = await getMatchingResultAction(matchingResultId);
        if (reloadResponse.success) {
          setResult(reloadResponse.data);
          setSelectedCandidateId(null);
        }
      }

      return response;
    },
    null
  );

  // If no result loaded yet, show load interface
  if (!result) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
              Kecerdasan Dokumen
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">Pencocokan Data</span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Pencocokan Data
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Tinjau hasil pencocokan identitas dan konfirmasi kandidat yang cocok.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-8 space-y-4 shadow-xs">
          <p className="text-sm text-slate-600">
            {resultId ? 'Muat hasil pencocokan untuk ditinjau:' : 'Tidak ada ID hasil pencocokan yang diberikan.'}
          </p>
          {resultId && (
            <button
              onClick={handleLoadResult}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Muat Hasil
            </button>
          )}
        </div>
      </div>
    );
  }

  // Determine status display
  const statusDisplay = {
    COCOK: {
      label: 'Cocok',
      color: 'green',
      icon: CheckCircle2,
    },
    PERLU_DIPERIKSA: {
      label: 'Perlu Diperiksa',
      color: 'amber',
      icon: AlertCircle,
    },
    TIDAK_DITEMUKAN: {
      label: 'Tidak Ditemukan',
      color: 'red',
      icon: XCircle,
    },
  };

  const statusConfig = statusDisplay[result.status as keyof typeof statusDisplay];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Kecerdasan Dokumen
          </span>
          <span className="text-xs text-slate-400">•</span>
          <span className="text-xs text-slate-500 font-medium">Pencocokan Data</span>
        </div>
        <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Pencocokan Data
        </h1>
      </div>

      {/* Extraction Info Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Informasi Ekstraksi</h2>
          <p className="mt-1 text-xs text-slate-600">Data yang diekstrak dari dokumen</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <label className="text-xs font-semibold text-slate-700">Field</label>
            <p className="mt-1 text-slate-900">{result.extractionResultId}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Nilai Ekstraksi</label>
            <p className="mt-1 text-slate-900 font-mono">{result.extractedValue}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm pt-2 border-t border-slate-200">
          <div>
            <label className="text-xs font-semibold text-slate-700">Status</label>
            <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-900">
              <StatusIcon className={`h-4 w-4 text-${statusConfig.color}-600`} />
              <span className="text-xs font-semibold">{statusConfig.label}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Keyakinan</label>
            <p className="mt-1 text-slate-900 font-semibold">
              {result.confidenceScore !== null ? `${result.confidenceScore}%` : 'N/A'}
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Alasan</label>
            <p className="mt-1 text-xs text-slate-700 line-clamp-2">
              {result.matchingReason || '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Candidates Section */}
      {result.candidates && result.candidates.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Kandidat</h2>
            <p className="mt-1 text-xs text-slate-600">
              {result.candidates.length === 1
                ? 'Satu kandidat cocok'
                : `${result.candidates.length} kandidat ditemukan`}
            </p>
          </div>

          <div className="space-y-3">
            {result.candidates.map((candidate, idx) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                index={idx}
                isSelected={selectedCandidateId === candidate.id}
                onSelect={() => setSelectedCandidateId(candidate.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty Candidates */}
      {(!result.candidates || result.candidates.length === 0) && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <XCircle className="h-8 w-8 text-slate-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-900">Tidak Ditemukan</p>
          <p className="mt-1 text-xs text-slate-600">Tidak ada kandidat yang cocok untuk nilai ini.</p>
        </div>
      )}

      {/* Manual Confirmation Status */}
      {result.manuallyConfirmed && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="text-sm font-semibold text-green-900">Keputusan Final</span>
          </div>
          <p className="text-sm text-green-800">
            Keputusan pencocokan telah dikonfirmasi secara manual dan tidak dapat diubah.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      {!result.manuallyConfirmed && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Tindakan</h3>

          {(confirmState as any)?.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {(confirmState as any).error.message}
            </div>
          )}

          {(rejectState as any)?.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {(rejectState as any).error.message}
            </div>
          )}

          <div className="flex gap-3">
            {/* Confirm Button */}
            <form action={confirmAction} className="flex-1">
              <input type="hidden" name="matchingResultId" value={result.id} />
              <input type="hidden" name="candidateId" value={selectedCandidateId || ''} />

              <button
                type="submit"
                disabled={!selectedCandidateId || confirmPending || rejectPending}
                className="w-full px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
              >
                {confirmPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Konfirmasi
              </button>
            </form>

            {/* Reject Button */}
            <form action={rejectAction} className="flex-1">
              <input type="hidden" name="matchingResultId" value={result.id} />

              <button
                type="submit"
                disabled={rejectPending || confirmPending}
                className="w-full px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
              >
                {rejectPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Tidak Ada yang Cocok
              </button>
            </form>
          </div>

          {selectedCandidateId ? (
            <p className="text-xs text-slate-600 text-center">
              Pilihan: Kandidat dipilih. Klik "Konfirmasi" untuk menyimpan keputusan.
            </p>
          ) : (
            <p className="text-xs text-slate-600 text-center">
              Pilih kandidat terlebih dahulu sebelum mengonfirmasi, atau klik "Tidak Ada yang Cocok".
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * CandidateCard — Display a single matching candidate
 */
function CandidateCard({
  candidate,
  index,
  isSelected,
  onSelect,
}: {
  candidate: MatchingCandidateDTO;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isStudent = candidate.entityType === 'STUDENT';
  const info = candidate.candidateInfo as any;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="space-y-3">
        {/* Ranking and Score */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-200 text-slate-900 font-bold text-xs">
              {candidate.ranking}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{info.fullName}</p>
              <p className="text-xs text-slate-600">{candidate.entityType === 'STUDENT' ? 'Siswa' : 'Guru & Karyawan'}</p>
            </div>
          </div>
          {candidate.candidateScore !== null && (
            <div className="text-right">
              <p className="text-lg font-bold text-slate-900">{candidate.candidateScore}</p>
              <p className="text-xs text-slate-600">skor</p>
            </div>
          )}
        </div>

        {/* Entity Details */}
        <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-xs">
          {isStudent ? (
            <>
              <div className="flex justify-between">
                <span className="text-slate-600">NISN:</span>
                <span className="font-mono font-semibold text-slate-900">{info.nisn}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">NIS:</span>
                <span className="font-mono font-semibold text-slate-900">{info.nis}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Kelas:</span>
                <span className="font-semibold text-slate-900">{info.className}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between">
                <span className="text-slate-600">NIP:</span>
                <span className="font-mono font-semibold text-slate-900">{info.nip || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">NIK:</span>
                <span className="font-mono font-semibold text-slate-900">{info.nik || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Jabatan:</span>
                <span className="font-semibold text-slate-900 text-right">{info.jabatan}</span>
              </div>
            </>
          )}
        </div>

        {/* Matching Reason */}
        {candidate.candidateReason && (
          <p className="text-xs text-slate-600 italic">"{candidate.candidateReason}"</p>
        )}

        {/* Field */}
        <p className="text-xs text-slate-500">Dicocokan berdasarkan: <span className="font-mono font-semibold">{candidate.matchedField}</span></p>
      </div>
    </button>
  );
}
