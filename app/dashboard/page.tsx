"use client";

import React from 'react';
import Link from 'next/link';
import { DashboardNav } from '@/components/navigation/DashboardNav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CoinIcon } from '@/components/brand/CoinIcon';
import { useVentura } from '@/lib/store';
import {
  Clock,
  ArrowDown,
  ArrowUp,
  Shield,
  ArrowRight,
  TrendingUp,
  Sparkles,
  PieChart,
  History,
} from 'lucide-react';

export default function ParticipantDashboardPage() {
  const { currentUser, eventConfig, wallet, getUserInvestments, ideas } = useVentura();
  const myInvestments = getUserInvestments(currentUser.id);

  React.useEffect(() => {
    if (currentUser?.role === 'ADMIN') {
      window.location.href = '/admin';
    }
  }, [currentUser?.role]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
      <DashboardNav />

      <main className="flex-1 py-6 sm:py-8 lg:py-10 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8 lg:space-y-10">
        {/* Top Section matching participant-dashboard.png */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column: Greeting & Parameters */}
          <div className="lg:col-span-8 space-y-6 sm:space-y-8">
            {/* Status Pill, Room Status & Session Valid */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {currentUser.roomName ? (
                <Badge
                  variant={
                    currentUser.roomStatus === 'OPEN'
                      ? 'live-teal'
                      : currentUser.roomStatus === 'PAUSED'
                      ? 'draft'
                      : currentUser.roomStatus === 'CLOSED' || currentUser.roomStatus === 'REVEALED'
                      ? 'live-purple'
                      : 'slate'
                  }
                  size="sm"
                  dot
                >
                  ROOM {currentUser.roomName.toUpperCase()}: {currentUser.roomStatus || 'DRAFT'}
                </Badge>
              ) : (
                <Badge variant="live-teal" size="sm" dot>
                  INVESTMENT STATUS: {eventConfig.status}
                </Badge>
              )}
              {currentUser.roomCode && (
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-[#635BFF] border border-purple-200">
                  {currentUser.roomCode}
                </span>
              )}
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 bg-slate-100/80 px-2.5 sm:px-3 py-1 rounded-full border border-slate-200/60">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Session Valid: {eventConfig.sessionValidUntil}
              </span>
            </div>

            {/* Welcome Back Header matching PITCH AND PROSPER specification */}
            <div>
              <div className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#635BFF] mb-1">
                PITCH AND PROSPER • CSEA IDEA INVESTMENT ARENA
              </div>
              <h1 className="font-display font-black text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-slate-900 tracking-tight leading-tight">
                Welcome back,
                <br />
                <span className="text-[#635BFF]">{currentUser.name}</span>
              </h1>
              <p className="mt-2.5 sm:mt-3 text-xs sm:text-sm md:text-base text-slate-600 font-normal max-w-2xl leading-relaxed">
                Manage your strategic capital and discover the next generation of breakthrough
                innovations under CSEA governance.
              </p>
            </div>

            {/* PLATFORM PARAMETERS Row matching screenshot */}
            <div>
              <h3 className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3 sm:mb-4">
                PLATFORM PARAMETERS
              </h3>
              {/* Responsive reflow: 1 col on mobile, 2 cols on split/tablet, 3 cols on desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {/* Total Budget Card */}
                <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-[#635BFF] flex items-center justify-center mb-4">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      TOTAL BUDGET
                    </span>
                    <div className="font-display font-black text-xl sm:text-2xl text-slate-900">
                      {eventConfig.totalBudget}{' '}
                      <span className="text-xs font-semibold text-slate-500">Coins</span>
                    </div>
                  </div>
                </div>

                {/* Min / Idea Card */}
                <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-2xl bg-[#E6FBF5] text-[#0F9D82] flex items-center justify-center mb-4">
                    <ArrowDown className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      MIN / IDEA
                    </span>
                    <div className="font-display font-black text-xl sm:text-2xl text-slate-900">
                      {eventConfig.minPerIdea}{' '}
                      <span className="text-xs font-semibold text-slate-500">Coins</span>
                    </div>
                  </div>
                </div>

                {/* Max / Idea Card */}
                <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
                  <div className="w-10 h-10 rounded-2xl bg-[#FFFBEB] text-[#D97706] flex items-center justify-center mb-4">
                    <ArrowUp className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      MAX / IDEA
                    </span>
                    <div className="font-display font-black text-xl sm:text-2xl text-slate-900">
                      {eventConfig.maxPerIdea}{' '}
                      <span className="text-xs font-semibold text-slate-500">Coins</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Sleek Dark Investment Wallet matching participant-dashboard.png */}
          <div className="lg:col-span-4 w-full">
            <div className="bg-[#111827] text-white rounded-3xl p-7 border border-slate-800 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                    CAPITAL CONTROL
                  </span>
                  <h3 className="font-display font-extrabold text-base text-white">
                    Investment Wallet
                  </h3>
                </div>
                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-[#22C7A9]">
                  <Shield className="w-4 h-4" />
                </div>
              </div>

              {/* Big Available Coins Callout */}
              <div className="text-center py-6 bg-[#182234] rounded-2xl border border-slate-800 mb-6">
                <div className="flex items-center justify-center gap-3">
                  <CoinIcon size={36} />
                  <span className="font-display font-black text-5xl text-white tracking-tight tabular-nums">
                    {wallet.remaining}
                  </span>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mt-2">
                  AVAILABLE COINS
                </span>
              </div>

              {/* Allocated / Remaining mini boxes */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 text-center">
                  <span className="text-[9px] font-bold uppercase text-slate-500 block">
                    ALLOCATED
                  </span>
                  <span className="font-display font-black text-lg text-white mt-0.5 block">
                    {wallet.allocated}
                  </span>
                </div>
                <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 text-center">
                  <span className="text-[9px] font-bold uppercase text-slate-500 block">
                    REMAINING
                  </span>
                  <span className="font-display font-black text-lg text-[#22C7A9] mt-0.5 block">
                    {wallet.remaining}
                  </span>
                </div>
              </div>

              {/* Deploy Capital CTA Button matching screenshot */}
              <Link href="/arena" className="block w-full">
                <Button
                  variant="primary"
                  size="lg"
                  pill
                  className="w-full justify-center py-3.5 shadow-[0_8px_24px_rgba(99,91,255,0.4)] text-sm font-bold"
                  iconRight={<ArrowRight className="w-4 h-4" />}
                >
                  Deploy Capital
                </Button>
              </Link>

              {/* Bottom security subtext matching screenshot */}
              <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  TRANSACTION SECURITY: AES-256
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Lower Section: My Portfolio Summary matching participant-dashboard.png */}
        <section className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 lg:p-8 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-6">
            <div>
              <h2 className="font-display font-black text-xl sm:text-2xl text-slate-900">
                My Portfolio Summary
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Real-time record of your deployed virtual capital. All teams remain shielded.
              </p>
            </div>
            <Link href="/portfolio" className="self-start sm:self-auto">
              <Button variant="outline" size="sm" pill iconRight={<ArrowRight className="w-4 h-4" />}>
                Detailed Portfolio
              </Button>
            </Link>
          </div>

          {myInvestments.length === 0 ? (
            <div className="text-center py-10 sm:py-12 border-2 border-dashed border-slate-100 rounded-2xl">
              <p className="text-slate-500 text-xs sm:text-sm font-medium mb-3">
                You have not deployed capital to any innovation opportunities yet.
              </p>
              <Link href="/arena">
                <Button variant="primary" size="sm" pill>
                  Explore Arena Ideas
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {myInvestments.map((inv) => {
                const targetIdea = ideas.find((i) => i.id === inv.ideaId);
                return (
                  <div
                    key={inv.id}
                    className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between hover:bg-slate-100/70 transition-colors"
                  >
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-[#635BFF] font-bold text-xs">
                          {targetIdea?.anonymousId || 'IDEA'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          {inv.dateFormatted}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {targetIdea?.solution}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-400">
                        COMMITTED
                      </span>
                      <div className="flex items-center gap-1.5 font-display font-extrabold text-slate-900 text-sm">
                        <CoinIcon size={16} />
                        <span>{inv.amount} Coins</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
