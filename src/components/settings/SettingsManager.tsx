'use client';

import React, { useState } from 'react';
import { SignatoryConfig } from '@/types/award';
import { loadSignatoryConfig, saveSignatoryConfig } from '@/lib/award-storage';
import { Settings, Save, CheckCircle2 } from 'lucide-react';

export const SettingsManager: React.FC = () => {
  const [config, setConfig] = useState<SignatoryConfig>(loadSignatoryConfig());
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSignatoryConfig(config);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <Settings className="w-6 h-6 text-indigo-600" />
          <span>Pengaturan Penandatangan & Rule Konfigurasi</span>
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Semua aturan penandatanganan dokumen dan rujukan SE dibuat dinamis agar dapat disesuaikan tanpa perlu mengubah kode sumber aplikasi.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Surat Edaran Metadata Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
            1. Referensi Formal Surat Edaran
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Nomor Surat Edaran</label>
              <input
                type="text"
                value={config.seNumber}
                onChange={(e) => setConfig({ ...config, seNumber: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Tanggal Surat Edaran</label>
              <input
                type="text"
                value={config.seDate}
                onChange={(e) => setConfig({ ...config, seDate: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                required
              />
            </div>
          </div>
        </div>

        {/* Pejabat Penandatangan Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
            2. Pejabat Penandatangan Dokumen Rekomendasi
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-3">
              <h4 className="font-bold text-blue-600 dark:text-blue-400">Kepala BKD Provinsi DKI Jakarta</h4>
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Nama Lengkap & Gelar</label>
                <input
                  type="text"
                  value={config.bkdHeadName}
                  onChange={(e) => setConfig({ ...config, bkdHeadName: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">NIP Pejabat</label>
                <input
                  type="text"
                  value={config.bkdHeadNip}
                  onChange={(e) => setConfig({ ...config, bkdHeadNip: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg text-xs font-medium font-mono text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Nomenklatur Jabatan</label>
                <input
                  type="text"
                  value={config.bkdHeadTitle}
                  onChange={(e) => setConfig({ ...config, bkdHeadTitle: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-indigo-600 dark:text-indigo-400">Pejabat Verifikasi / Pengesah</h4>
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Nama Lengkap & Gelar</label>
                <input
                  type="text"
                  value={config.officialSignatoryName}
                  onChange={(e) => setConfig({ ...config, officialSignatoryName: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">NIP Pejabat</label>
                <input
                  type="text"
                  value={config.officialSignatoryNip}
                  onChange={(e) => setConfig({ ...config, officialSignatoryNip: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg text-xs font-medium font-mono text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Nomenklatur Jabatan</label>
                <input
                  type="text"
                  value={config.officialSignatoryTitle}
                  onChange={(e) => setConfig({ ...config, officialSignatoryTitle: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          {savedSuccess ? (
            <div className="flex items-center space-x-2 text-emerald-600 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Pengaturan berhasil disimpan!</span>
            </div>
          ) : (
            <div className="text-xs text-slate-500">Pastikan NIP dan nama pejabat sesuai dengan dokumen resmi.</div>
          )}

          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-xs font-bold shadow flex items-center space-x-2 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Perubahan</span>
          </button>
        </div>
      </form>
    </div>
  );
};
