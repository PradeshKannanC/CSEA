"use client";

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Shield,
  Clock,
  AlertCircle,
  CheckCircle2,
  Lock,
  Tag,
  Sparkles,
  Layers,
  TrendingUp,
  MessageSquare,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ReportIssueModal } from '@/components/team/ReportIssueModal';

interface TeamSubmissionData {
  id?: string;
  team_id?: string;
  team_name?: string;
  anonymous_id?: string;
  title?: string;
  track?: string;
  category_tag?: string;
  problem?: string;
  solution?: string;
  innovation?: string;
  impact?: string;
  why_invest?: string;
  tech_stack?: string;
  status?: string;
  is_locked?: number;
  updated_at?: string;
}

interface IssueItem {
  id: string;
  issueType: string;
  message: string;
  status: 'OPEN' | 'REVIEWED' | 'RESOLVED';
  createdAt: string;
  reportedBy?: {
    name: string;
    role: string;
  };
}

interface ReadOnlyIdeaViewProps {
  submission: TeamSubmissionData | null;
  teamName: string;
  teamId: string;
  designatedLeaderName?: string;
  teamMembers?: Array<{
    id: string;
    name: string;
    role: string;
    displayRole: string;
    avatarInitials: string;
  }>;
}

export const ReadOnlyIdeaView: React.FC<ReadOnlyIdeaViewProps> = ({
  submission,
  teamName,
  teamId,
  designatedLeaderName = 'Designated Team Leader',
  teamMembers = [],
}) => {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [isLoadingIssues, setIsLoadingIssues] = useState(false);

  const fetchIssues = async () => {
    try {
      setIsLoadingIssues(true);
      const res = await fetch('/api/team/issues');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setIssues(data.issues || []);
        }
      }
    } catch (err) {
      console.error('Error fetching team issues:', err);
    } finally {
      setIsLoadingIssues(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  const isSubmitted = submission?.status === 'SUBMITTED' || submission?.status === 'APPROVED';

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Banner: Member Guidance & Call to Action */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-800/40">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-bold uppercase tracking-wider border border-indigo-400/30">
              <Users className="w-3.5 h-3.5" />
              <span>TEAM MEMBER DOSSIER • READ-ONLY PRESENTATION</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-display font-black tracking-tight">
              {submission?.title || `${teamName} Innovation Proposal`}
            </h2>
            <p className="text-xs sm:text-sm text-indigo-200/90 leading-relaxed">
              As a Team Member, you have full review access to your team&apos;s proposal. Only your designated Team Leader (<span className="text-white font-bold">{designatedLeaderName}</span>) can edit fields directly. If you spot anything that needs updating, report an issue below.
            </p>
          </div>

          <div className="shrink-0">
            <Button
              variant="primary"
              size="lg"
              pill
              onClick={() => setIsReportModalOpen(true)}
              className="w-full sm:w-auto shadow-lg shadow-indigo-500/30 bg-[#635BFF] hover:bg-[#5046E5]"
              icon={<MessageSquare className="w-4 h-4" />}
            >
              Report an Issue
            </Button>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column (8 cols): The Proposal Document */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-7">
            {/* Document Header Meta */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold font-mono">
                  {teamId}
                </span>
                <span className="px-3 py-1 rounded-full bg-indigo-50 text-[#635BFF] text-xs font-bold">
                  {submission?.track || 'General Innovation'}
                </span>
                {submission?.category_tag && (
                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                    {submission.category_tag}
                  </span>
                )}
              </div>

              <div className="text-right text-xs text-slate-400">
                <span>Last updated: </span>
                <span className="font-semibold text-slate-600">
                  {submission?.updated_at
                    ? new Date(submission.updated_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Just now'}
                </span>
              </div>
            </div>

            {/* Section 1: Problem Statement */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>Problem Statement</span>
              </div>
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-100 text-slate-800 text-sm leading-relaxed whitespace-pre-line font-normal">
                {submission?.problem || (
                  <span className="text-slate-400 italic">No problem statement written yet.</span>
                )}
              </div>
            </div>

            {/* Section 2: The Solution */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span>The Solution</span>
              </div>
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-100 text-slate-800 text-sm leading-relaxed whitespace-pre-line font-normal">
                {submission?.solution || (
                  <span className="text-slate-400 italic">No solution overview written yet.</span>
                )}
              </div>
            </div>

            {/* Section 3 & 4 Grid: Innovation & Target Impact */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Layers className="w-4 h-4 text-purple-500" />
                  <span>Unique Innovation</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-800 text-sm leading-relaxed whitespace-pre-line font-normal min-h-[120px]">
                  {submission?.innovation || (
                    <span className="text-slate-400 italic">No innovation details provided.</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span>Target Market & Impact</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-800 text-sm leading-relaxed whitespace-pre-line font-normal min-h-[120px]">
                  {submission?.impact || (
                    <span className="text-slate-400 italic">No impact metrics provided.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Section 5 & 6 Grid: Why Invest & Tech Stack */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <span>Why Invest?</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-800 text-sm leading-relaxed whitespace-pre-line font-normal min-h-[120px]">
                  {submission?.why_invest || (
                    <span className="text-slate-400 italic">No investor thesis written.</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Tag className="w-4 h-4 text-cyan-500" />
                  <span>Technology Stack</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-800 text-sm leading-relaxed whitespace-pre-line font-normal min-h-[120px]">
                  {submission?.tech_stack || (
                    <span className="text-slate-400 italic">No tech stack listed.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Issue Reports Log Section */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#635BFF]" />
                <h3 className="font-display font-bold text-sm text-slate-900 uppercase tracking-wide">
                  Submitted Revision Reports ({issues.length})
                </h3>
              </div>
              <button
                onClick={fetchIssues}
                className="text-[11px] font-bold text-[#635BFF] hover:underline"
              >
                Refresh
              </button>
            </div>

            {issues.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 text-center text-xs text-slate-500">
                No issues or corrections reported yet. If you see text that needs fixing, click &ldquo;Report an Issue&rdquo;.
              </div>
            ) : (
              <div className="space-y-3">
                {issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-slate-200 text-slate-700 uppercase">
                          {issue.issueType.replace(/_/g, ' ')}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          by {issue.reportedBy?.name || 'Team Member'}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          issue.status === 'RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : issue.status === 'REVIEWED'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {issue.status}
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{issue.message}</p>
                    <div className="text-[10px] text-slate-400">
                      {new Date(issue.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Metadata, Status & Team Roster */}
        <div className="lg:col-span-4 space-y-6">
          {/* Status Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
              SUBMISSION STATUS
            </span>

            {isSubmitted ? (
              <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-emerald-600 shadow-xs">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-display font-extrabold text-sm text-emerald-900">
                    SUBMITTED
                  </div>
                  <div className="text-[11px] text-emerald-700">
                    Ready for arena investment window
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#FFFBEB] rounded-2xl p-4 border border-[#FDE68A] flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[#D97706] shadow-xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-display font-extrabold text-sm text-[#92400E]">
                    DRAFT (IN REVIEW)
                  </div>
                  <div className="text-[11px] text-[#B45309]">
                    Being refined by your Team Leader
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 text-[11px] text-slate-500 leading-relaxed">
              <span className="font-bold text-slate-700">Leader in charge: </span>
              {designatedLeaderName}
            </div>
          </div>

          {/* Team Roster Card */}
          <div className="bg-[#111827] text-white rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                TEAM ROSTER
              </span>
              <span className="text-[10px] font-mono font-bold text-indigo-400">
                {teamId}
              </span>
            </div>

            <div className="space-y-4">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-indigo-400">
                      {member.avatarInitials}
                    </div>
                    <div>
                      <div className="font-bold text-white text-xs">{member.name}</div>
                      {member.role === 'TEAM_LEADER' && (
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/60">
                          TEAM LEADER
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {member.displayRole}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#22C7A9]" />
              <span>Authoritative Team Identity</span>
            </div>
          </div>
        </div>
      </div>

      {/* Report Issue Modal */}
      <ReportIssueModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        ideaId={submission?.id}
        onSubmitted={fetchIssues}
      />
    </div>
  );
};
