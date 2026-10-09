'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export type FeedbackType = 'success' | 'error' | 'warning';

export type FeedbackState = {
  type: FeedbackType;
  title: string;
  message: string;
} | null;

export function FeedbackModal({
  feedback,
  onClose,
}: {
  feedback: FeedbackState;
  onClose: () => void;
}) {
  if (!feedback) return null;

  const isSuccess = feedback.type === 'success';
  const isWarning = feedback.type === 'warning';

  const iconClass = isSuccess
    ? 'bg-blue-50 text-blue-600 border-blue-100'
    : isWarning
      ? 'bg-amber-50 text-amber-600 border-amber-100'
      : 'bg-red-50 text-red-600 border-red-100';

  const Icon = isSuccess ? CheckCircle2 : AlertCircle;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl font-sans"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${iconClass}`}>
              <Icon className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <h3
                id="feedback-modal-title"
                className="text-base font-bold tracking-tight text-slate-900"
              >
                {feedback.title}
              </h3>

              <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-slate-600">
                {feedback.message}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
