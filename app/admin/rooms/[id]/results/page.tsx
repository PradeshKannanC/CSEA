"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AdminNav } from '@/components/navigation/AdminNav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CoinIcon } from '@/components/brand/CoinIcon';
import { useToast } from '@/components/feedback/Toast';
import {
  Trophy,
  ArrowLeft,
  Users,
  Award,
  Sparkles,
  RefreshCw,
  Clock,
  ShieldCheck,
  DoorOpen,
} from 'lucide-react';

interface ResultItem {
  id: string;
  rank: number;
  teamName: string;
  ideaTitle: string;
  anonymousId: string;
  track: string;
  totalCoins: number;
  investorCount: number;
  trophy: string;
  members: string[];
}

export default function AdminRoomResultsPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const roomId = params?.id as string;

  const [room, setRoom] = useState<any>(null);
  const [podium, setPodium] = useState<ResultItem[]>([]);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isRevealedToAdmins, setIsRevealedToAdmins] = useState(false);
  const [isRevealedToParticipants, setIsRevealedToParticipants] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchResults = async () => {
    if (!roomId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/rooms/${roomId}/results`, { cache: 'no-store' });
      const data = await res.json();

      if (!res.ok) {
        toast.error('Error', data.message || 'Failed to load room results.');
        if (res.status === 404) router.push('/admin/rooms');
        return;
      }

      setRoom(data.room);
      setIsRevealed(data.isRevealed);
      setIsRevealedToAdmins(Boolean(data.isRevealedToAdmins || data.room?.resultsRevealedToAdmins));
      setIsRevealedToParticipants(Boolean(data.isRevealedToParticipants || data.room?.resultsRevealedToParticipants));
      setPodium(data.podium || []);
      setResults(data.results || []);
    } catch (err: any) {
      toast.error('Network Error', err.message || 'Failed to fetch results.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevealToAdmins = async () => {
    if (!confirm(`Calculate and reveal results to Admins for room "${room?.name}"? Participants will NOT see results yet.`)) {
      return;
    }
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}/reveal-admin-results`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error('Action Failed', data.message || 'Failed to reveal results to admins.');
      } else {
        toast.success('Admin Reveal Complete', data.message || 'Results are now visible to Admins.');
        fetchResults();
      }
    } catch (err: any) {
      toast.error('Network Error', err.message || 'Error executing admin reveal.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRevealToParticipants = async () => {
    if (!confirm(`Reveal results to Participants in room "${room?.name}"? Once confirmed, all participants in this room will see final rankings.`)) {
      return;
    }
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}/reveal-participant-results`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error('Action Failed', data.message || 'Failed to reveal results to participants.');
      } else {
        toast.success('Public Reveal Complete', data.message || 'Results are now visible to participants.');
        fetchResults();
      }
    } catch (err: any) {
      toast.error('Network Error', err.message || 'Error executing participant reveal.');
    } finally {
      setIsActionLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [roomId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 text-[#635BFF] animate-spin mb-4" />
        <p className="text-slate-500 font-mono text-sm">Loading Room Results...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 pb-20">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin/rooms"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Rooms
          </Link>
          <div className="flex items-center gap-2">
            <Link href={`/admin/rooms/${roomId}`}>
              <Button variant="secondary" size="sm" pill>
                Room Details
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              pill
              onClick={fetchResults}
              icon={<RefreshCw size={12} />}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Room Header Banner */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 shrink-0 shadow-xs">
              <Trophy size={28} />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-display font-black text-slate-900">
                  {room?.name} — Results &amp; Winners
                </h1>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                  {room?.code}
                </span>
                <Badge variant={isRevealedToParticipants ? 'live-purple' : isRevealedToAdmins ? 'gold' : 'draft'}>
                  {isRevealedToParticipants
                    ? 'REVEALED TO ALL'
                    : isRevealedToAdmins
                    ? 'REVEALED TO ADMINS ONLY'
                    : room?.status}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Official deterministic arena results for this physical competition room.
              </p>
            </div>
          </div>

          {room?.revealedAt && (
            <div className="text-right sm:border-l sm:border-slate-100 sm:pl-6">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mb-1">
                Revealed At
              </span>
              <span className="font-mono text-xs text-slate-700 font-bold">
                {new Date(room.revealedAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Visibility Phase Banner */}
        {isRevealedToAdmins && !isRevealedToParticipants && (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Clock size={20} />
              </div>
              <div>
                <h3 className="font-bold text-amber-900 text-sm">Revealed to Admins Only</h3>
                <p className="text-xs text-amber-700 mt-0.5">
                  These results are currently visible ONLY to Administrators. Participants in this room cannot see results yet.
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              pill
              className="bg-purple-600 hover:bg-purple-700 shrink-0 font-bold text-xs"
              onClick={handleRevealToParticipants}
              disabled={isActionLoading}
              icon={<Sparkles size={14} />}
            >
              Reveal Results to Participants
            </Button>
          </div>
        )}

        {isRevealedToParticipants && (
          <div className="bg-purple-50 border border-purple-200 rounded-3xl p-4 flex items-center gap-3 text-purple-900 text-xs font-semibold">
            <ShieldCheck size={18} className="text-purple-600 shrink-0" />
            <span>Results are publicly revealed and visible to participants in this room.</span>
          </div>
        )}

        {!isRevealedToAdmins && !isRevealedToParticipants && results.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 text-center max-w-xl mx-auto space-y-4">
            <Clock className="w-12 h-12 text-amber-500 mx-auto" />
            <h2 className="text-xl font-bold text-amber-900">Results Not Yet Revealed</h2>
            <p className="text-sm text-amber-700">
              The winners for room &quot;{room?.name}&quot; have not been officially calculated and published yet.
              {room?.status === 'CLOSED'
                ? ' The room is CLOSED and ready for admin reveal.'
                : ' The room must reach CLOSED status before results can be generated.'}
            </p>
            {room?.status === 'CLOSED' && (
              <Button
                variant="primary"
                size="sm"
                pill
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={handleRevealToAdmins}
                disabled={isActionLoading}
                icon={<Sparkles size={14} />}
              >
                Reveal Results to Admins
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Top 3 Podium */}
            {podium.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold font-display text-slate-900 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    Championship Podium
                  </h2>
                  <span className="text-xs text-slate-500">Top 3 Innovation Leaders</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {podium.map((item, idx) => {
                    const isGold = item.rank === 1;
                    const isSilver = item.rank === 2;
                    const isBronze = item.rank === 3;

                    return (
                      <div
                        key={item.id || idx}
                        className={`relative rounded-3xl p-6 border shadow-xs transition-all ${
                          isGold
                            ? 'bg-linear-to-b from-amber-500/10 via-amber-500/5 to-white border-amber-300 md:-translate-y-2 ring-2 ring-amber-400/30'
                            : isSilver
                            ? 'bg-linear-to-b from-slate-300/15 via-slate-200/5 to-white border-slate-300'
                            : 'bg-linear-to-b from-amber-700/10 via-amber-700/5 to-white border-amber-600/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <span
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center font-display font-black text-lg shadow-xs ${
                              isGold
                                ? 'bg-amber-400 text-amber-950 ring-4 ring-amber-200'
                                : isSilver
                                ? 'bg-slate-200 text-slate-800 ring-4 ring-slate-100'
                                : 'bg-amber-700/80 text-white ring-4 ring-amber-700/20'
                            }`}
                          >
                            #{item.rank}
                          </span>
                          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-white/80 border border-slate-200 text-slate-700">
                            {item.anonymousId}
                          </span>
                        </div>

                        <div className="space-y-1 mb-4">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-[#635BFF]">
                            {item.track}
                          </span>
                          <h3 className="text-lg font-bold text-slate-900 leading-snug">
                            {item.ideaTitle}
                          </h3>
                          <p className="text-sm font-semibold text-slate-700">
                            Team: {item.teamName}
                          </p>
                        </div>

                        {/* Members */}
                        {item.members && item.members.length > 0 && (
                          <div className="mb-4 pt-3 border-t border-slate-100">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Members
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {item.members.map((m, mIdx) => (
                                <span
                                  key={mIdx}
                                  className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Metrics */}
                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 font-bold text-amber-600">
                            <CoinIcon size={16} />
                            <span className="font-mono text-base">{item.totalCoins.toLocaleString()}</span>
                            <span className="text-[10px] uppercase font-bold text-slate-400">Coins</span>
                          </div>
                          <div className="flex items-center gap-1 text-slate-500 font-mono">
                            <Users size={14} />
                            <span>{item.investorCount} investors</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Complete Rankings Table */}
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold font-display text-slate-900">
                    All Room Rankings ({results.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Deterministic ranking: Total Coins Invested &rarr; Unique Investor Count &rarr; Submission Time
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-6">Rank</th>
                      <th className="py-3.5 px-6">Idea ID</th>
                      <th className="py-3.5 px-6">Team &amp; Innovation</th>
                      <th className="py-3.5 px-6">Track</th>
                      <th className="py-3.5 px-6">Members</th>
                      <th className="py-3.5 px-6 text-right">Investors</th>
                      <th className="py-3.5 px-6 text-right">Total Invested</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    {results.map((r) => {
                      const isTop3 = r.rank <= 3;
                      return (
                        <tr
                          key={r.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isTop3 ? 'bg-violet-50/20' : ''
                          }`}
                        >
                          <td className="py-4 px-6 font-display font-black text-base">
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-xl font-bold text-xs ${
                                r.rank === 1
                                  ? 'bg-amber-400 text-amber-950 font-black'
                                  : r.rank === 2
                                  ? 'bg-slate-200 text-slate-800'
                                  : r.rank === 3
                                  ? 'bg-amber-700/80 text-white'
                                  : 'text-slate-600'
                              }`}
                            >
                              #{r.rank}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-mono text-xs font-bold text-slate-800">
                            {r.anonymousId}
                          </td>
                          <td className="py-4 px-6">
                            <div className="font-bold text-slate-900">{r.teamName}</div>
                            <div className="text-xs text-slate-500 font-medium">{r.ideaTitle}</div>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                              {r.track}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {r.members?.map((m, mIdx) => (
                                <span
                                  key={mIdx}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right font-mono text-slate-700">
                            {r.investorCount}
                          </td>
                          <td className="py-4 px-6 text-right font-mono font-bold text-[#635BFF] text-base">
                            <span className="inline-flex items-center gap-1">
                              <CoinIcon size={14} />
                              {r.totalCoins.toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
