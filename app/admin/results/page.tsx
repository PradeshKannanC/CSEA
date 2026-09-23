"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AdminNav } from '@/components/navigation/AdminNav';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CoinIcon } from '@/components/brand/CoinIcon';
import { useVentura } from '@/lib/store';
import { useToast } from '@/components/feedback/Toast';
import { Trophy, Sparkles, Eye, ArrowLeft, Users, CheckCircle2, ShieldAlert, History, Download } from 'lucide-react';
import { EmptyState } from '@/components/feedback/EmptyState';

interface AdminResultRow {
  rank: number;
  roomId?: string;
  roomName?: string;
  roomCode?: string;
  ideaId: string;
  anonymousId: string;
  title: string;
  teamName: string;
  members: string[];
  totalCoins: number;
  investorCount: number;
  trophy: string;
  track: string;
}

interface EventRoundSummary {
  id: string;
  name: string;
  round: number;
  status: string;
  createdAt: string;
  revealedAt: string | null;
}

interface OverviewData {
  totalRooms: number;
  totalTeams: number;
  totalIdeas: number;
  totalCoinsInvested: number;
}

export default function AdminResultsPage() {
  const router = useRouter();
  const { eventConfig, setEventStatus } = useVentura();
  const toast = useToast();
  const [results, setResults] = useState<AdminResultRow[]>([]);
  const [allRooms, setAllRooms] = useState<{ id: string; name: string; code: string; status?: string }[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('ALL');
  const [allRounds, setAllRounds] = useState<EventRoundSummary[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [selectedStatus, setSelectedStatus] = useState<string>('DRAFT');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const loadResults = async (eventId?: string) => {
    try {
      setLoading(true);
      const url = eventId ? `/api/admin/results?eventId=${encodeURIComponent(eventId)}` : '/api/admin/results';
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.success) {
        setResults(data.results || []);
        if (data.allEvents) setAllRounds(data.allEvents);
        if (data.allRooms) setAllRooms(data.allRooms);
        if (data.overview) setOverview(data.overview);
        if (data.selectedEventId) setSelectedEventId(data.selectedEventId);
        if (data.selectedRound) setSelectedRound(data.selectedRound);
        if (data.eventStatus) setSelectedStatus(data.eventStatus);
      }
    } catch (error) {
      console.error('Failed to load admin results:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
  }, []);

  const handleBroadcastReveal = async () => {
    setIsPublishing(true);
    try {
      const res = await fetch('/api/admin/event/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REVEALED' }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error('Reveal Broadcast Failed', data.message || 'Unable to broadcast results.');
        return;
      }

      await setEventStatus('REVEALED');
      toast.success('Results Publicly Revealed!', 'Official tournament rankings are now live across all participant screens.');
      await loadResults(selectedEventId || undefined);
    } catch (e: any) {
      toast.error('Network Error', e.message || 'Failed to broadcast reveal.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleExportResultsCSV = () => {
    const params = new URLSearchParams();
    params.set('type', 'results');
    if (selectedRoomId && selectedRoomId !== 'ALL') {
      params.set('roomId', selectedRoomId);
    }
    if (selectedEventId) {
      params.set('eventId', selectedEventId);
    }
    window.location.href = `/api/admin/export?${params.toString()}`;
    toast.info('Downloading CSV', 'Generating official tournament results CSV export...');
  };

  const displayedResults =
    selectedRoomId === 'ALL'
      ? results
      : results.filter((r) => r.roomId === selectedRoomId);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
      <AdminNav />

      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full space-y-6 sm:space-y-8">
        {/* Header with Navigation & Action Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white">
                ADMINISTRATION CEREMONY ORCHESTRATION
              </span>
              <span
                className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                  selectedStatus === 'REVEALED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : selectedStatus === 'ADMIN_REVEALED'
                    ? 'bg-violet-50 text-violet-700 border border-violet-200'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {selectedStatus === 'REVEALED' ? 'PUBLIC BROADCAST ACTIVE' : selectedStatus === 'ADMIN_REVEALED' ? 'ADMIN CONFIDENTIAL PREVIEW' : 'AWAITING REVEAL'}
              </span>
              {allRounds.length > 1 && (
                <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                  Round {selectedRound}
                </span>
              )}
            </div>
            <h1 className="font-display font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
              Official Tournament Rankings &amp; Reveal Stage
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {selectedStatus === 'ADMIN_REVEALED'
                ? 'Review verified rankings, tie-breakers, and unmasked rosters privately before public broadcast.'
                : 'Tournament champions and final standings are published live to participants.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin">
              <Button variant="secondary" size="sm" pill icon={<ArrowLeft className="w-3.5 h-3.5" />}>
                ← Back to Control Center
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              pill
              onClick={handleExportResultsCSV}
              icon={<Download className="w-3.5 h-3.5" />}
            >
              Export Results CSV
            </Button>

            {selectedStatus === 'ADMIN_REVEALED' && (
              <Button
                variant="primary"
                size="sm"
                pill
                onClick={() => setShowConfirmModal(true)}
                disabled={isPublishing}
                icon={<Sparkles className="w-3.5 h-3.5" />}
              >
                {isPublishing ? 'Broadcasting...' : 'Reveal Results to Participants'}
              </Button>
            )}

            {selectedStatus === 'REVEALED' && (
              <Link href="/results">
                <Button variant="outline" size="sm" pill icon={<Eye className="w-3.5 h-3.5" />}>
                  Preview Public Ceremony
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Multi-Round Switcher: Preserves and Exposes All Historical Event Results */}
        {allRounds.length > 1 && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#635BFF]" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Tournament History &amp; Rounds:
              </span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {allRounds.map((rnd) => {
                const isSelected = selectedEventId === rnd.id;
                return (
                  <button
                    key={rnd.id}
                    onClick={() => {
                      setSelectedEventId(rnd.id);
                      loadResults(rnd.id);
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-[#635BFF] text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200'
                    }`}
                  >
                    Round {rnd.round} ({rnd.status})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* OVERVIEW CARD AT TOP OF RESULTS */}
        {overview && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#635BFF] bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200/50">
                  EVENT-GLOBAL AGGREGATE
                </span>
                <h2 className="font-display font-black text-xl text-slate-900 mt-1">
                  Results Overview
                </h2>
                <p className="text-xs text-slate-400">
                  Macro tournament metrics across the event and status of all room arenas.
                </p>
              </div>
              {selectedRoomId !== 'ALL' && (
                <Button
                  variant="outline"
                  size="sm"
                  pill
                  onClick={() => setSelectedRoomId('ALL')}
                >
                  Show All Rooms ({results.length})
                </Button>
              )}
            </div>

            {/* Overall Event KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                  Total Rooms
                </span>
                <span className="font-display font-black text-2xl text-slate-900">
                  {overview.totalRooms}
                </span>
              </div>
              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                  Total Teams
                </span>
                <span className="font-display font-black text-2xl text-slate-900">
                  {overview.totalTeams}
                </span>
              </div>
              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                  Total Ideas
                </span>
                <span className="font-display font-black text-2xl text-slate-900">
                  {overview.totalIdeas}
                </span>
              </div>
              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                  Total Coins Invested
                </span>
                <div className="flex items-center gap-1 font-display font-black text-2xl text-[#635BFF]">
                  <CoinIcon size={20} />
                  <span>{overview.totalCoinsInvested}</span>
                </div>
              </div>
            </div>

            {/* Room Results Table */}
            {allRooms.length > 0 && (
              <div className="pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Room Arenas Status &amp; Inspection
                </h3>
                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-3 px-4">ROOM</th>
                        <th className="py-3 px-4">CODE</th>
                        <th className="py-3 px-4">STATUS</th>
                        <th className="py-3 px-4 text-center">RESULTS COUNT</th>
                        <th className="py-3 px-4 text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {allRooms.map((rm) => {
                        const count = results.filter((r) => r.roomId === rm.id).length;
                        const isFiltered = selectedRoomId === rm.id;
                        return (
                          <tr
                            key={rm.id}
                            className={`hover:bg-slate-50/70 transition-colors ${
                              isFiltered ? 'bg-indigo-50/40' : ''
                            }`}
                          >
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {rm.name}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-[#635BFF]">
                              {rm.code}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  rm.status === 'REVEALED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : rm.status === 'OPEN'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : rm.status === 'PAUSED'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : rm.status === 'CLOSED'
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {rm.status || 'DRAFT'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center text-slate-600 font-semibold">
                              {count} {count === 1 ? 'idea' : 'ideas'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => setSelectedRoomId(isFiltered ? 'ALL' : rm.id)}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                                  isFiltered
                                    ? 'bg-[#635BFF] text-white shadow-sm'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                {isFiltered ? 'Viewing Room Results' : 'View Results'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Room Filter Selector */}
        {allRooms.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                🏛️ Filter by Room Arena:
              </span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedRoomId('ALL')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedRoomId === 'ALL'
                    ? 'bg-[#111827] text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200'
                }`}
              >
                All Rooms ({results.length})
              </button>
              {allRooms.map((rm) => {
                const count = results.filter((r) => r.roomId === rm.id).length;
                const isSelected = selectedRoomId === rm.id;
                return (
                  <button
                    key={rm.id}
                    onClick={() => setSelectedRoomId(rm.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-[#635BFF] text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {rm.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-center text-sm text-slate-500">
            <div className="w-8 h-8 rounded-full border-2 border-[#635BFF] border-t-transparent animate-spin mx-auto mb-3" />
            Aggregating verified tournament results from database...
          </div>
        ) : displayedResults.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-center">
            <EmptyState
              icon={<Trophy className="w-8 h-8 text-amber-500" />}
              title="No tournament results for this view"
              description="Championship rankings will appear here once the tournament is finalized."
              className="py-6 border-0 shadow-none"
            />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Top 3 Podium Preview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {displayedResults.slice(0, 3).map((item) => (
                <div
                  key={`${item.rank}-${item.ideaId}`}
                  className={`bg-white rounded-3xl p-6 border shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between ${
                    item.rank === 1
                      ? 'border-amber-200 ring-2 ring-amber-400/30'
                      : 'border-slate-100'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span
                        className={`font-display font-black text-3xl ${
                          item.rank === 1
                            ? 'text-amber-500'
                            : item.rank === 2
                            ? 'text-slate-400'
                            : 'text-amber-700'
                        }`}
                      >
                        #{item.rank}
                      </span>
                      <Trophy
                        className={`w-6 h-6 ${
                          item.rank === 1
                            ? 'text-amber-500'
                            : item.rank === 2
                            ? 'text-slate-400'
                            : 'text-amber-700'
                        }`}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="font-display font-extrabold text-xl text-slate-900">
                        {item.anonymousId}
                      </div>
                      {item.roomName && (
                        <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-[#635BFF] border border-purple-200/60">
                          🏛️ {item.roomName}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-[#635BFF] mb-2">{item.teamName}</div>
                    <p className="text-[11px] text-slate-500 mb-4">{item.track}</p>

                    <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="font-bold text-[10px] uppercase text-slate-400 block">
                        ROSTER MEMBERS
                      </span>
                      {item.members.map((m, idx) => (
                        <div key={`${m}-${idx}`} className="font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#635BFF]" />
                          <span>{m}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-400">{item.investorCount} Backers</span>
                    <div className="flex items-center gap-1 font-display font-black text-slate-900">
                      <CoinIcon size={16} />
                      <span>{item.totalCoins} Coins</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Complete Official Rankings Table */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="font-display font-black text-lg sm:text-xl text-slate-900">
                    Complete Standings &amp; Verification Audit
                  </h2>
                  <p className="text-xs text-slate-400">
                    Authoritative tournament order calculated from verified database coin investments.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="admin">CONFIDENTIAL AUDIT</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    pill
                    onClick={handleExportResultsCSV}
                    icon={<Download className="w-3.5 h-3.5" />}
                  >
                    Download CSV
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="pb-3 pl-2">RANK</th>
                      <th className="pb-3">INNOVATION ASSET</th>
                      <th className="pb-3">UNMASKED TEAM</th>
                      <th className="pb-3">ROSTER MEMBERS</th>
                      <th className="pb-3 text-center">BACKERS</th>
                      <th className="pb-3 text-right pr-2">COINS BACKED</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {displayedResults.map((item) => (
                      <tr key={`${item.rank}-${item.ideaId}`} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 pl-2 font-display font-black text-sm">
                          {item.rank === 1 ? '🥇 #1' : item.rank === 2 ? '🥈 #2' : item.rank === 3 ? '🥉 #3' : `#${item.rank}`}
                        </td>
                        <td className="py-4">
                          <span className="font-bold text-slate-900 text-sm block">
                            {item.anonymousId}
                          </span>
                          <span className="text-[11px] text-slate-600 block font-medium">
                            {item.title}
                          </span>
                          <span className="text-[10px] text-slate-400 block uppercase">
                            {item.track}
                          </span>
                        </td>
                        <td className="py-4">
                          <span className="font-bold text-[#635BFF]">{item.teamName}</span>
                          {item.roomName && (
                            <span className="inline-block ml-2 text-[10px] font-semibold text-[#635BFF] bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60">
                              🏛️ {item.roomName}
                            </span>
                          )}
                        </td>
                        <td className="py-4 text-slate-600">
                          {item.members.join(', ')}
                        </td>
                        <td className="py-4 text-center font-semibold text-slate-700">
                          {item.investorCount}
                        </td>
                        <td className="py-4 text-right pr-2 font-display font-black text-sm text-slate-900">
                          <div className="flex items-center justify-end gap-1">
                            <CoinIcon size={14} />
                            <span>{item.totalCoins}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-[#635BFF] flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-[#635BFF]" />
            </div>
            <h3 className="font-display font-black text-xl text-slate-900 mb-2">
              Reveal Results to All Participants?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
              This will show winners, podium, and rankings to all users.
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="md"
                pill
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 justify-center"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                pill
                onClick={async () => {
                  setShowConfirmModal(false);
                  await handleBroadcastReveal();
                }}
                className="flex-1 justify-center font-bold"
              >
                Reveal Results
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
