"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { VenturaLogo } from '@/components/brand/VenturaLogo';
import { Button } from '@/components/ui/Button';
import { CoinIcon } from '@/components/brand/CoinIcon';
import { triggerChampionshipReveal } from '@/lib/confetti';
import { Trophy, Sparkles, Users, Award, RotateCcw, ArrowLeft, ShieldAlert, Clock } from 'lucide-react';
import { useVentura } from '@/lib/store';

interface ResultRow {
  id: string;
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

export default function RoomSpecificResultsPage() {
  const params = useParams();
  const roomId = params?.roomId as string;
  const { currentUser } = useVentura();

  const [results, setResults] = useState<ResultRow[]>([]);
  const [room, setRoom] = useState<{ id: string; name: string; code: string; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<{ code: string; message: string } | null>(null);
  const [stageIndex, setStageIndex] = useState<number>(0);

  useEffect(() => {
    if (!roomId) return;

    const loadRoomResults = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/results?roomId=${encodeURIComponent(roomId)}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          setErrorStatus({
            code: data.code || 'ACCESS_DENIED',
            message: data.message || 'Unable to access results for this room.',
          });
          return;
        }

        setResults(data.results || []);
        if (data.room) setRoom(data.room);
      } catch (err: any) {
        setErrorStatus({
          code: 'NETWORK_ERROR',
          message: err.message || 'Failed to connect to results server.',
        });
      } finally {
        setLoading(false);
      }
    };

    loadRoomResults();
  }, [roomId]);

  useEffect(() => {
    if (!results.length) return;
    if (stageIndex === 0) {
      const timer = setTimeout(() => setStageIndex(1), 1000);
      return () => clearTimeout(timer);
    } else if (stageIndex === 1) {
      const timer = setTimeout(() => setStageIndex(2), 1500);
      return () => clearTimeout(timer);
    } else if (stageIndex === 2) {
      const timer = setTimeout(() => {
        setStageIndex(3);
        triggerChampionshipReveal();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [stageIndex, results]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
        <header className="bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 h-16 sm:h-20 flex items-center justify-between">
            <VenturaLogo href="/" />
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <Sparkles className="w-8 h-8 text-[#635BFF] animate-spin mb-3" />
          <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">
            Synchronizing Official Room Rankings...
          </p>
        </div>
      </div>
    );
  }

  if (errorStatus) {
    const isUnderReview = errorStatus.code === 'RESULTS_UNDER_ADMIN_REVIEW';
    const isUnrevealed = errorStatus.code === 'RESULTS_NOT_REVEALED' || isUnderReview;
    return (
      <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
        <header className="bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 h-16 sm:h-20 flex items-center justify-between">
            <VenturaLogo href="/" />
            <Link href="/dashboard">
              <Button variant="secondary" size="sm" pill icon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 max-w-md w-full text-center shadow-lg space-y-5">
            {isUnrevealed ? (
              <Clock className="w-14 h-14 text-amber-500 mx-auto" />
            ) : (
              <ShieldAlert className="w-14 h-14 text-rose-500 mx-auto" />
            )}

            <div>
              <h2 className="text-xl font-bold font-display text-slate-900">
                {isUnderReview
                  ? 'Results Under Review'
                  : isUnrevealed
                  ? 'Results Pending Reveal'
                  : 'Access Restricted'}
              </h2>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                {errorStatus.message}
              </p>
            </div>

            <Link href="/dashboard" className="block pt-2">
              <Button variant="primary" size="md" pill className="w-full justify-center">
                Return to Dashboard
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const champion = results[0];
  const runnerUp = results[1];
  const thirdPlace = results[2];

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
          <VenturaLogo href="/" />
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
              ROOM: {room?.name || 'ARENA'}
            </span>
            <Link href="/dashboard">
              <Button variant="secondary" size="sm" pill icon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">
        {/* Banner */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100/80 text-violet-800 text-[11px] font-bold tracking-wider uppercase">
            <Sparkles size={12} className="fill-current text-violet-600" />
            OFFICIAL ARENA RESULTS
          </div>
          <h1 className="text-3xl sm:text-5xl font-display font-black text-slate-900 tracking-tight">
            {room?.name} Champions
          </h1>
          <p className="text-sm sm:text-base text-slate-500 font-medium">
            Discover the teams and innovative solutions that earned top investments in this competition arena.
          </p>
        </div>

        {/* Podium Stage */}
        {results.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 items-end">
            {/* 2nd Place */}
            {runnerUp && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-sm relative md:order-1"
              >
                <div className="absolute -top-4 left-6 px-3 py-1 rounded-full bg-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider shadow-xs">
                  #2 Silver Finalist
                </div>
                <div className="pt-2 space-y-2 mb-4">
                  <span className="font-mono text-xs text-slate-400 font-bold">{runnerUp.anonymousId}</span>
                  <h3 className="text-xl font-bold font-display text-slate-900">{runnerUp.teamName}</h3>
                  <p className="text-xs text-slate-500 font-medium line-clamp-2">{runnerUp.title}</p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono font-bold text-slate-700">
                  <span className="flex items-center gap-1 text-amber-600">
                    <CoinIcon size={14} /> {runnerUp.totalCoins.toLocaleString()} Coins
                  </span>
                  <span>{runnerUp.investorCount} Investors</span>
                </div>
              </motion.div>
            )}

            {/* 1st Place - Gold */}
            {champion && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="bg-linear-to-b from-amber-500/10 via-amber-500/5 to-white rounded-3xl p-8 border-2 border-amber-400 shadow-xl relative md:order-2 md:-translate-y-4 ring-4 ring-amber-400/20"
              >
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-amber-400 text-amber-950 font-black text-xs uppercase tracking-wider shadow-md flex items-center gap-1.5">
                  <Trophy size={14} className="fill-current" />
                  #1 Champion Winner
                </div>
                <div className="pt-3 text-center space-y-2 mb-6">
                  <span className="font-mono text-xs text-amber-600 font-bold block">{champion.anonymousId}</span>
                  <h3 className="text-2xl sm:text-3xl font-black font-display text-slate-900">{champion.teamName}</h3>
                  <p className="text-sm text-slate-600 font-medium">{champion.title}</p>
                  <span className="inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {champion.track}
                  </span>
                </div>

                {/* Team Members */}
                {champion.members && champion.members.length > 0 && (
                  <div className="mb-6 pt-3 border-t border-amber-200/50 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Team Roster
                    </span>
                    <div className="flex flex-wrap justify-center gap-1">
                      {champion.members.map((m, mIdx) => (
                        <span key={mIdx} className="text-xs px-2 py-0.5 rounded-md bg-white border border-amber-200 text-slate-800 font-medium">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-amber-200/60 flex items-center justify-between text-sm font-mono font-bold">
                  <span className="flex items-center gap-1.5 text-amber-600 text-base">
                    <CoinIcon size={18} /> {champion.totalCoins.toLocaleString()} Coins
                  </span>
                  <span className="text-slate-500">{champion.investorCount} Investors</span>
                </div>
              </motion.div>
            )}

            {/* 3rd Place */}
            {thirdPlace && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="bg-white rounded-3xl p-6 border-2 border-amber-700/20 shadow-sm relative md:order-3"
              >
                <div className="absolute -top-4 left-6 px-3 py-1 rounded-full bg-amber-700/80 text-white font-bold text-xs uppercase tracking-wider shadow-xs">
                  #3 Bronze Finalist
                </div>
                <div className="pt-2 space-y-2 mb-4">
                  <span className="font-mono text-xs text-slate-400 font-bold">{thirdPlace.anonymousId}</span>
                  <h3 className="text-xl font-bold font-display text-slate-900">{thirdPlace.teamName}</h3>
                  <p className="text-xs text-slate-500 font-medium line-clamp-2">{thirdPlace.title}</p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono font-bold text-slate-700">
                  <span className="flex items-center gap-1 text-amber-600">
                    <CoinIcon size={14} /> {thirdPlace.totalCoins.toLocaleString()} Coins
                  </span>
                  <span>{thirdPlace.investorCount} Investors</span>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Full Table */}
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-bold font-display text-slate-900">
              Complete Arena Leaderboard
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Ranked deterministically by total investment volume and unique backer count
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-6">Rank</th>
                  <th className="py-3.5 px-6">Idea ID</th>
                  <th className="py-3.5 px-6">Team &amp; Pitch</th>
                  <th className="py-3.5 px-6">Track</th>
                  <th className="py-3.5 px-6">Members</th>
                  <th className="py-3.5 px-6 text-right">Backers</th>
                  <th className="py-3.5 px-6 text-right">Total Coins</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {results.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 font-display font-black text-base">
                      #{r.rank}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs font-bold text-slate-700">
                      {r.anonymousId}
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-900">{r.teamName}</div>
                      <div className="text-xs text-slate-500">{r.title}</div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                        {r.track}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {r.members?.map((m, mIdx) => (
                          <span key={mIdx} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right font-mono text-slate-600">
                      {r.investorCount}
                    </td>
                    <td className="py-4 px-6 text-right font-mono font-bold text-[#635BFF] text-base">
                      <span className="inline-flex items-center gap-1">
                        <CoinIcon size={14} />
                        {r.totalCoins.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
