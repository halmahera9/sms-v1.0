'use client';

import React, { useState, useEffect } from 'react';
import { AwardProposal } from '@/types/award';
import { loadProposals, saveProposals } from '@/lib/award-storage';
import { Header } from '@/components/layout/Header';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { CandidateList } from '@/components/candidates/CandidateList';
import { CandidateDetailModal } from '@/components/candidates/CandidateDetailModal';
import { ExcelImporter } from '@/components/import/ExcelImporter';
import { DocumentGenerator } from '@/components/documents/DocumentGenerator';
import { SettingsManager } from '@/components/settings/SettingsManager';

export default function Home() {
  const [proposals, setProposals] = useState<AwardProposal[]>([]);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [userRole, setUserRole] = useState<'admin' | 'verifikator' | 'pegawai'>('admin');
  const [selectedCandidate, setSelectedCandidate] = useState<AwardProposal | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const loaded = loadProposals();
    setProposals(loaded);
  }, []);

  const handleUpdateCandidate = (updated: AwardProposal) => {
    const updatedList = proposals.map((p) => (p.id === updated.id ? updated : p));
    setProposals(updatedList);
    saveProposals(updatedList);
    setSelectedCandidate(updated);
  };

  const handleImportComplete = (newProposals: AwardProposal[]) => {
    const combined = [...newProposals, ...proposals];
    setProposals(combined);
    saveProposals(combined);
    setActiveTab('kandidat');
  };

  const handleUpdateProposalStatus = (ids: string[], status: AwardProposal['status']) => {
    const updatedList = proposals.map((p) => {
      if (ids.includes(p.id)) {
        return { ...p, status, updatedAt: new Date().toISOString() };
      }
      return p;
    });
    setProposals(updatedList);
    saveProposals(updatedList);
  };

  // Stats calculation
  const stats = {
    total: proposals.length,
    masaKerja: proposals.filter((p) => p.jenisPenghargaan === 'MASA_KERJA').length,
    satyalancana: proposals.filter((p) => p.jenisPenghargaan === 'SATYALANCANA').length,
    siapGenerate: proposals.filter((p) => p.status === 'SIAP_GENERATE').length,
  };

  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-mono text-sm">
        Memuat Sistem Otomatisasi Penghargaan Pegawai...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-950">
      {/* Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={userRole}
        setUserRole={setUserRole}
        stats={stats}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardOverview
            proposals={proposals}
            onNavigateTab={setActiveTab}
            onSelectCandidate={setSelectedCandidate}
          />
        )}

        {activeTab === 'kandidat' && (
          <CandidateList
            proposals={proposals}
            onSelectCandidate={setSelectedCandidate}
          />
        )}

        {activeTab === 'import' && (
          <ExcelImporter onImportComplete={handleImportComplete} />
        )}

        {activeTab === 'generator' && (
          <DocumentGenerator
            proposals={proposals}
            onUpdateProposalStatus={handleUpdateProposalStatus}
          />
        )}

        {activeTab === 'settings' && <SettingsManager />}
      </main>

      {/* Detail Candidate Modal */}
      {selectedCandidate && (
        <CandidateDetailModal
          candidate={selectedCandidate}
          userRole={userRole}
          onClose={() => setSelectedCandidate(null)}
          onUpdateCandidate={handleUpdateCandidate}
        />
      )}

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-500 mt-auto">
        BANYUBIRU v0.2 MVP — Sistem Otomatisasi Usulan Penghargaan Pegawai (SE Kepala BKD No. 22/SE/2026)
      </footer>
    </div>
  );
}
