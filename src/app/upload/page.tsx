'use client';
// src/app/upload/page.tsx
import React from 'react';
import { useActionState } from 'react';
import { uploadDocumentIntakeAction } from '@/platform/actions/document';
import type { ActionResponse } from '@/platform/types';
import type { DocumentRecordDTO } from '@/platform/types/document';

async function uploadDocumentAction(prevState: ActionResponse<DocumentRecordDTO> | null, formData: FormData) {
  return await uploadDocumentIntakeAction(formData);
}

export default function UploadPage() {
  const [state, action] = useActionState<ActionResponse<DocumentRecordDTO> | null, FormData>(
    uploadDocumentAction,
    null,
  );

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 p-4 dark:bg-gradient-to-br dark:from-gray-800 dark:via-gray-900 dark:to-black">
      <section className="w-full max-w-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg rounded-2xl shadow-xl p-8 space-y-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 text-center">
          Unggah Dokumen
        </h1>
        {state && (
          <div
            className={`p-4 rounded-md ${
              state.success ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {state.success
              ? `Dokumen berhasil diunggah (ID: ${state.data?.id})`
              : `Gagal: ${state.error?.message || 'Kesalahan tidak diketahui'}`}
          </div>
        )}
        <form action={action} encType="multipart/form-data" method="post" className="space-y-4">
          <div>
            <label htmlFor="file" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Berkas Dokumen
            </label>
            <input
              type="file"
              name="file"
              id="file"
              required
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
            />
          </div>
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Kategori Dokumen
            </label>
            <select
              name="category"
              id="category"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="LAINNYA">Lainnya</option>
            </select>
          </div>
          <div className="flex items-center">
            <input type="checkbox" name="isTemporary" id="isTemporary" value="true" className="h-4 w-4 text-indigo-600 border-gray-300 rounded" />
            <label htmlFor="isTemporary" className="ml-2 block text-sm text-gray-900 dark:text-gray-200">
              Sementara (tidak dipertahankan dalam arsip)
            </label>
          </div>
          <button
            type="submit"
            className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow-md transition-colors"
          >
            Unggah
          </button>
        </form>
      </section>
    </main>
  );
}
