"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AdminNav } from '@/components/navigation/AdminNav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CoinIcon } from '@/components/brand/CoinIcon';
import { useVentura } from '@/lib/store';
import { useToast } from '@/components/feedback/Toast';
import { EventStatus, Idea } from '@/lib/types';
import {
  Play,
  Pause,
  Square,
  Sparkles,
  Download,
  Lightbulb,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
  Users,
  Briefcase,
  TrendingUp,
  RotateCcw,
  ExternalLink,
  Eye,
  Sliders,
  ShieldCheck,
  History,
  Trophy,
  ArrowRight,
  ArrowLeft,
  DoorOpen,
} from 'lucide-react';

interface AdminOverviewData {
  stats: {
    totalUsers: number;
    totalTeams: number;
    totalIdeas: number;
    totalRooms?: number;
    unassignedTeamsCount?: number;
    totalInvestmentsCount: number;
    totalCoinsInvested: number;
    totalDistributedCoins: number;
    totalCoinsRemaining?: number;
    eventStatus: string;
    roomStats?: Array<{
      id: string;
      name: string;
      code: string;
      status: string;
      teamCount: number;
      participantCount: number;
      ideaCount: number;
      totalCoinsDistributed: number;
      totalCoinsInvested: number;
      totalCoinsRemaining: number;
    }>;
  };
  unresolvedIssues: Array<{
    id: string;
    issueType: string;
    message: string;
    status: string;
    createdAt: string;
    reportedBy: string;
    reportedByEmail: string;
    ideaTitle: string;
    ideaAnonymousId: string;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    metadata: any;
    createdAt: string;
    userName: string;
    userRole: string;
  }>;
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AdminControlCenterPage() {
  const router = useRouter();
  const { eventConfig, currentUser, setEventStatus, updateEventConfig, ideas, teams } = useVentura();
  const toast = useToast();

  if (currentUser && currentUser.role !== 'ADMIN') {
    return null;
  }

  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [pendingStatus, setPendingStatus] = useState<EventStatus | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    targetStatus: EventStatus;
    title: string;
    description: string;
    confirmButtonText: string;
  }>({
    isOpen: false,
    targetStatus: 'OPEN',
    title: '',
    description: '',
    confirmButtonText: 'Confirm',
  });

  const [showNewArenaModal, setShowNewArenaModal] = useState(false);
  const [isStartingNewArena, setIsStartingNewArena] = useState(false);

  const loadOverview = async () => {
    try {
      const res = await fetch('/api/admin/overview');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setOverview(data);
        }
      }
    } catch (err) {
      console.error('Failed to load admin overview data:', err);
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    loadOverview();
    const interval = setInterval(loadOverview, 10000);

    const handleAdminMetricsUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail) return;
      const { totalDistributedCoins, totalCoinsInvested, totalCoinsRemaining, totalInvestmentsCount } = customEvent.detail;
      setOverview((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          stats: {
            ...prev.stats,
            ...(typeof totalDistributedCoins === 'number' ? { totalDistributedCoins } : {}),
            ...(typeof totalCoinsInvested === 'number' ? { totalCoinsInvested } : {}),
            ...(typeof totalCoinsRemaining === 'number' ? { totalCoinsRemaining } : {}),
            ...(typeof totalInvestmentsCount === 'number' ? { totalInvestmentsCount } : {}),
          },
        };
      });
    };

    window.addEventListener('pnp_admin_metrics_updated', handleAdminMetricsUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('pnp_admin_metrics_updated', handleAdminMetricsUpdate);
    };
  }, []);

  const totalDistributed = overview?.stats.totalDistributedCoins ?? eventConfig.totalDistributedCoins ?? 0;
  const totalInvested = overview?.stats.totalCoinsInvested ?? ideas.reduce((acc, curr) => acc + curr.totalInvested, 0);
  const totalRemaining = overview?.stats.totalCoinsRemaining ?? Math.max(0, totalDistributed - totalInvested);
  const investedPercent = Math.min(100, Math.round((totalInvested / Math.max(1, totalDistributed)) * 100));

  // Authoritative status prioritized from live database overview query, falling back to store
  const currentStatus = (overview?.stats?.eventStatus || eventConfig.status || 'DRAFT') as EventStatus;

  const executeStatusChange = async (targetStatus: EventStatus, force = false) => {
    setPendingStatus(targetStatus);
    try {
      const res = await fetch('/api/admin/event/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: targetStatus,
          reset: targetStatus === 'DRAFT',
          force,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error('Lifecycle Transition Error', data.message || 'Unable to update tournament status.');
        return;
      }

      await setEventStatus(targetStatus);
      // Immediately reflect state in local overview
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              stats: {
                ...prev.stats,
                eventStatus: targetStatus,
              },
            }
          : null
      );
      toast.success(
        `Arena Phase: ${targetStatus}`,
        data.message || 'Tournament lifecycle transitioned successfully.'
      );
      await loadOverview();
    } catch (err: any) {
      console.error('Error transitioning event status:', err);
      toast.error('Network Error', err.message || 'Failed to update arena status.');
    } finally {
      setPendingStatus(null);
    }
  };

  const handleActionClick = (status: EventStatus) => {
    if (status === 'CLOSED') {
      setConfirmModal({
        isOpen: true,
        targetStatus: 'CLOSED',
        title: 'Close Investment Arena?',
        description: 'Closing the arena will stop all new investments.',
        confirmButtonText: 'Close Arena',
      });
    } else if (status === 'REVEALED') {
      setConfirmModal({
        isOpen: true,
        targetStatus: 'REVEALED',
        title: 'Reveal Results to All Participants?',
        description: 'This will show winners, podium, and rankings to all users.',
        confirmButtonText: 'Reveal Results',
      });
    } else {
      executeStatusChange(status);
    }
  };

  const handleConfirmAction = async () => {
    const targetStatus = confirmModal.targetStatus;
    setConfirmModal((p) => ({ ...p, isOpen: false }));
    await executeStatusChange(targetStatus);
  };

  const handleStartNewArena = async () => {
    setIsStartingNewArena(true);
    try {
      const res = await fetch('/api/admin/event/new-arena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error('Failed to Start New Arena', data.message || 'Unable to initialize new arena cycle.');
        return;
      }
      setShowNewArenaModal(false);
      toast.success(
        'New Arena Cycle Initialized!',
        'The new investment arena is in DRAFT state. Historical rankings and investments remain preserved.'
      );
      await loadOverview();
      if (data.event) {
        updateEventConfig({
          status: 'DRAFT',
          totalBudget: data.event.totalCoins,
          minPerIdea: data.event.minInvestment,
          maxPerIdea: data.event.maxInvestment,
        });
      }
    } catch (err: any) {
      console.error('Error starting new arena:', err);
      toast.error('Network Error', err.message || 'Failed to start new arena.');
    } finally {
      setIsStartingNewArena(false);
    }
  };

  const handleExportCSV = () => {
    const headers = 'Idea ID,Title,Track,Total Coins,Investors,Velocity\n';
    const rows = ideas
      .map(
        (i) =>
          `"${i.anonymousId}","${i.title}","${i.track}",${i.totalInvested},${i.investorCount},"${i.velocity}"`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pitch_and_prosper_audit_${Date.now()}.csv`;
    a.click();
    toast.info('CSV Exported', 'Audit ledger downloaded to your device.');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
      <AdminNav />

      <main className="flex-1 py-6 sm:py-8 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8">
        {/* 1. Header: PITCH AND PROSPER Admin Control Center */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-900 text-white">
                Admin Console
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-[#0F9D82]">
                <span className="w-2 h-2 rounded-full bg-[#22C7A9] animate-pulse" />
                Live Database Authoritative
              </span>
            </div>
            <h1 className="font-display font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
              PITCH AND PROSPER Admin Control Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              Real-Time Tournament Orchestration & Operational Governance
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              pill
              onClick={() => {
                setLoadingOverview(true);
                loadOverview();
              }}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              pill
              onClick={handleExportCSV}
              icon={<Download className="w-3.5 h-3.5" />}
            >
              Export CSV Ledger
            </Button>
          </div>
        </div>

        {/* 2. Top 6 Key Metrics Row — Authoritative Database Values (Matches Reference Layout) */}
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Metric 1: Participants */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              PARTICIPANTS
            </span>
            <div className="my-2 flex items-center justify-between">
              <span className="font-display font-black text-2xl sm:text-3xl text-slate-900">
                {overview ? overview.stats.totalUsers : eventConfig.totalParticipants}
              </span>
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Database accounts</span>
          </div>

          {/* Metric 2: Active Teams */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              ACTIVE TEAMS
            </span>
            <div className="my-2 flex items-center justify-between">
              <span className="font-display font-black text-2xl sm:text-3xl text-slate-900">
                {overview ? overview.stats.totalTeams : teams.length}
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#635BFF] flex items-center justify-center shrink-0">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                <span>Target: 50</span>
                <span>{Math.min(100, Math.round(((overview?.stats.totalTeams || teams.length) / 50) * 100))}%</span>
              </div>
              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#635BFF] rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round(((overview?.stats.totalTeams || teams.length) / 50) * 100))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Metric 3: Submitted Ideas */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              SUBMITTED IDEAS
            </span>
            <div className="my-2 flex items-center justify-between">
              <span className="font-display font-black text-2xl sm:text-3xl text-slate-900">
                {overview ? overview.stats.totalIdeas : ideas.length}
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#635BFF] flex items-center justify-center shrink-0">
                <Lightbulb className="w-4 h-4" />
              </div>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">100% verified status</span>
          </div>

          {/* Metric 4: Coins Distributed */}
          <div className="bg-[#111827] text-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-xl flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              COINS DISTRIBUTED
            </span>
            <div className="my-2 flex items-center gap-2">
              <span className="font-display font-black text-xl sm:text-2xl text-white tabular-nums">
                {totalDistributed.toLocaleString()}
              </span>
              <CoinIcon size={18} />
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              Virtual coin supply
            </span>
          </div>

          {/* Metric 5: Coins Invested */}
          <div className="bg-[#635BFF] text-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-[0_8px_24px_rgba(99,91,255,0.35)] flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">
              COINS INVESTED
            </span>
            <div className="my-2">
              <div className="flex items-baseline justify-between">
                <span className="font-display font-black text-xl sm:text-2xl text-white tabular-nums">
                  {totalInvested.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-indigo-100">{investedPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/30 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${investedPercent}%` }}
                />
              </div>
            </div>
            <span className="text-[10px] text-indigo-100 font-medium">
              Live market allocations
            </span>
          </div>

          {/* Metric 6: Coins Remaining */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              COINS REMAINING
            </span>
            <div className="my-2 flex items-center gap-2">
              <span className="font-display font-black text-xl sm:text-2xl text-[#0F9D82] tabular-nums">
                {totalRemaining.toLocaleString()}
              </span>
              <CoinIcon size={18} />
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              Treasury unallocated
            </span>
          </div>
        </div>

        {/* Unassigned Teams Warning Banner */}
        {overview?.stats?.unassignedTeamsCount && overview.stats.unassignedTeamsCount > 0 ? (
          <div className="mb-6 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-950 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-rose-950">
                  {overview.stats.unassignedTeamsCount} Team(s) Unassigned to Competition Rooms
                </h4>
                <p className="text-xs text-rose-700 mt-0.5">
                  All participating teams must be partitioned into rooms before opening the investment arena.
                </p>
              </div>
            </div>
            <Link href="/admin/rooms">
              <Button variant="primary" size="sm" pill>
                Assign Teams →
              </Button>
            </Link>
          </div>
        ) : null}

        {/* Room-Scoped Tournament Arenas Breakdown */}
        {overview?.stats?.roomStats && overview.stats.roomStats.length > 0 && (
          <div className="mb-8 bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <DoorOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-black text-lg text-slate-900">
                    Room-Scoped Tournament Arenas ({overview.stats.roomStats.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Physical and virtual competition rooms with isolated capital pools and independent rankings.
                  </p>
                </div>
              </div>
              <Link href="/admin/rooms">
                <Button variant="secondary" size="sm" pill>
                  Manage Rooms →
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {overview.stats.roomStats.map((rm) => (
                <div
                  key={rm.id}
                  className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex flex-col justify-between gap-3 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-slate-900">{rm.name}</span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                        {rm.code}
                      </span>
                    </div>
                    <Badge variant={rm.status === 'ACTIVE' ? 'live-teal' : 'slate'}>
                      {rm.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-2 px-2.5 bg-white rounded-xl border border-slate-100 text-center shadow-xs">
                    <div>
                      <div className="text-[9px] uppercase font-bold text-slate-400">Teams</div>
                      <div className="text-sm font-black text-slate-800">{rm.teamCount}</div>
                    </div>
                    <div className="border-x border-slate-100">
                      <div className="text-[9px] uppercase font-bold text-slate-400">Users</div>
                      <div className="text-sm font-black text-indigo-600">{rm.participantCount}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase font-bold text-slate-400">Ideas</div>
                      <div className="text-sm font-black text-slate-800">{rm.ideaCount}</div>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-slate-500 pt-1 border-t border-slate-200/50">
                    <div className="flex justify-between">
                      <span>Distributed:</span>
                      <span className="font-bold text-slate-800">{rm.totalCoinsDistributed.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Invested:</span>
                      <span className="font-bold text-amber-600">{rm.totalCoinsInvested.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Remaining:</span>
                      <span className="font-bold text-emerald-600">{rm.totalCoinsRemaining.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Main Operational Layout: Two Columns matching Reference Architecture */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left 8 Cols: Live Investment Tracking Table & Operational Management Modules */}
          <div className="lg:col-span-8 space-y-6 sm:space-y-8">
            {/* Table: Live Investment Tracking */}
            <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="font-display font-black text-xl text-slate-900">
                    Live Investment Tracking
                  </h2>
                  <Badge variant="admin">CONFIDENTIAL AUDIT</Badge>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 font-medium">
                    {ideas.length} ideas active in arena
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    pill
                    onClick={handleExportCSV}
                    icon={<Download className="w-3.5 h-3.5" />}
                  >
                    Export CSV
                  </Button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="pb-3 pl-2">IDEA IDENTITY</th>
                      <th className="pb-3 text-right">TOTAL INVESTMENT</th>
                      <th className="pb-3 text-center">INVESTORS</th>
                      <th className="pb-3 text-right pr-2">VELOCITY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs">
                    {ideas.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <Lightbulb className="w-8 h-8 text-slate-300 stroke-1" />
                            <p className="font-semibold text-slate-600 text-sm">No ideas submitted yet</p>
                            <p className="text-xs text-slate-400 max-w-sm">
                              When authorized Team Leaders submit their project proposals, they will appear here for live audit and capital allocation tracking.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      ideas.map((idea) => {
                        const team = teams.find((t) => t.id === idea.teamId);
                        return (
                          <tr key={idea.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-4 pl-2">
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-xs bg-slate-100 px-2.5 py-1 rounded-lg text-slate-800 shrink-0">
                                  {idea.anonymousId.replace('IDEA ', '')}
                                </span>
                                <div>
                                  <div className="font-bold text-slate-900 text-sm">
                                    {idea.title}{' '}
                                    <span className="text-slate-400 text-xs font-normal">
                                      ({team?.name || 'Shielded Team'})
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-semibold uppercase">
                                    {idea.track}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-4 text-right font-display font-extrabold text-sm text-slate-900">
                              <div className="flex items-center justify-end gap-1">
                                <CoinIcon size={14} />
                                <span>{idea.totalInvested}</span>
                              </div>
                            </td>

                            <td className="py-4 text-center font-semibold text-slate-700">
                              {idea.investorCount}
                            </td>

                            <td className="py-4 text-right pr-2">
                              <span
                                className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                                  idea.velocity === 'HIGH'
                                    ? 'bg-[#E6FBF5] text-[#0F9D82] border border-[#22C7A9]/30'
                                    : idea.velocity === 'STABLE'
                                    ? 'bg-slate-100 text-slate-700'
                                    : idea.velocity === 'MODERATE'
                                    ? 'bg-amber-50 text-amber-800'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {idea.velocity}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Complete Operational Governance Modules Grid */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h2 className="font-display font-black text-xl text-slate-900">
                    Platform Operational Hub
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Direct access to core administrative governance domains.
                  </p>
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                  6 ACTIVE MODULES
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Module 1: Users */}
                <Link
                  href="/admin/users"
                  className="group p-5 rounded-2xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200/80 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-[#635BFF] flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#635BFF] group-hover:translate-x-1 transition-all" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-sm text-slate-900 group-hover:text-[#635BFF] transition-colors">
                      Users Directory
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                      Manage participants, create administrators, and oversee cohort accounts.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-[#635BFF]">
                    {overview?.stats.totalUsers || 0} Registered Accounts →
                  </span>
                </Link>

                {/* Module 2: Teams */}
                <Link
                  href="/admin/teams"
                  className="group p-5 rounded-2xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200/80 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-sm text-slate-900 group-hover:text-emerald-600 transition-colors">
                      Teams &amp; Rosters
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                      Enforce strict 3-member team rosters (1 leader, 2 members) and track proposals.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600">
                    {overview?.stats.totalTeams || 0} Rosters Configured →
                  </span>
                </Link>

                {/* Module 3: Ideas */}
                <Link
                  href="/admin/ideas"
                  className="group p-5 rounded-2xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200/80 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Lightbulb className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-sm text-slate-900 group-hover:text-amber-600 transition-colors">
                      Idea Submissions
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                      Audit technical submissions, verify anonymity, and approve assets for arena.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-amber-600">
                    {overview?.stats.totalIdeas || 0} Proposals Registered →
                  </span>
                </Link>

                {/* Module 4: Investments */}
                <Link
                  href="/admin/investments"
                  className="group p-5 rounded-2xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200/80 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <History className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                      Transaction Ledger
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                      Immutable cryptographic audit trail of all virtual coin deployments.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-blue-600">
                    {overview?.stats.totalInvestmentsCount || 0} Transactions Recorded →
                  </span>
                </Link>

                {/* Module 5: Settings */}
                <Link
                  href="/admin/settings"
                  className="group p-5 rounded-2xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200/80 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Sliders className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-sm text-slate-900 group-hover:text-purple-600 transition-colors">
                      Coin Rules &amp; Limits
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                      Adjust virtual capital supply, minimum/maximum limits in real time.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-purple-600">
                    Budget: {eventConfig.totalBudget} Coins →
                  </span>
                </Link>

                {/* Module 6: Results Stage */}
                <Link
                  href="/admin/results"
                  className="group p-5 rounded-2xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200/80 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                      <Trophy className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-violet-600 group-hover:translate-x-1 transition-all" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-sm text-slate-900 group-hover:text-violet-600 transition-colors">
                      Results &amp; Reveal Stage
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                      Private admin ranking inspection and public reveal orchestration.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-violet-600">
                    Orchestrate Ceremony →
                  </span>
                </Link>
              </div>
            </div>
          </div>

          {/* Right 4 Cols: Arena Controls Card, Unresolved Issues & Audit Activity */}
          <div className="lg:col-span-4 space-y-6 sm:space-y-8">
            {/* Card 1: DYNAMIC ROOMS OVERVIEW (Room-Scoped Independent Lifecycle) */}
            <div className="bg-[#111827] text-white rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-2xl space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <DoorOpen className="w-4 h-4 text-[#635BFF]" />
                  <span className="text-xs font-black uppercase tracking-widest text-slate-200">
                    DYNAMIC ROOMS OVERVIEW
                  </span>
                </div>
                <Link
                  href="/admin/rooms"
                  className="text-[11px] font-bold text-[#635BFF] hover:underline"
                >
                  Manage All →
                </Link>
              </div>

              {/* Room list with independent statuses */}
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {overview?.stats?.roomStats && overview.stats.roomStats.length > 0 ? (
                  overview.stats.roomStats.map((r) => {
                    const statusColor =
                      r.status === 'OPEN'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : r.status === 'PAUSED'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : r.status === 'CLOSED'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        : r.status === 'REVEALED'
                        ? 'bg-violet-500/20 text-violet-300 border-violet-400/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700';

                    return (
                      <Link
                        key={r.id}
                        href={`/admin/rooms/${r.id}`}
                        className="p-3 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-all flex items-center justify-between group"
                      >
                        <div className="space-y-0.5 truncate mr-2">
                          <div className="font-bold text-xs text-slate-200 group-hover:text-white flex items-center gap-1.5">
                            <span className="truncate">{r.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">({r.code})</span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                            <span>{r.teamCount} teams</span>
                            <span>•</span>
                            <span>{r.participantCount} users</span>
                          </div>
                        </div>
                        <span
                          className={`font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusColor} shrink-0`}
                        >
                          {r.status}
                        </span>
                      </Link>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-slate-500 text-xs">
                    No competition rooms configured yet.
                  </div>
                )}
              </div>

              {/* Primary action button to Room Management */}
              <Link href="/admin/rooms" className="block pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  pill
                  className="w-full justify-center font-bold bg-[#635BFF] hover:bg-[#5046E5] text-white shadow-md"
                  icon={<DoorOpen className="w-3.5 h-3.5" />}
                >
                  MANAGE ALL ROOMS
                </Button>
              </Link>

              {/* Operational Telemetry & Parameters Summary */}
              <div className="pt-4 border-t border-slate-800 space-y-2.5 text-xs text-slate-400">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-semibold text-slate-500">System Status</span>
                  <span className="font-semibold text-[#0F9D82] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C7A9]" />
                    HEALTHY
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-semibold text-slate-500">Next Scheduled Event</span>
                  <span className="font-mono text-slate-300">{eventConfig.nextScheduledEvent || 'On Demand'}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-semibold text-slate-500">Min / Max Per Idea</span>
                  <span className="font-mono text-slate-300">{eventConfig.minPerIdea} / {eventConfig.maxPerIdea} Coins</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-semibold text-slate-500">Budget Per Participant</span>
                  <span className="font-mono text-slate-300">{eventConfig.totalBudget} Coins</span>
                </div>

                <div className="pt-2 text-right">
                  <Link
                    href="/admin/settings"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#635BFF] hover:underline"
                  >
                    <span>Configure Parameters</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Unresolved Issues */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h3 className="font-bold text-sm text-slate-900">Unresolved Issues</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  {overview?.unresolvedIssues.length || 0} Open
                </span>
              </div>

              <div className="space-y-3">
                {!overview || overview.unresolvedIssues.length === 0 ? (
                  <div className="py-6 text-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-slate-700">No unresolved issues</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">All reported issues have been reviewed.</p>
                  </div>
                ) : (
                  overview.unresolvedIssues.slice(0, 4).map((issue) => (
                    <div
                      key={issue.id}
                      className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-100 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-800 truncate">
                          {issue.issueType}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {timeAgo(issue.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {issue.message}
                      </p>
                      <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                        <span>By {issue.reportedBy}</span>
                        <span className="font-mono text-slate-500">{issue.ideaAnonymousId}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Card 3: Recent Audit Activity */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#635BFF]" />
                  <h3 className="font-bold text-sm text-slate-900">Audit Activity</h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Live Log
                </span>
              </div>

              <div className="space-y-3">
                {!overview || overview.recentActivity.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs">
                    No recent audit activity.
                  </div>
                ) : (
                  overview.recentActivity.slice(0, 5).map((log) => (
                    <div key={log.id} className="flex items-start gap-2.5 text-xs">
                      <div className="w-2 h-2 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-slate-800 truncate">
                            {log.action.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {timeAgo(log.createdAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {log.userName} ({log.userRole})
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Lifecycle Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-[#635BFF] flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-[#635BFF]" />
            </div>
            <h3 className="font-display font-black text-xl text-slate-900 mb-2">
              {confirmModal.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
              {confirmModal.description}
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="md"
                pill
                onClick={() => setConfirmModal((p) => ({ ...p, isOpen: false }))}
                className="flex-1 justify-center"
              >
                Cancel
              </Button>
              <Button
                variant={confirmModal.targetStatus === 'CLOSED' ? 'danger' : 'primary'}
                size="md"
                pill
                onClick={handleConfirmAction}
                className="flex-1 justify-center font-bold"
              >
                {confirmModal.confirmButtonText || 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Start New Arena Confirmation Modal */}
      {showNewArenaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-[#635BFF] flex items-center justify-center mb-4">
              <RotateCcw className="w-6 h-6 text-[#635BFF]" />
            </div>
            <h3 className="font-display font-black text-xl text-slate-900 mb-2">
              Start a new arena?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
              Starting a new arena will begin a new investment cycle. The previous arena&apos;s investments and results will remain preserved.
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="md"
                pill
                onClick={() => setShowNewArenaModal(false)}
                disabled={isStartingNewArena}
                className="flex-1 justify-center"
              >
                CANCEL
              </Button>
              <Button
                variant="primary"
                size="md"
                pill
                onClick={handleStartNewArena}
                disabled={isStartingNewArena}
                className="flex-1 justify-center font-bold"
              >
                {isStartingNewArena ? 'INITIALIZING...' : 'START NEW ARENA'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
