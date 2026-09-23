"use client";

import React, { useState } from 'react';
import { AdminNav } from '@/components/navigation/AdminNav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ConfirmationModal } from '@/components/feedback/ConfirmationModal';
import { useVentura } from '@/lib/store';
import { useToast } from '@/components/feedback/Toast';
import { Check, X, Eye, FileText, CheckCircle2 } from 'lucide-react';
import { Idea } from '@/lib/types';

export default function AdminIdeasPage() {
  const { ideas, teams, updateIdeaSubmission } = useVentura();
  const toast = useToast();

  const [rejectTarget, setRejectTarget] = useState<Idea | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const filteredIdeas = filterStatus === 'ALL'
    ? ideas
    : ideas.filter((i) => i.status === filterStatus);

  const handleApprove = (teamId: string, anonId: string) => {
    updateIdeaSubmission(teamId, { status: 'APPROVED' });
    toast.success('Idea Approved', `${anonId} is now verified and active in the arena.`);
  };

  const confirmReject = () => {
    if (!rejectTarget) return;
    updateIdeaSubmission(rejectTarget.teamId, { status: 'REJECTED' });
    toast.error('Idea Rejected', `${rejectTarget.anonymousId} has been returned to the team leader for mandatory revisions.`);
    setRejectTarget(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
      <AdminNav />

      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              TECHNICAL AUDIT
            </span>
            <h1 className="font-display font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
              Idea Review &amp; Verification
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Review submissions, ensure anonymity compliance, and approve assets for the arena.
            </p>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-full border border-slate-200 shadow-xs">
            {['ALL', 'APPROVED', 'DRAFT', 'REJECTED'].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                  filterStatus === s
                    ? 'bg-[#111827] text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {filteredIdeas.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-6 h-6 text-slate-400" />}
            title="No submissions found"
            description={`There are currently no proposals matching status "${filterStatus}".`}
            actionLabel={filterStatus !== 'ALL' ? 'View All Submissions' : undefined}
            onAction={filterStatus !== 'ALL' ? () => setFilterStatus('ALL') : undefined}
            className="bg-white"
          />
        ) : (
          <div className="space-y-4">
            {filteredIdeas.map((idea) => {
              const team = teams.find((t) => t.id === idea.teamId);
              return (
                <div
                  key={idea.id}
                  className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className="px-3.5 py-1 rounded-full bg-indigo-50 text-[#635BFF] font-bold text-xs border border-indigo-100">
                        {idea.anonymousId}
                      </span>
                      <h3 className="font-display font-bold text-lg text-slate-900">
                        {idea.title}{' '}
                        <span className="text-xs font-normal text-slate-400">
                          (Team: {team?.name})
                        </span>
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="tag">{idea.categoryTag}</Badge>
                      <Badge
                        variant={
                          idea.status === 'APPROVED'
                            ? 'live-teal'
                            : idea.status === 'DRAFT'
                            ? 'draft'
                            : 'admin'
                        }
                      >
                        {idea.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100/80">
                      <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block mb-1">
                        PROBLEM STATEMENT
                      </span>
                      <p className="text-slate-700 leading-relaxed">{idea.problem}</p>
                    </div>
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100/80">
                      <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block mb-1">
                        PROPOSED SOLUTION
                      </span>
                      <p className="text-slate-700 leading-relaxed">{idea.solution}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div className="text-xs text-slate-400 font-medium">
                      Architecture: <span className="font-mono text-slate-700 font-semibold">{idea.techStack}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {idea.status !== 'APPROVED' && (
                        <Button
                          variant="teal"
                          size="sm"
                          pill
                          onClick={() => handleApprove(idea.teamId, idea.anonymousId)}
                          icon={<Check className="w-3.5 h-3.5" />}
                        >
                          Approve Asset
                        </Button>
                      )}
                      {idea.status !== 'REJECTED' && (
                        <Button
                          variant="outline"
                          size="sm"
                          pill
                          onClick={() => setRejectTarget(idea)}
                          icon={<X className="w-3.5 h-3.5 text-rose-500" />}
                          className="hover:border-rose-300 hover:text-rose-600"
                        >
                          Reject Submission
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Confirmation Modal for Rejection */}
        <ConfirmationModal
          isOpen={Boolean(rejectTarget)}
          onClose={() => setRejectTarget(null)}
          onConfirm={confirmReject}
          title={`Reject Submission: ${rejectTarget?.anonymousId}?`}
          description="Rejecting this proposal will notify the team leader and return the dossier for mandatory revisions. The asset will not be investable while in revision status."
          confirmLabel="Reject Submission"
          isDestructive={true}
        />
      </main>
    </div>
  );
}
