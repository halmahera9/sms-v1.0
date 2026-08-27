'use client';

import React, { useState } from 'react';
import { AwardProposal, ProposalDocument, VerificationStatus } from '@/types/award';
import { getRequirementsForType } from '@/lib/checklist-rules';
import { generateSingleProposalPDF } from '@/lib/pdf-generator';
import { loadSignatoryConfig } from '@/lib/award-storage';
import {
  uploadProposalDocumentAction,
  verifyProposalDocumentAction,
  approveProposalGenerationAction,
} from '@/domains/employee/awards/actions';
import {
  X,
  User,
  Award,
  CheckCircle,
  XCircle,
  Upload,
  AlertCircle,
  FileCheck,
  Download,
  Loader2,
} from 'lucide-react';

interface CandidateDetailModalProps {
  candidate: AwardProposal;
  userRole: 'admin' | 'verifikator' | 'pegawai';
  onClose: () => void;
  onUpdateCandidate: (updated: AwardProposal) => void;
}

export const CandidateDetailModal: React.FC<CandidateDetailModalProps> = ({
  candidate,
  userRole,
  onClose,
  onUpdateCandidate,
}) => {
  const [activeTab, setActiveTab] = useState<'checklist' | 'identitas' | 'riwayat'>('checklist');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const requirements = getRequirementsForType(candidate.jenisPenghargaan);
  const signatoryConfig = loadSignatoryConfig();

  // Helper to find document by requirement code
  const getDocForReq = (reqCode: string): ProposalDocument | undefined => {
    return candidate.documents.find((d) => d.requirementCode === reqCode);
  };

  // Upload file for a requirement via Server Action
  const handleSimulateUpload = async (reqCode: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await uploadProposalDocumentAction({
        proposalId: candidate.id,
        requirementCode: reqCode,
        fileName: `${reqCode}_${candidate.employee.nrk}.pdf`,
        fileSize: 1024 * 350,
        fileType: 'application/pdf',
      });

      if (!res.success || !res.data) {
        setErrorMessage(res.error?.message || 'Gagal mengunggah berkas.');
        return;
      }

      onUpdateCandidate(res.data);
    } catch (err: unknown) {
      setErrorMessage('Terjadi kesalahan jaringan atau server saat mengunggah berkas.');
    } finally {
      setIsLoading(false);
    }
  };

  // Verify / Reject document status via Server Action
  const handleVerifyDocument = async (reqCode: string, status: VerificationStatus, noteText?: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await verifyProposalDocumentAction({
        proposalId: candidate.id,
        requirementCode: reqCode,
        status,
        notes: noteText,
      });

      if (!res.success || !res.data) {
        setErrorMessage(res.error?.message || 'Gagal memverifikasi berkas.');
        return;
      }

      onUpdateCandidate(res.data);
    } catch (err: unknown) {
      setErrorMessage('Terjadi kesalahan jaringan atau server saat memverifikasi berkas.');
    } finally {
      setIsLoading(false);
    }
  };

  // Explicit Approve Generation via Workflow Engine
  const handleApproveGeneration = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await approveProposalGenerationAction({
        proposalId: candidate.id,
      });

      if (!res.success || !res.data) {
        setErrorMessage(res.error?.message || 'Gagal menyetujui usulan untuk generate.');
        return;
      }

      onUpdateCandidate(res.data);
    } catch (err: unknown) {
      setErrorMessage('Terjadi kesalahan jaringan atau server saat menyetujui usulan.');
    } finally {
      setIsLoading(false);
    }
  };

  // Mark all mandatory docs as verified via Server Actions (Demonstration / Batch flow)
  const handleQuickVerifyAll = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      let currentProposal = candidate;

      // 1. Ensure all mandatory documents exist and are uploaded
      for (const req of requirements) {
        const doc = currentProposal.documents.find((d) => d.requirementCode === req.code);
        if (!doc) {
          const upRes = await uploadProposalDocumentAction({
            proposalId: currentProposal.id,
            requirementCode: req.code,
            fileName: `${req.code}_${currentProposal.employee.nrk}.pdf`,
            fileSize: 1024 * 350,
            fileType: 'application/pdf',
          });
          if (upRes.success && upRes.data) {
            currentProposal = upRes.data;
          }
        }
      }

      // 2. Ensure all mandatory documents are marked verified
      for (const req of requirements) {
        const doc = currentProposal.documents.find((d) => d.requirementCode === req.code);
        if (doc && doc.verificationStatus !== 'verified') {
          const verRes = await verifyProposalDocumentAction({
            proposalId: currentProposal.id,
            requirementCode: req.code,
            status: 'verified',
            notes: 'Verifikasi berkas lengkap.',
          });
          if (verRes.success && verRes.data) {
            currentProposal = verRes.data;
          }
        }
      }

      // 3. Formally trigger approveProposalGenerationAction to let Workflow Engine transition to SIAP_GENERATE
      const appRes = await approveProposalGenerationAction({
        proposalId: currentProposal.id,
      });

      if (appRes.success && appRes.data) {
        onUpdateCandidate(appRes.data);
      } else {
        if (appRes.error) {
          setErrorMessage(appRes.error.message);
        }
        onUpdateCandidate(currentProposal);
      }
    } catch (err: unknown) {
      setErrorMessage('Terjadi kesalahan saat memproses verifikasi berkas.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/30">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>{candidate.employee.nama} {candidate.employee.gelar || ''}</span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                    candidate.jenisPenghargaan === 'MASA_KERJA'
                      ? 'bg-blue-900/60 text-blue-300 border-blue-700/50'
                      : 'bg-amber-900/60 text-amber-300 border-amber-700/50'
                  }`}
                >
                  {candidate.jenisPenghargaan === 'MASA_KERJA'
                    ? `Masa Kerja ${candidate.nilaiUsulan} Thn`
                    : `Satyalancana ${candidate.nilaiUsulan}`}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                NRK: {candidate.employee.nrk} | NIP: {candidate.employee.nip} | {candidate.employee.ukpd} ({candidate.employee.wilayah})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notification Banner */}
        {errorMessage && (
          <div className="bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-800 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-rose-700 dark:text-rose-300 text-xs font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-200 text-xs font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-5 pt-3 space-x-4">
          <button
            onClick={() => setActiveTab('checklist')}
            className={`pb-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-all ${
              activeTab === 'checklist'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Checklist Persyaratan Dokumen</span>
          </button>

          <button
            onClick={() => setActiveTab('identitas')}
            className={`pb-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-all ${
              activeTab === 'identitas'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Identitas Pegawai</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: CHECKLIST PERSYARATAN */}
          {activeTab === 'checklist' && (
            <div className="space-y-4">
              {/* Status Banner */}
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Status Usulan Penghargaan:</p>
                  <span className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2 mt-0.5">
                    <span className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold">
                      {candidate.status}
                    </span>
                    <span className="text-xs text-slate-500 font-normal">
                      {candidate.status === 'SIAP_GENERATE'
                        ? 'Semua dokumen wajib lengkap dan terverifikasi.'
                        : candidate.status === 'DIVERIFIKASI'
                        ? 'Dokumen telah diverifikasi. Siap disetujui untuk generate.'
                        : 'Lengkapi seluruh dokumen berkas wajib.'}
                    </span>
                  </span>
                </div>

                <div className="flex space-x-2">
                  {candidate.status === 'DIVERIFIKASI' && (
                    <button
                      onClick={handleApproveGeneration}
                      disabled={isLoading}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs px-3 py-2 rounded-lg font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      <span>Setujui Siap Generate</span>
                    </button>
                  )}

                  <button
                    onClick={handleQuickVerifyAll}
                    disabled={isLoading}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs px-3 py-2 rounded-lg font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    <span>Verifikasi 100% Lengkap</span>
                  </button>

                  <button
                    onClick={() => generateSingleProposalPDF(candidate, signatoryConfig)}
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs px-3 py-2 rounded-lg font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Cetak PDF</span>
                  </button>
                </div>
              </div>

              {/* Requirement Items List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Daftar Berkas Persyaratan ({candidate.jenisPenghargaan === 'MASA_KERJA' ? 'Masa Kerja' : 'Satyalancana'})
                </h4>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  {requirements.map((req, idx) => {
                    const doc = getDocForReq(req.code);
                    const isUploaded = !!doc;
                    const isVerified = doc?.verificationStatus === 'verified';
                    const isRejected = doc?.verificationStatus === 'rejected';

                    return (
                      <div
                        key={req.id}
                        className="p-4 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-start space-x-3">
                          <div className="mt-0.5">
                            {isVerified ? (
                              <CheckCircle className="w-5 h-5 text-emerald-500" />
                            ) : isRejected ? (
                              <XCircle className="w-5 h-5 text-rose-500" />
                            ) : isUploaded ? (
                              <FileCheck className="w-5 h-5 text-blue-500" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                {idx + 1}. {req.name}
                              </span>
                              {req.isMandatory ? (
                                <span className="text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 px-1.5 py-0.2 rounded font-bold">
                                  Wajib
                                </span>
                              ) : (
                                <span className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-1.5 py-0.2 rounded">
                                  Opsional
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{req.description}</p>
                            {doc && (
                              <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400 mt-1 flex items-center space-x-2">
                                <span>📄 {doc.fileName}</span>
                                <span>•</span>
                                <span className="text-slate-400">Status: {doc.verificationStatus}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action buttons per document */}
                        <div className="flex items-center space-x-2 self-end sm:self-center">
                          {!isUploaded ? (
                            <button
                              onClick={() => handleSimulateUpload(req.code)}
                              disabled={isLoading}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300 text-xs px-3 py-1.5 rounded-lg font-semibold border border-blue-200 dark:border-blue-800 flex items-center space-x-1 disabled:opacity-50"
                            >
                              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                              <span>Upload Berkas</span>
                            </button>
                          ) : (
                            <div className="flex items-center space-x-1">
                              {doc.verificationStatus !== 'verified' && (
                                <button
                                  onClick={() => handleVerifyDocument(req.code, 'verified')}
                                  disabled={isLoading}
                                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs px-2.5 py-1.5 rounded-lg font-semibold border border-emerald-200 disabled:opacity-50"
                                >
                                  Verifikasi ✓
                                </button>
                              )}
                              {doc.verificationStatus !== 'rejected' && (
                                <button
                                  onClick={() => handleVerifyDocument(req.code, 'rejected', 'Berkas kurang jelas / perlu diperbaiki.')}
                                  disabled={isLoading}
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs px-2.5 py-1.5 rounded-lg font-semibold border border-rose-200 disabled:opacity-50"
                                >
                                  Tolak ✕
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IDENTITAS PEGAWAI */}
          {activeTab === 'identitas' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2">Data Diri</h4>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500">Nama Lengkap</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{candidate.employee.nama}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500">Gelar</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{candidate.employee.gelar || '-'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500">NRK</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">{candidate.employee.nrk}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500">NIP</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">{candidate.employee.nip}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Jenis Kelamin</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {candidate.employee.jenisKelamin === 'L' ? 'Laki-Laki' : 'Perempuan'}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2">Jabatan & Unit Kerja</h4>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500">Jabatan</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{candidate.employee.jabatan}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500">Pangkat / Golongan</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{candidate.employee.pangkat || '-'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500">UKPD</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{candidate.employee.ukpd}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500">Perangkat Daerah</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{candidate.employee.perangkatDaerah}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Wilayah</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{candidate.employee.wilayah}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 dark:bg-slate-950 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
