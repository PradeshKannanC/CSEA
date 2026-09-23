"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DashboardNav } from '@/components/navigation/DashboardNav';
import { Button } from '@/components/ui/Button';
import { useVentura } from '@/lib/store';
import { useToast } from '@/components/feedback/Toast';
import { ideaSubmissionSchema } from '@/lib/validation';
import { ReadOnlyIdeaView } from '@/components/team/ReadOnlyIdeaView';
import {
  FileText,
  Lock,
  CheckCircle2,
  AlertCircle,
  Save,
  Send,
  Shield,
  Clock,
  RotateCw,
  MessageSquare,
  Check,
} from 'lucide-react';

export default function IdeaSubmissionPage() {
  const { currentUser, getUserTeam, ideas, updateIdeaSubmission } = useVentura();
  const toast = useToast();

  const userTeam = getUserTeam(currentUser.id);
  const teamIdea = ideas.find((i) => i.teamId === userTeam?.id);

  // Form states initialized with teamIdea or defaults
  const [problem, setProblem] = useState(teamIdea?.problem || '');
  const [solution, setSolution] = useState(teamIdea?.solution || '');
  const [innovation, setInnovation] = useState(teamIdea?.innovation || '');
  const [impact, setImpact] = useState(teamIdea?.impact || '');
  const [whyInvest, setWhyInvest] = useState(teamIdea?.whyInvest || '');
  const [techStack, setTechStack] = useState(teamIdea?.techStack || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');

  const [isLocked, setIsLocked] = useState(false);
  const [submissionData, setSubmissionData] = useState<any>(null);
  const [teamIssues, setTeamIssues] = useState<any[]>([]);
  const [isUpdatingIssue, setIsUpdatingIssue] = useState<string | null>(null);

  // Permission: Exactly Team Leader (or Admin) can edit, but only BEFORE investment begins
  const isLeader = currentUser.role === 'TEAM_LEADER' || currentUser.role === 'ADMIN';
  const isTeamMember = currentUser.role === 'TEAM_MEMBER';
  const canEdit = isLeader && !isLocked;

  // Synchronize from server API
  useEffect(() => {
    let isMounted = true;
    async function loadSubmissionAndIssues() {
      try {
        const res = await fetch('/api/team/submission');
        if (res.ok) {
          const data = await res.json();
          if (data.success && isMounted) {
            setIsLocked(Boolean(data.isLocked));
            if (data.submission) {
              setSubmissionData(data.submission);
              setProblem(data.submission.problem || '');
              setSolution(data.submission.solution || '');
              setInnovation(data.submission.innovation || '');
              setImpact(data.submission.impact || '');
              setWhyInvest(data.submission.why_invest || '');
              setTechStack(data.submission.tech_stack || '');
            }
          }
        }

        // Also fetch issues
        const issuesRes = await fetch('/api/team/issues');
        if (issuesRes.ok) {
          const issuesData = await issuesRes.json();
          if (issuesData.success && isMounted) {
            setTeamIssues(issuesData.issues || []);
          }
        }
      } catch (err) {
        console.error('Failed to load submission/issues from API:', err);
      }
    }
    loadSubmissionAndIssues();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpdateIssueStatus = async (issueId: string, status: 'REVIEWED' | 'RESOLVED') => {
    setIsUpdatingIssue(issueId);
    try {
      const res = await fetch('/api/team/issues', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, status }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Status Updated', `Issue marked as ${status}.`);
        setTeamIssues((prev) =>
          prev.map((i) => (i.id === issueId ? { ...i, status } : i))
        );
      } else {
        toast.error('Update Failed', data.message || 'Could not update issue status.');
      }
    } catch {
      toast.error('Network Error', 'Failed to reach server.');
    } finally {
      setIsUpdatingIssue(null);
    }
  };

  const handleFieldChange = (setter: React.Dispatch<React.SetStateAction<string>>, val: string) => {
    setter(val);
    setSaveStatus('unsaved');
  };

  // Direct save execution via authoritative API
  const performSave = useCallback(
    async (isManual: boolean = false, isFinal: boolean = false) => {
      if (!isLeader) return;

      setIsSaving(true);
      setSaveStatus('saving');

      try {
        const res = await fetch('/api/team/submission', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            problem,
            solution,
            innovation,
            impact,
            whyInvest,
            techStack,
            submitForReview: isFinal,
          }),
        });

        const data = await res.json();
        setIsSaving(false);

        if (res.ok && data.success) {
          setSaveStatus('saved');
          if (data.submission) {
            setSubmissionData(data.submission);
          }
          if (isManual || isFinal) {
            toast.success(
              isFinal ? 'Proposal Submitted' : 'Draft Saved',
              data.message || 'Your team submission has been securely recorded.'
            );
          }
        } else {
          setSaveStatus('error');
          toast.error(
            'Save Denied',
            data.message || 'Could not save proposal revisions.'
          );
        }
      } catch {
        setIsSaving(false);
        setSaveStatus('error');
        toast.error('Connection Error', 'Failed to reach proposal server.');
      }
    },
    [isLeader, problem, solution, innovation, impact, whyInvest, techStack, toast]
  );

  // Debounced Autosave (1500ms delay)
  useEffect(() => {
    if (saveStatus !== 'unsaved' || !isLeader) return;

    const timer = setTimeout(() => {
      performSave(false, false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [saveStatus, performSave, isLeader]);

  const handleSaveDraft = () => {
    performSave(true, false);
  };

  const handleSubmitProposal = () => {
    if (!isLeader) return;

    // Validate with Zod
    const validation = ideaSubmissionSchema.safeParse({
      teamName: userTeam?.name || 'Innovation Team',
      problem,
      solution,
      innovation,
      impact,
      whyInvest,
      techStack,
    });

    if (!validation.success) {
      toast.error(
        'Validation Error',
        validation.error.errors[0]?.message || 'Please complete all required fields.'
      );
      return;
    }

    performSave(true, true);
  };

  const designatedLeaderName = userTeam?.members.find((m) => m.role === 'TEAM_LEADER')?.name || 'Designated Team Leader';

  // Read-only Presentation Document for Team Members (zero textareas, no form inputs, no Save/Submit buttons)
  if (isTeamMember) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
        <DashboardNav />
        <main className="flex-1 py-6 sm:py-8 lg:py-10 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
          <ReadOnlyIdeaView
            submission={submissionData}
            teamName={userTeam?.name || 'Innovation Team'}
            teamId={userTeam?.submissionId || userTeam?.id || 'CSEA-TEAM'}
            designatedLeaderName={designatedLeaderName}
            teamMembers={userTeam?.members}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
      <DashboardNav />

      <main className="flex-1 py-6 sm:py-8 lg:py-10 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8">
        {/* Top Header matching design reference */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-4">
          <div>
            <div className="inline-block mb-1.5 sm:mb-2">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#635BFF] bg-indigo-50 px-2.5 sm:px-3 py-1 rounded-full border border-indigo-100">
                PITCH AND PROSPER • TEAM LEADER CONSOLE
              </span>
            </div>
            <h1 className="font-display font-black text-2xl sm:text-3xl md:text-4xl text-slate-900 tracking-tight">
              PITCH AND PROSPER Submission Portal
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-600">
              Refine your innovation details. All fields are anonymized during the investment window.
            </p>
          </div>

          <div className="text-left md:text-right shrink-0">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
              SUBMISSION ID
            </span>
            <span className="font-mono font-bold text-xs sm:text-sm text-slate-800">
              {submissionData?.team_id || userTeam?.submissionId || 'PNP-2024-882'}
            </span>
          </div>
        </div>

        {/* Lock Notice if Investment Started */}
        {isLocked ? (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Your idea is locked because the investment period has begun. All modifications are disabled.
            </span>
          </div>
        ) : !isLeader && (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              You are signed in as a Team Member (Viewer). Only the designated Team Leader ({designatedLeaderName}) can modify this submission.
            </span>
          </div>
        )}

        {/* Main Content Grid matching dashboard.png */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left: 2-Column Grid of 6 Textareas (reflows to 1 column on split-screen / tablet) */}
          <div className="lg:col-span-8 bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 lg:p-8 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-5 sm:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Field 1: Problem Statement */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="field-problem" className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    PROBLEM STATEMENT
                  </label>
                  <span className={`text-[10px] font-mono ${problem.length < 20 && problem.length > 0 ? 'text-amber-500 font-bold' : 'text-slate-400'}`}>
                    {problem.length}/500 (min 20)
                  </span>
                </div>
                <textarea
                  id="field-problem"
                  rows={4}
                  disabled={!canEdit}
                  value={problem}
                  maxLength={500}
                  onChange={(e) => handleFieldChange(setProblem, e.target.value)}
                  placeholder="What critical pain point are you solving?"
                  className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs sm:text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF] focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed resize-none"
                />
              </div>

              {/* Field 2: The Solution */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="field-solution" className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    THE SOLUTION
                  </label>
                  <span className={`text-[10px] font-mono ${solution.length < 20 && solution.length > 0 ? 'text-amber-500 font-bold' : 'text-slate-400'}`}>
                    {solution.length}/500 (min 20)
                  </span>
                </div>
                <textarea
                  id="field-solution"
                  rows={4}
                  disabled={!canEdit}
                  value={solution}
                  maxLength={500}
                  onChange={(e) => handleFieldChange(setSolution, e.target.value)}
                  placeholder="How does your idea address the problem?"
                  className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs sm:text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF] focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed resize-none"
                />
              </div>

              {/* Field 3: Core Innovation */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="field-innovation" className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    CORE INNOVATION
                  </label>
                  <span className={`text-[10px] font-mono ${innovation.length < 20 && innovation.length > 0 ? 'text-amber-500 font-bold' : 'text-slate-400'}`}>
                    {innovation.length}/500 (min 20)
                  </span>
                </div>
                <textarea
                  id="field-innovation"
                  rows={4}
                  disabled={!canEdit}
                  value={innovation}
                  maxLength={500}
                  onChange={(e) => handleFieldChange(setInnovation, e.target.value)}
                  placeholder="What is the unique technical or conceptual moat?"
                  className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs sm:text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF] focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed resize-none"
                />
              </div>

              {/* Field 4: Impact & Scale */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="field-impact" className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    IMPACT &amp; SCALE
                  </label>
                  <span className={`text-[10px] font-mono ${impact.length < 20 && impact.length > 0 ? 'text-amber-500 font-bold' : 'text-slate-400'}`}>
                    {impact.length}/500 (min 20)
                  </span>
                </div>
                <textarea
                  id="field-impact"
                  rows={4}
                  disabled={!canEdit}
                  value={impact}
                  maxLength={500}
                  onChange={(e) => handleFieldChange(setImpact, e.target.value)}
                  placeholder="Who benefits and how big is the opportunity?"
                  className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs sm:text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF] focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed resize-none"
                />
              </div>

              {/* Field 5: Why Invest? */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="field-why-invest" className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    WHY INVEST?
                  </label>
                  <span className={`text-[10px] font-mono ${whyInvest.length < 20 && whyInvest.length > 0 ? 'text-amber-500 font-bold' : 'text-slate-400'}`}>
                    {whyInvest.length}/500 (min 20)
                  </span>
                </div>
                <textarea
                  id="field-why-invest"
                  rows={4}
                  disabled={!canEdit}
                  value={whyInvest}
                  maxLength={500}
                  onChange={(e) => handleFieldChange(setWhyInvest, e.target.value)}
                  placeholder="The pitch for why your idea deserves coins."
                  className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs sm:text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF] focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed resize-none"
                />
              </div>

              {/* Field 6: Technology Stack */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="field-tech-stack" className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    TECHNOLOGY STACK
                  </label>
                  <span className={`text-[10px] font-mono ${techStack.length < 5 && techStack.length > 0 ? 'text-amber-500 font-bold' : 'text-slate-400'}`}>
                    {techStack.length}/300 (min 5)
                  </span>
                </div>
                <textarea
                  id="field-tech-stack"
                  rows={4}
                  disabled={!canEdit}
                  value={techStack}
                  maxLength={300}
                  onChange={(e) => handleFieldChange(setTechStack, e.target.value)}
                  placeholder="List key technologies or architectures."
                  className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs sm:text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF] focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed resize-none"
                />
              </div>
            </div>

            {/* Bottom Actions & Autosave Status */}
            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs">
                {saveStatus === 'saved' && (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                    <span className="text-slate-600 font-medium">All changes saved to tournament ledger</span>
                  </>
                )}
                {saveStatus === 'saving' && (
                  <>
                    <Clock className="w-4 h-4 text-[#635BFF] animate-spin shrink-0" />
                    <span className="text-[#635BFF] font-medium">Saving revisions...</span>
                  </>
                )}
                {saveStatus === 'unsaved' && (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    <span className="text-slate-500 font-medium">Unsaved revisions (autosaving...)</span>
                  </>
                )}
                {saveStatus === 'error' && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="text-rose-600 font-medium">Unable to save revisions</span>
                    <button
                      type="button"
                      onClick={() => performSave(true)}
                      className="ml-1 text-[11px] font-bold text-[#635BFF] hover:underline flex items-center gap-1"
                    >
                      <RotateCw className="w-3 h-3" />
                      Retry
                    </button>
                  </div>
                )}
              </div>

              {isLeader && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                  {isLocked ? (
                    <div className="px-4 py-2.5 rounded-full bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center gap-2 border border-slate-200">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Revisions Frozen (Arena Active)</span>
                    </div>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        pill
                        onClick={handleSaveDraft}
                        disabled={isSaving}
                        className="w-full sm:w-auto min-h-[44px] justify-center"
                        icon={<Save className="w-4 h-4" />}
                      >
                        Save Draft
                      </Button>

                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        pill
                        onClick={handleSubmitProposal}
                        disabled={isSaving}
                        className="w-full sm:w-auto min-h-[44px] justify-center"
                        iconRight={<Send className="w-4 h-4" />}
                      >
                        Submit Proposal
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar matching dashboard.png */}
          <div className="lg:col-span-4 space-y-6">
            {/* Card 1: SUBMISSION STATUS matching screenshot */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                SUBMISSION STATUS
              </span>

              {/* Draft Status Card (Yellow/Amber highlight) matching screenshot */}
              <div className="bg-[#FFFBEB] rounded-2xl p-4 border border-[#FDE68A] flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[#D97706] shadow-xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-display font-extrabold text-sm text-[#92400E]">
                    DRAFT
                  </div>
                  <div className="text-[11px] text-[#B45309]">
                    Visible only to your team
                  </div>
                </div>
              </div>

              {/* Live in Arena locked indicator matching screenshot */}
              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100 flex items-center justify-between text-slate-400 text-xs">
                <div className="flex items-center gap-3">
                  <Lock className="w-4 h-4" />
                  <span className="font-bold tracking-wider uppercase text-[11px]">
                    LIVE IN ARENA
                  </span>
                </div>
                <span className="text-[10px] font-semibold bg-slate-200/70 px-2 py-0.5 rounded text-slate-600">
                  Pending Review
                </span>
              </div>
            </div>

            {/* Card 2: TEAM ROSTER (Dark Card) matching dashboard.png */}
            <div className="bg-[#111827] text-white rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  TEAM ROSTER
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {userTeam?.cohort || 'Alpha 2024'}
                </span>
              </div>

              {/* Members List */}
              <div className="space-y-4">
                {userTeam?.members.map((member) => (
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
                <span>3 members assigned • 1 designated leader</span>
              </div>
            </div>

            {/* Card 3: MEMBER REVISION REQUESTS */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  MEMBER REVISION REQUESTS ({teamIssues.length})
                </span>
                <MessageSquare className="w-4 h-4 text-[#635BFF]" />
              </div>

              {teamIssues.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-500 text-center">
                  No revision requests submitted by your team members yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {teamIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-slate-200 text-slate-700 uppercase">
                          {issue.issueType.replace(/_/g, ' ')}
                        </span>
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
                      <p className="text-slate-800 font-medium leading-relaxed">{issue.message}</p>
                      <div className="text-[10px] text-slate-400">
                        by {issue.reportedBy?.name || 'Member'} • {new Date(issue.createdAt).toLocaleDateString()}
                      </div>

                      {/* Action buttons for Leader */}
                      {issue.status !== 'RESOLVED' && (
                        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-end gap-2">
                          {issue.status === 'OPEN' && (
                            <button
                              type="button"
                              disabled={isUpdatingIssue === issue.id}
                              onClick={() => handleUpdateIssueStatus(issue.id, 'REVIEWED')}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                              Mark Reviewed
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isUpdatingIssue === issue.id}
                            onClick={() => handleUpdateIssueStatus(issue.id, 'RESOLVED')}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            Resolve
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
