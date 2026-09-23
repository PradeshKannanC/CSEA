"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { VenturaLogo } from '@/components/brand/VenturaLogo';
import { Button } from '@/components/ui/Button';
import { CoinIcon } from '@/components/brand/CoinIcon';
import { triggerChampionshipReveal } from '@/lib/confetti';
import { Trophy, Sparkles, Users, Award, RotateCcw, ArrowLeft, Clock, ShieldAlert } from 'lucide-react';
import { useVentura } from '@/lib/store';

interface PublicResultRow {
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

export default function FinalResultsPage() {
  const { currentUser, eventConfig } = useVentura();
  const [stageIndex, setStageIndex] = useState<number>(0);
  const [results, setResults] = useState<PublicResultRow[]>([]);
  const [userRoom, setUserRoom] = useState<{ id: string; name: string; code: string } | null>(null);
  const [roomGroups, setRoomGroups] = useState<any[]>([]);
  const [selectedAdminRoomId, setSelectedAdminRoomId] = useState<string>('ALL');
  const [statusInfo, setStatusInfo] = useState<{ code: string; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadResults = useCallback(async () => {
    try {
      const res = await fetch('/api/results');
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.results) && data.results.length > 0) {
        setResults(data.results);
        setStatusInfo(null);
        if (data.room) setUserRoom(data.room);
        if (data.roomGroups) setRoomGroups(data.roomGroups);
      } else {
        if (data.code || data.message) {
          setStatusInfo({ code: data.code || 'PENDING', message: data.message || '' });
        }
      }
    } catch (error) {
      console.error('Failed to load public results:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResults();

    const handleRealtimeReveal = () => {
      loadResults();
    };

    window.addEventListener('pnp_results_revealed', handleRealtimeReveal);
    window.addEventListener('pnp_room_status_changed', handleRealtimeReveal);

    // Auto-poll every 5 seconds if results haven't loaded yet
    const interval = setInterval(() => {
      if (results.length === 0) {
        loadResults();
      }
    }, 5000);

    return () => {
      window.removeEventListener('pnp_results_revealed', handleRealtimeReveal);
      window.removeEventListener('pnp_room_status_changed', handleRealtimeReveal);
      clearInterval(interval);
    };
  }, [loadResults, results.length]);

  const displayedResults =
    currentUser.role === 'ADMIN' && selectedAdminRoomId !== 'ALL'
      ? results.filter((r) => r.roomId === selectedAdminRoomId)
      : results;

  useEffect(() => {
    if (!displayedResults.length) return;
    if (stageIndex === 0) {
      const timer = setTimeout(() => setStageIndex(1), 1200);
      return () => clearTimeout(timer);
    } else if (stageIndex === 1) {
      const timer = setTimeout(() => setStageIndex(2), 2200);
      return () => clearTimeout(timer);
    } else if (stageIndex === 2) {
      const timer = setTimeout(() => {
        setStageIndex(3);
        triggerChampionshipReveal();
      }, 2200);
      return () => clearTimeout(timer);
    } else if (stageIndex === 3) {
      const timer = setTimeout(() => setStageIndex(4), 3000);
      return () => clearTimeout(timer);
    }
  }, [stageIndex, displayedResults]);

  const champion = displayedResults[0];
  const runnerUp = displayedResults[1];
  const thirdPlace = displayedResults[2];

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
        <header className="bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
            <VenturaLogo href="/" />
            <div className="flex items-center gap-3">
              <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-slate-400 hidden sm:block">
                PITCH AND PROSPER FINAL RESULTS • CSEA 2024
              </div>
              {currentUser.role === 'ADMIN' && (
                <Link href="/admin">
                  <Button variant="secondary" size="sm" pill icon={<ArrowLeft className="w-3.5 h-3.5" />}>
                    ← Back to Control Center
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center text-slate-500">Loading results...</main>
      </div>
    );
  }

  if (!champion) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
        <header className="bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
            <VenturaLogo href="/" />
            <div className="flex items-center gap-3">
              <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-slate-400 hidden sm:block">
                PITCH AND PROSPER FINAL RESULTS • CSEA 2024
              </div>
              {currentUser.role === 'ADMIN' && (
                <Link href="/admin">
                  <Button variant="secondary" size="sm" pill icon={<ArrowLeft className="w-3.5 h-3.5" />}>
                    ← Back to Control Center
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center py-16 px-4 max-w-md mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
            <Trophy className="w-8 h-8" />
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-slate-900 mb-2">
            {statusInfo?.code === 'RESULTS_UNDER_ADMIN_REVIEW'
              ? 'Results Under Administrative Review'
              : 'Results Awaiting Reveal'}
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            {statusInfo?.message ||
              'The grand championship rankings and unmasked team identities will be revealed here once administrators conclude the arena and initiate the ceremony.'}
          </p>
          {currentUser.role === 'ADMIN' ? (
            <Link href="/admin">
              <Button variant="primary" size="md" pill icon={<ArrowLeft className="w-4 h-4" />}>
                ← Back to Control Center
              </Button>
            </Link>
          ) : currentUser.role === 'TEAM_LEADER' || currentUser.role === 'TEAM_MEMBER' ? (
            <Link href="/team">
              <Button variant="primary" size="md" pill>
                Return to Team Workspace
              </Button>
            </Link>
          ) : (
            <Link href="/arena">
              <Button variant="primary" size="md" pill>
                Explore Active Arena
              </Button>
            </Link>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
          <VenturaLogo href="/" />
          <div className="flex items-center gap-3">
            <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-slate-400 hidden sm:block">
              PITCH AND PROSPER FINAL RESULTS • CSEA 2024
            </div>
            {currentUser.role === 'ADMIN' && (
              <Link href="/admin">
                <Button variant="secondary" size="sm" pill icon={<ArrowLeft className="w-3.5 h-3.5" />}>
                  ← Back to Control Center
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Real-time Banner when next tournament arena is OPEN */}
      {eventConfig.status === 'OPEN' && (
        <div className="bg-[#22C7A9]/10 border-b border-[#22C7A9]/30 py-3 px-4 text-center text-xs font-bold text-[#0F9D82] flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#22C7A9] animate-pulse" />
          <span>A new tournament arena is now LIVE!</span>
          <Link href="/arena" className="underline hover:text-emerald-900 ml-1">
            Enter Live Arena &rarr;
          </Link>
        </div>
      )}

      <main className="flex-1 py-8 sm:py-12 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-center space-y-8 sm:space-y-12">
        {/* The Moment of Truth Subtitle matching screenshot */}
        <div>
          <div className="inline-block mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#635BFF]">
              THE MOMENT OF TRUTH
            </span>
          </div>

          {/* Giant Headline matching screenshot */}
          <h1 className="font-display font-black text-4xl sm:text-6xl md:text-7xl lg:text-8xl text-slate-900 tracking-tight leading-none">
            THE RESULTS
            <br />
            ARE IN.
          </h1>

          {/* Participant Room Badge */}
          {userRoom && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-50 border border-purple-200/80 text-[#635BFF] text-xs font-bold uppercase tracking-wider mt-4">
              <span>🏛️</span>
              <span>{userRoom.name} {userRoom.code ? `(${userRoom.code})` : ''} Arena Rankings</span>
            </div>
          )}

          {/* Admin Room Selector Tabs */}
          {currentUser.role === 'ADMIN' && roomGroups.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setSelectedAdminRoomId('ALL')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                  selectedAdminRoomId === 'ALL'
                    ? 'bg-[#111827] text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                All Rooms ({results.length})
              </button>
              {roomGroups.map((rg) => (
                <button
                  key={rg.id}
                  onClick={() => setSelectedAdminRoomId(rg.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                    selectedAdminRoomId === rg.id
                      ? 'bg-[#635BFF] text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  🏛️ {rg.name} ({rg.results.length})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reveal Ceremony Stages */}
        {stageIndex === 0 && (
          <div className="py-20 space-y-4">
            <div className="w-16 h-16 rounded-full bg-indigo-50 border-2 border-indigo-200 flex items-center justify-center mx-auto text-[#635BFF] animate-spin">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="font-display font-black text-2xl text-slate-900">
              Decrypting Arena Votes...
            </h3>
            <p className="text-xs text-slate-400">
              Aggregating verified virtual coin investments across all cohorts.
            </p>
          </div>
        )}

        {/* Podium Reveal Stage */}
        {stageIndex >= 1 && (
          <div className="space-y-12">
            {/* OVERALL CHAMPION CARD matching final-results.png lower container */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="bg-white rounded-4xl p-8 sm:p-14 border border-[#FDE68A] shadow-[0_20px_60px_rgba(245,185,66,0.15)] max-w-4xl mx-auto relative overflow-hidden"
            >
              {/* Background celebration glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-[#F5B942]/15 rounded-full blur-3xl pointer-events-none" />

              {/* Overall Champion Badge matching screenshot */}
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#FFFBEB] border border-[#FDE68A] text-xs font-black uppercase tracking-wider text-amber-700 mb-6 shadow-xs">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>OVERALL CHAMPION</span>
              </div>

              {/* Rank & Anonymous ID matching screenshot */}
              <div className="space-y-2 mb-6">
                <div className="text-sm font-black text-slate-400 uppercase tracking-widest">
                  # 1
                </div>
                <h2 className="font-display font-black text-5xl sm:text-6xl text-slate-900 tracking-tight">
                  {champion.anonymousId}
                </h2>
              </div>

              {/* Unmasked Team Details (Step 6-8) */}
              <AnimatePresence>
                {stageIndex >= 3 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="space-y-6 pt-6 border-t border-slate-100"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
                        UNMASKED INNOVATION TEAM
                      </span>
                      <h3 className="font-display font-black text-3xl text-[#635BFF]">
                        {champion.teamName}
                      </h3>
                      <p className="text-xs font-semibold text-slate-500 mt-1">
                        {champion.track}
                      </p>
                    </div>

                    {/* Team Members List */}
                    <div className="flex flex-wrap justify-center gap-3">
                      {champion.members.map((member, idx) => (
                        <div
                          key={idx}
                          className="px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-2 text-xs font-bold text-slate-800"
                        >
                          <Users className="w-3.5 h-3.5 text-[#635BFF]" />
                          <span>{member}</span>
                        </div>
                      ))}
                    </div>

                    {/* Total Invested Coins Callout */}
                    <div className="pt-4 flex items-center justify-center gap-3">
                      <CoinIcon size={26} className="sm:w-[30px] sm:h-[30px]" />
                      <span className="font-display font-black text-2xl sm:text-4xl text-slate-900">
                        {champion.totalCoins} Coins
                      </span>
                      <span className="text-xs font-semibold text-slate-400 self-end mb-1">
                        ({champion.investorCount} Backers)
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Runner-ups (Silver & Bronze) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto text-left">
              {/* Silver #2 */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-slate-200/90 shadow-[0_4px_24px_rgba(0,0,0,0.03)]"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-black text-slate-500"># 2 SILVER</span>
                  <Award className="w-6 h-6 text-slate-400" />
                </div>
                <h4 className="font-display font-black text-xl sm:text-2xl text-slate-900">
                  {runnerUp.anonymousId}
                </h4>
                <div className="text-sm font-bold text-[#635BFF] mb-3">
                  {runnerUp.teamName}
                </div>
                <p className="text-xs text-slate-500 mb-4">{runnerUp.track}</p>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
                  <span className="text-slate-400">{runnerUp.investorCount} Backers</span>
                  <div className="flex items-center gap-1 font-display font-black text-slate-900 text-base">
                    <CoinIcon size={16} />
                    <span>{runnerUp.totalCoins} Coins</span>
                  </div>
                </div>
              </motion.div>

              {/* Bronze #3 */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-slate-200/90 shadow-[0_4px_24px_rgba(0,0,0,0.03)]"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-black text-amber-700"># 3 BRONZE</span>
                  <Award className="w-6 h-6 text-amber-700" />
                </div>
                <h4 className="font-display font-black text-xl sm:text-2xl text-slate-900">
                  {thirdPlace.anonymousId}
                </h4>
                <div className="text-sm font-bold text-[#635BFF] mb-3">
                  {thirdPlace.teamName}
                </div>
                <p className="text-xs text-slate-500 mb-4">{thirdPlace.track}</p>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
                  <span className="text-slate-400">{thirdPlace.investorCount} Backers</span>
                  <div className="flex items-center gap-1 font-display font-black text-slate-900 text-base">
                    <CoinIcon size={16} />
                    <span>{thirdPlace.totalCoins} Coins</span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Complete Leaderboard Table */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] max-w-4xl mx-auto text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 mb-5 sm:mb-6">
                <div>
                  <h3 className="font-display font-black text-lg sm:text-xl text-slate-900">
                    Official Tournament Leaderboard
                  </h3>
                  <p className="text-xs text-slate-400">
                    Complete unmasked rankings and total coin allocation volumes.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setStageIndex(0);
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#635BFF] hover:underline self-start sm:self-auto mt-2 sm:mt-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Replay Ceremony</span>
                </button>
              </div>

              <div className="overflow-x-auto touch-pan-x">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="pb-3 pl-2">RANK</th>
                      <th className="pb-3">INNOVATION ASSET</th>
                      <th className="pb-3">UNMASKED TEAM</th>
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
                          <span className="font-bold text-slate-900 text-sm">
                            {item.anonymousId}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {item.track}
                          </span>
                        </td>
                        <td className="py-4">
                          <span className="font-bold text-[#635BFF]">{item.teamName}</span>
                          <span className="text-[10px] text-slate-500 block">
                            {item.members.join(', ')}
                          </span>
                          {item.roomName && (
                            <span className="inline-block mt-1 text-[9px] font-semibold text-[#635BFF] bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60">
                              🏛️ {item.roomName}
                            </span>
                          )}
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

            {/* Back to App Links */}
            <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 sm:gap-4 pt-4 max-w-md sm:max-w-none mx-auto">
              {currentUser.role === 'ADMIN' ? (
                <>
                  <Link href="/admin" className="w-full sm:w-auto">
                    <Button variant="primary" size="md" pill className="w-full sm:w-auto justify-center min-h-[44px]" icon={<ArrowLeft className="w-4 h-4" />}>
                      ← Back to Control Center
                    </Button>
                  </Link>
                  <Link href="/admin/results" className="w-full sm:w-auto">
                    <Button variant="secondary" size="md" pill className="w-full sm:w-auto justify-center min-h-[44px]">
                      View Admin Results Stage
                    </Button>
                  </Link>
                </>
              ) : currentUser.role === 'TEAM_LEADER' || currentUser.role === 'TEAM_MEMBER' ? (
                <>
                  <Link href="/team" className="w-full sm:w-auto">
                    <Button variant="primary" size="md" pill className="w-full sm:w-auto justify-center min-h-[44px]">
                      Return to Team Workspace
                    </Button>
                  </Link>
                  <Link href="/dashboard" className="w-full sm:w-auto">
                    <Button variant="secondary" size="md" pill className="w-full sm:w-auto justify-center min-h-[44px]">
                      Return to Dashboard
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/dashboard" className="w-full sm:w-auto">
                    <Button variant="secondary" size="md" pill className="w-full sm:w-auto justify-center min-h-[44px]">
                      Return to Dashboard
                    </Button>
                  </Link>
                  <Link href="/portfolio" className="w-full sm:w-auto">
                    <Button variant="primary" size="md" pill className="w-full sm:w-auto justify-center min-h-[44px]">
                      View My Backed Ideas
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
