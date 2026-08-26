'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { AwardProposal } from '@/types/award';
import { loadProposals, saveProposals } from '@/lib/award-storage';
import { UnifiedNavigation } from '@/platform/ui/UnifiedNavigation';
import { UnifiedDashboard } from '@/platform/ui/UnifiedDashboard';
import { UnifiedExceptionCenter } from '@/platform/ui/UnifiedExceptionCenter';
import { UnifiedWorkQueue } from '@/platform/ui/UnifiedWorkQueue';
import { UnifiedAuditFeed } from '@/platform/ui/UnifiedAuditFeed';
import { CandidateList } from '@/components/candidates/CandidateList';
import { CandidateDetailModal } from '@/components/candidates/CandidateDetailModal';
import { ExcelImporter } from '@/components/import/ExcelImporter';
import { DocumentGenerator } from '@/components/documents/DocumentGenerator';
import { SettingsManager } from '@/components/settings/SettingsManager';
import { StudentWorkspace } from '@/domains/student/components/StudentWorkspace';
import { PlatformOperationalService, OperationalMetrics } from '@/platform/services/operational';

function WorkspaceContent() {
  const [proposals, setProposals] = useState<AwardProposal[]>([]);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [userRole, setUserRole] = useState<'admin' | 'verifikator' | 'pegawai'>('admin');
  const [selectedCandidate, setSelectedCandidate] = useState<AwardProposal | null>(null);
  const [metrics, setMetrics] = useState<OperationalMetrics | null>(null);

  const [opService] = useState(() => new PlatformOperationalService());

  useEffect(() => {
    const loaded = loadProposals();
    Promise.resolve().then(() => {
      setProposals(loaded);
      opService.getOperationalMetrics().then(setMetrics);
    });
  }, [opService]);

  const refreshMetrics = () => {
    opService.getOperationalMetrics().then(setMetrics);
  };

  const handleUpdateCandidate = (updated: AwardProposal) => {
    const updatedList = proposals.map((p) => (p.id === updated.id ? updated : p));
    setProposals(updatedList);
    saveProposals(updatedList);
    setSelectedCandidate(updated);
    refreshMetrics();
  };

  const handleImportComplete = (newProposals: AwardProposal[]) => {
    const combined = [...newProposals, ...proposals];
    setProposals(combined);
    saveProposals(combined);
    setActiveTab('kandidat');
    refreshMetrics();
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
    refreshMetrics();
  };

  const handleWorkQueueProcess = (domain: 'EMPLOYEE' | 'STUDENT', entityId: string) => {
    if (domain === 'EMPLOYEE') {
      const found = proposals.find((p) => p.id === entityId);
      if (found) {
        if (found.status === 'SIAP_GENERATE' || found.status === 'GENERATED') {
          setActiveTab('generator');
        } else {
          setActiveTab('kandidat');
        }
        setSelectedCandidate(found);
      } else {
        setActiveTab('kandidat');
      }
    } else {
      setActiveTab('students');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-950" suppressHydrationWarning>
      {/* Unified Platform Navigation */}
      <UnifiedNavigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={userRole}
        setUserRole={setUserRole}
        counts={{
          totalEmployees: metrics?.totalEmployees || proposals.length,
          totalStudents: metrics?.totalStudents || 8,
          openExceptions: metrics?.totalOpenExceptions || 0,
          pendingWorkItems: metrics?.pendingVerifications || 0,
        }}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <UnifiedDashboard onNavigateTab={setActiveTab} />
        )}

        {activeTab === 'workqueue' && (
          <UnifiedWorkQueue onNavigateDomainItem={handleWorkQueueProcess} />
        )}

        {activeTab === 'exceptions' && (
          <UnifiedExceptionCenter
            exceptionQueue={opService.getExceptionQueue()}
            onRefresh={refreshMetrics}
          />
        )}

        {activeTab === 'kandidat' && (
          <CandidateList proposals={proposals} onSelectCandidate={setSelectedCandidate} />
        )}

        {activeTab === 'students' && <StudentWorkspace />}

        {activeTab === 'import' && <ExcelImporter onImportComplete={handleImportComplete} />}

        {activeTab === 'generator' && (
          <DocumentGenerator proposals={proposals} onUpdateProposalStatus={handleUpdateProposalStatus} />
        )}

        {activeTab === 'audit' && <UnifiedAuditFeed />}

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
        BANYUBIRU v0.3 — Unified Operational Intelligence Platform (Employee &amp; Student Administration)
      </footer>
    </div>
  );
}

// Export dynamic component with { ssr: false } to guarantee client-side hydration consistency
export default dynamic(() => Promise.resolve(WorkspaceContent), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-mono text-xs">
      Memuat Banyubiru Operational Workspace...
    </div>
  ),
});
