"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AdminNav } from '@/components/navigation/AdminNav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CoinIcon } from '@/components/brand/CoinIcon';
import { useToast } from '@/components/feedback/Toast';
import {
  DoorOpen,
  ArrowLeft,
  Play,
  Pause,
  Square,
  Sparkles,
  Trophy,
  Users,
  Briefcase,
  Lightbulb,
  Clock,
  History,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export default function RoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const roomId = params?.id as string;

  const [room, setRoom] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);

  const fetchRoomDetail = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}`, { cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 404) {
          toast.error('Room Not Found', 'The requested room does not exist.');
          router.push('/admin/rooms');
          return;
        }
        throw new Error('Failed to fetch room detail');
      }
      const data = await res.json();
      setRoom(data.room);
    } catch (err: any) {
      toast.error('Error', err.message || 'Failed to load room details');
    } finally {
      setIsLoading(false);
    }
  }, [roomId, router, toast]);

  useEffect(() => {
    fetchRoomDetail();

    // SSE Realtime connection
    const eventSource = new EventSource('/api/realtime');
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (
          (payload.type === 'ROOM_STATUS_CHANGED' && payload.roomId === roomId) ||
          payload.type === 'NEW_INVESTMENT' ||
          payload.type === 'RESULTS_REVEALED'
        ) {
          fetchRoomDetail();
        }
      } catch (e) {
        // ignore JSON parse error
      }
    };

    return () => {
      eventSource.close();
    };
  }, [roomId, fetchRoomDetail]);

  const handleAction = async (
    action: 'start' | 'pause' | 'resume' | 'close' | 'reveal' | 'reveal-admin-results' | 'reveal-participant-results'
  ) => {
    if (
      action === 'reveal-admin-results' &&
      !confirm(`Reveal results to Admins for room "${room?.name}"? Participants will NOT be able to see results yet.`)
    ) {
      return;
    }
    if (
      action === 'reveal-participant-results' &&
      !confirm(`Reveal results to Participants in room "${room?.name}"? Once confirmed, participants will see final rankings and results.`)
    ) {
      return;
    }
    if (action === 'reveal' && !confirm(`Reveal results for room "${room?.name}"?`)) {
      return;
    }
    if (action === 'close' && !confirm(`Close investments for room "${room?.name}"? Participants will no longer be able to invest.`)) {
      return;
    }

    setIsExecuting(true);
    try {
      const endpoint =
        action === 'reveal-admin-results'
          ? `/api/admin/rooms/${roomId}/reveal-admin-results`
          : action === 'reveal-participant-results'
          ? `/api/admin/rooms/${roomId}/reveal-participant-results`
          : `/api/admin/rooms/${roomId}/${action}`;

      const res = await fetch(endpoint, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error('Action Failed', data.message || data.error || 'Failed to update room state');
      } else {
        const actionLabel =
          action === 'reveal-admin-results'
            ? 'REVEALED TO ADMINS'
            : action === 'reveal-participant-results'
            ? 'REVEALED TO PARTICIPANTS'
            : action.toUpperCase();
        toast.success('Room Updated', `Room state transitioned successfully: ${actionLabel}`);
        fetchRoomDetail();
      }
    } catch (err: any) {
      toast.error('Error', err.message || 'Network error');
    } finally {
      setIsExecuting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <Badge variant="live-teal">INVESTMENT OPEN</Badge>;
      case 'PAUSED':
        return <Badge variant="gold">PAUSED</Badge>;
      case 'CLOSED':
        if (room?.resultsRevealedToAdmins && !room?.resultsRevealedToParticipants) {
          return <Badge variant="gold">CLOSED (REVEALED TO ADMINS ONLY)</Badge>;
        }
        return <Badge variant="slate">CLOSED</Badge>;
      case 'REVEALED':
        return <Badge variant="live-purple">REVEALED TO ALL</Badge>;
      default:
        return <Badge variant="draft">DRAFT</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 text-[#635BFF] animate-spin mb-4" />
        <p className="text-slate-500 font-mono text-sm">Loading Room Control Center...</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center">
        <p className="text-slate-700 font-bold mb-4">Room not found.</p>
        <Link href="/admin/rooms">
          <Button variant="secondary" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Rooms
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 pb-20">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Navigation & Header */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Link
              href="/admin/rooms"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft size={14} /> Back to Rooms
            </Link>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#635BFF] shrink-0 shadow-xs">
                <DoorOpen size={28} />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-display font-black text-slate-900">
                    {room.name}
                  </h1>
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                    CODE: {room.code}
                  </span>
                  {getStatusBadge(room.status)}
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Physical / Dynamic Competition Room • Max Capacity: {room.capacity} teams
                </p>
              </div>
            </div>

            {/* Lifecycle Quick Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchRoomDetail}
                disabled={isExecuting}
                className="text-slate-600"
              >
                <RefreshCw size={14} className={isExecuting ? 'animate-spin' : ''} />
              </Button>

              {room.status === 'DRAFT' && (
                <Button
                  size="sm"
                  onClick={() => handleAction('start')}
                  disabled={isExecuting || room.teams.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm font-bold"
                >
                  <Play size={14} /> Open Investment Room
                </Button>
              )}

              {room.status === 'OPEN' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction('pause')}
                    disabled={isExecuting}
                    className="border-amber-400 text-amber-700 hover:bg-amber-50 gap-1.5 font-bold"
                  >
                    <Pause size={14} /> Pause
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleAction('close')}
                    disabled={isExecuting}
                    className="gap-1.5 font-bold"
                  >
                    <Square size={14} /> Close Investment
                  </Button>
                </>
              )}

              {room.status === 'PAUSED' && (
                <>
                  <Button
                    size="sm"
                    onClick={() => handleAction('resume')}
                    disabled={isExecuting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-bold"
                  >
                    <Play size={14} /> Resume
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleAction('close')}
                    disabled={isExecuting}
                    className="gap-1.5 font-bold"
                  >
                    <Square size={14} /> Close Room
                  </Button>
                </>
              )}

              {room.status === 'CLOSED' && (
                <div className="flex items-center gap-2 flex-wrap">
                  {!room.resultsRevealedToAdmins ? (
                    <Button
                      size="sm"
                      onClick={() => handleAction('reveal-admin-results')}
                      disabled={isExecuting}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm font-bold"
                    >
                      <Sparkles size={14} /> Reveal Results to Admins
                    </Button>
                  ) : (
                    <>
                      <Link href={`/admin/rooms/${roomId}/results`}>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 font-bold gap-1.5"
                        >
                          <Trophy size={14} /> View Admin Results
                        </Button>
                      </Link>
                      {!room.resultsRevealedToParticipants && (
                        <Button
                          size="sm"
                          onClick={() => handleAction('reveal-participant-results')}
                          disabled={isExecuting}
                          className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5 shadow-sm font-bold animate-pulse"
                        >
                          <Sparkles size={14} /> Reveal Results to Participants
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}

              {room.status === 'REVEALED' && (
                <div className="flex items-center gap-2">
                  <Link href={`/admin/rooms/${roomId}/results`}>
                    <Button
                      size="sm"
                      className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5 font-bold shadow-xs"
                    >
                      <Trophy size={14} /> View Winners &amp; Results
                    </Button>
                  </Link>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200">
                    <CheckCircle2 size={14} /> Revealed to All (Admins &amp; Participants)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Room Metrics Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Assigned Teams</span>
              <Users size={16} className="text-slate-400" />
            </div>
            <div className="text-3xl font-display font-black text-slate-900">
              {room.teams?.length || 0}
              <span className="text-xs text-slate-400 font-normal ml-1">/ {room.capacity}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              {room.stats?.totalMembers || 0} registered members
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Approved Ideas</span>
              <Lightbulb size={16} className="text-amber-500" />
            </div>
            <div className="text-3xl font-display font-black text-slate-900">
              {room.ideas?.length || 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              In this room arena
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Room Investments</span>
              <Briefcase size={16} className="text-emerald-500" />
            </div>
            <div className="text-3xl font-display font-black text-slate-900">
              {room.stats?.investmentCount || 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              Transactions processed
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Coins Traded</span>
              <CoinIcon size={16} />
            </div>
            <div className="text-3xl font-display font-black text-[#635BFF]">
              {room.stats?.totalCoins || 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              Room liquidity volume
            </p>
          </div>
        </div>

        {/* Arena Operational Readiness Diagnostics (Part 23) */}
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#635BFF]">
                ARENA OPERATIONAL READINESS DIAGNOSTICS
              </span>
              <h4 className="text-sm font-black text-white mt-0.5">
                Participation &amp; Investment Opportunity Health
              </h4>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {(room.stats?.investableIdeasCount ?? 0) >= 1
                ? '🟢 Ready for Cross-Investment'
                : '🟡 Awaiting Additional Teams / Approvals'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Teams
              </span>
              <span className="text-2xl font-black text-white">
                {room.teams?.length || 0}
              </span>
            </div>

            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Ideas
              </span>
              <span className="text-2xl font-black text-white">
                {room.stats?.ideaCount || 0}
              </span>
            </div>

            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Approved
              </span>
              <span className="text-2xl font-black text-amber-400">
                {room.stats?.approvedIdeasCount ?? (room.teams?.filter((t: any) => t.idea?.status === 'APPROVED').length || 0)}
              </span>
            </div>

            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Investable
              </span>
              <span className="text-2xl font-black text-emerald-400">
                {room.stats?.investableIdeasCount ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* If REVEALED or REVEALED TO ADMINS: Show Room Results & Podium */}
        {(room.status === 'REVEALED' || room.resultsRevealedToAdmins) && room.results && room.results.length > 0 && (
          <div className="bg-white border border-purple-200 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-purple-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200">
                  <Trophy size={20} />
                </div>
                <div>
                  <h3 className="font-display font-black text-xl text-slate-900">
                    Official Room Results &amp; Podium
                  </h3>
                  <p className="text-xs text-slate-500">
                    Deterministic rankings calculated strictly for {room.name}.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {room.resultsRevealedToAdmins && !room.resultsRevealedToParticipants && (
                  <Button
                    size="sm"
                    onClick={() => handleAction('reveal-participant-results')}
                    disabled={isExecuting}
                    className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5 shadow-sm font-bold text-xs"
                  >
                    <Sparkles size={12} /> Reveal to Participants
                  </Button>
                )}
                <Badge variant={room.resultsRevealedToParticipants ? 'live-purple' : 'gold'}>
                  {room.resultsRevealedToParticipants ? 'REVEALED TO ALL' : 'REVEALED TO ADMINS ONLY'}
                </Badge>
              </div>
            </div>

            {/* Podium Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {room.results.slice(0, 3).map((r: any) => (
                <div
                  key={r.id}
                  className={`p-5 rounded-2xl border flex flex-col justify-between relative overflow-hidden ${
                    r.rank === 1
                      ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/40 shadow-md'
                      : r.rank === 2
                      ? 'bg-slate-50 border-slate-300 shadow-xs'
                      : 'bg-orange-50/50 border-orange-200 shadow-xs'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full ${
                          r.rank === 1
                            ? 'bg-amber-400 text-amber-950'
                            : r.rank === 2
                            ? 'bg-slate-300 text-slate-800'
                            : 'bg-orange-300 text-orange-950'
                        }`}
                      >
                        Rank #{r.rank} {r.rank === 1 ? '• Winner' : ''}
                      </span>
                      <div className="flex items-center gap-1 font-mono font-bold text-sm text-slate-900">
                        <CoinIcon size={16} />
                        {r.totalCoins} Coins
                      </div>
                    </div>

                    <h4 className="font-display font-black text-lg text-slate-900 line-clamp-1">
                      {r.ideaTitle}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Team: <span className="text-slate-800 font-bold">{r.teamName}</span>
                    </p>
                    <div className="text-[11px] font-mono text-slate-400 mt-1">
                      Code: {r.ideaAnonymousId}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-600">
                    <span>{r.investorCount} Backers</span>
                    <span className="font-mono text-[11px]">Score: {r.score.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Remaining results table */}
            {room.results.length > 3 && (
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="p-3 pl-4">Rank</th>
                      <th className="p-3">Team</th>
                      <th className="p-3">Idea</th>
                      <th className="p-3">Backers</th>
                      <th className="p-3 pr-4 text-right">Coins Raised</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {room.results.slice(3).map((r: any) => (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="p-3 pl-4 font-mono font-bold text-slate-700">#{r.rank}</td>
                        <td className="p-3 font-semibold text-slate-900">{r.teamName}</td>
                        <td className="p-3 text-slate-600">
                          {r.ideaTitle}{' '}
                          <span className="text-[10px] font-mono text-slate-400">({r.ideaAnonymousId})</span>
                        </td>
                        <td className="p-3 text-slate-600">{r.investorCount}</td>
                        <td className="p-3 pr-4 text-right font-mono font-bold text-[#635BFF]">
                          {r.totalCoins}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Teams and Ideas Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assigned Teams Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="font-display font-black text-lg text-slate-900">
                  Assigned Teams ({room.teams.length})
                </h3>
              </div>
              <Link href="/admin/rooms">
                <Button size="sm" variant="ghost" className="text-xs text-indigo-600 hover:text-indigo-700">
                  Manage Roster <ExternalLink size={12} className="ml-1" />
                </Button>
              </Link>
            </div>

            {room.teams.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                <p className="text-xs text-slate-500">No teams have been assigned to this room yet.</p>
                <Link href="/admin/rooms" className="inline-block mt-3">
                  <Button size="sm" variant="outline" className="text-xs">
                    Assign Teams from Roster
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
                {room.teams.map((t: any) => (
                  <div key={t.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{t.name}</span>
                        {t.cohort && (
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {t.cohort}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        Leader: {t.leader?.name || t.leader?.email || 'N/A'} • {t.members?.length || 0} members
                      </p>
                    </div>

                    <div>
                      {t.idea ? (
                        <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {t.idea.isApproved ? 'Idea Approved' : 'Idea Submitted'}
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-slate-400 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                          No Idea
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ideas in Room Arena */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                <h3 className="font-display font-black text-lg text-slate-900">
                  Arena Ideas ({room.ideas.length})
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Anonymous Pitch Cards
              </span>
            </div>

            {room.ideas.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                <p className="text-xs text-slate-500">No approved ideas in this room yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
                {room.ideas.map((idea: any) => (
                  <div key={idea.id} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-[#635BFF]">
                            {idea.anonymousId}
                          </span>
                          <span className="font-bold text-sm text-slate-900 line-clamp-1">
                            {idea.title}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {idea.pitch}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-xs text-slate-700">
                          {idea.totalCoinsInvested || 0} Coins
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {idea.investorCount || 0} Backers
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Investment Feed in this Room */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-[#635BFF]" />
              <h3 className="font-display font-black text-lg text-slate-900">
                Recent Investments in {room.name}
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Live Room Ledger
            </span>
          </div>

          {room.recentInvestments?.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
              <p className="text-xs text-slate-500">No investments made in this room yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {room.recentInvestments?.map((inv: any) => (
                <div key={inv.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 font-mono text-xs">
                      {inv.investorName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900">{inv.investorName}</span>{' '}
                      <span className="text-[10px] text-slate-400">({inv.investorRole})</span>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Target: {inv.ideaAnonymousId} • {inv.ideaTitle}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-black text-sm text-[#635BFF]">+{inv.amount} Coins</span>
                    <div className="text-[10px] text-slate-400">
                      {new Date(inv.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
