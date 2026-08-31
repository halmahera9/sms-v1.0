import React from 'react';
import { Metadata } from 'next';
import { validatePublicUploadInvitationToken } from '@/domains/document/invitation/actions';
import { PublicInvitationErrorCode } from '@/domains/document/invitation/types';

export const metadata: Metadata = {
  title: 'Unggah Dokumen Publik - BANYUBIRU',
  description: 'Portal Pengunggahan Dokumen Publik Terverifikasi BANYUBIRU',
};

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

function getErrorHeading(code?: PublicInvitationErrorCode): string {
  switch (code) {
    case 'EXPIRED':
      return 'Undangan Kedaluwarsa';
    case 'ALREADY_SUBMITTED':
      return 'Dokumen Sudah Diunggah';
    case 'REVOKED':
      return 'Undangan Dibatalkan';
    case 'MAX_ATTEMPTS_EXCEEDED':
      return 'Batas Percobaan Habis';
    case 'NOT_FOUND':
    default:
      return 'Undangan Tidak Ditemukan';
  }
}

function formatCategory(category: string): string {
  return category
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return isoString;
  }
}

export default async function PublicUploadPage({ params }: PageProps) {
  const { token } = await params;
  const result = await validatePublicUploadInvitationToken(token);

  if (!result.isValid || !result.invitation) {
    const errorHeading = getErrorHeading(result.errorCode);
    const errorMessage =
      result.errorMessage ||
      'Tautan undangan tidak valid atau sudah tidak dapat digunakan.';

    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mb-4 font-bold text-xl">
            !
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
            {errorHeading}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            {errorMessage}
          </p>
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            Jika Anda merasa ini adalah kesalahan, silakan hubungi pihak instansi yang mengirimkan tautan ini.
          </div>
        </div>
      </main>
    );
  }

  const { invitation } = result;
  const attemptsLeft = Math.max(
    0,
    invitation.maxUploadAttempts - invitation.uploadAttempts
  );

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 shadow-sm">
        {/* Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Tautan Aktif &amp; Terverifikasi
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Portal Pengunggahan Dokumen
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {invitation.recipientName
              ? `Yth. ${invitation.recipientName}, silakan periksa rincian dokumen yang diminta di bawah ini.`
              : 'Silakan periksa rincian dokumen yang diminta di bawah ini.'}
          </p>
        </div>

        {/* Invitation Summary */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 mb-6 border border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500 dark:text-slate-400">Kategori Dokumen:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {formatCategory(invitation.documentCategory)}
            </span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500 dark:text-slate-400">Batas Waktu:</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {formatDate(invitation.expiresAt)}
            </span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500 dark:text-slate-400">Sisa Kesempatan Upload:</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {attemptsLeft} dari {invitation.maxUploadAttempts} kali
            </span>
          </div>
        </div>

        {/* Informational SSR Notice */}
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 text-blue-800 dark:text-blue-300 text-xs leading-relaxed">
          Dokumen yang diunggah akan diverifikasi secara otomatis oleh sistem BANYUBIRU untuk memastikan integritas dan keaslian berkas.
        </div>
      </div>
    </main>
  );
}
