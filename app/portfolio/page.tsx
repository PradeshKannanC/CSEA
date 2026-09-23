"use client";

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { DashboardNav } from '@/components/navigation/DashboardNav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CoinIcon } from '@/components/brand/CoinIcon';
import { CoinToken } from '@/components/brand/CoinToken';
import { NumberTicker } from '@/components/animation/NumberTicker';
import { EASE_PREMIUM } from '@/lib/motion';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useVentura } from '@/lib/store';
import {
  Shield,
  Lightbulb,
  Cpu,
  Lock,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export default function PortfolioPage() {
  const { currentUser, wallet, getUserInvestments, ideas, eventConfig } = useVentura();
  const allUserInvestments = getUserInvestments(currentUser.id);
  const investments = currentUser.roomId
    ? allUserInvestments.filter((i) => i.roomId === currentUser.roomId)
    : allUserInvestments;

  const totalAllocatedCoins = wallet.allocatedCoins ?? wallet.totalBudget ?? eventConfig.totalBudget ?? 0;
  const investedCoins = wallet.investedCoins ?? wallet.allocated ?? 0;
  const availableCoins = wallet.availableCoins ?? wallet.remaining ?? Math.max(0, totalAllocatedCoins - investedCoins);

  const activePositionsCount = investments.length;
  const progressPercent = totalAllocatedCoins > 0
    ? Math.min(100, Math.round((investedCoins / totalAllocatedCoins) * 100))
    : 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
      <DashboardNav />

      <main className="flex-1 py-6 sm:py-8 lg:py-10 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8 lg:space-y-10">
        {/* Title Header matching PITCH AND PROSPER specification */}
        <div>
          <div className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-[#635BFF] mb-1">
            PITCH AND PROSPER by CSEA
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight">
            MY PORTFOLIO
          </h1>
          <p className="mt-1 text-xs sm:text-sm md:text-base text-slate-600 font-normal">
            Review and manage your allocations. All team data remains shielded.
          </p>
        </div>

        {/* 3 Metric Cards matching portfolio.png */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-6">
          {/* Card 1: Total Allocated */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-center sm:text-left flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5 sm:mb-2">
              TOTAL ALLOCATED
            </span>
            <div>
              <span className="font-display font-black text-3xl sm:text-4xl text-slate-900 tabular-nums">
                <NumberTicker value={investedCoins} />
              </span>
              <span className="text-xs font-semibold text-slate-500 ml-2">Coins</span>
            </div>
          </div>

          {/* Card 2: Remaining Balance */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-center sm:text-left flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5 sm:mb-2">
              REMAINING BALANCE
            </span>
            <div>
              <span className="font-display font-black text-3xl sm:text-4xl text-[#22C7A9] tabular-nums">
                <NumberTicker value={availableCoins} />
              </span>
              <span className="text-xs font-semibold text-slate-500 ml-2">Coins</span>
            </div>
          </div>

          {/* Card 3: Active Positions */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-center sm:text-left flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5 sm:mb-2">
              ACTIVE POSITIONS
            </span>
            <div>
              <span className="font-display font-black text-3xl sm:text-4xl text-[#635BFF] tabular-nums">
                <NumberTicker
                  value={activePositionsCount}
                  formatNumber={(val) => (val < 10 ? `0${val}` : `${val}`)}
                />
              </span>
              <span className="text-xs font-semibold text-slate-500 ml-2">Units</span>
            </div>
          </div>
        </div>

        {/* 2-Column Section matching portfolio.png */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left: ACTIVE DIGITAL ASSETS list */}
          <div className="lg:col-span-8 bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 lg:p-8 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                ACTIVE DIGITAL ASSETS
              </h3>
              <Badge variant="shield" icon={<Shield className="w-3.5 h-3.5" />}>
                IDENTITY SHIELDED
              </Badge>
            </div>

            {investments.length === 0 ? (
              <EmptyState
                icon={<Lightbulb className="w-6 h-6 text-[#635BFF]" />}
                title="No investments yet"
                description="You have not yet committed any virtual coins to anonymous ideas in this event. Explore the arena to back breakthrough innovations."
                actionLabel="Go to Investment Arena"
                actionHref="/arena"
                className="py-12 border-0 shadow-none"
              />
            ) : (
              <div className="space-y-4">
                {investments.map((inv, idx) => {
                  const targetIdea = inv.idea || ideas.find((i) => i.id === inv.ideaId);
                  const isLightbulb = idx % 2 === 0;

                  return (
                    <motion.div
                      key={inv.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: idx * 0.08, ease: EASE_PREMIUM }}
                      className="p-5 rounded-2xl bg-slate-50/70 border border-slate-100/90 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      {/* Left: Icon & Idea Meta */}
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                            isLightbulb
                              ? 'bg-indigo-100/70 text-[#635BFF]'
                              : 'bg-[#E6FBF5] text-[#0F9D82]'
                          }`}
                        >
                          {isLightbulb ? (
                            <Lightbulb className="w-6 h-6" />
                          ) : (
                            <Cpu className="w-6 h-6" />
                          )}
                        </div>

                        <div>
                          <div className="font-display font-black text-lg text-slate-900">
                            {targetIdea?.anonymousId || 'IDEA'}
                          </div>
                          <div className="text-xs text-slate-500 font-medium">
                            {targetIdea?.track || 'Innovation Track'}
                          </div>
                        </div>
                      </div>

                      {/* Right: Allocation date & amount matching screenshot */}
                      <div className="flex items-center justify-between sm:justify-end gap-8 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-200/50">
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            ALLOCATION DATE
                          </span>
                          <span className="text-xs font-semibold text-slate-700">
                            {inv.dateFormatted}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            INVESTMENT
                          </span>
                          <div className="flex items-center gap-1.5 font-display font-black text-lg text-slate-900">
                            <span>{inv.amount}</span>
                            <CoinToken size="sm" />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column matching portfolio.png */}
          <div className="lg:col-span-4 space-y-6">
            {/* Card 1: ACCOUNT SUMMARY (Dark Card) */}
            <div className="bg-[#111827] text-white rounded-3xl p-7 border border-slate-800 shadow-xl space-y-6">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                ACCOUNT SUMMARY
              </span>

              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Total Distributed</span>
                  <span className="font-bold text-white">{totalAllocatedCoins} Coins</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Total Invested</span>
                  <span className="font-bold text-white">{investedCoins} Coins</span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-medium">Available Now</span>
                  <div className="flex items-center gap-1 font-display font-black text-2xl text-[#22C7A9]">
                    <span>{availableCoins}</span>
                    <CoinIcon size={20} />
                  </div>
                </div>
              </div>

              <Link href="/arena" className="block w-full">
                <Button
                  variant="secondary"
                  size="md"
                  pill
                  className="w-full justify-center py-3 text-xs font-bold text-slate-900 bg-white hover:bg-slate-100"
                >
                  Back to Arena
                </Button>
              </Link>
            </div>

            {/* Card 2: INVESTMENT INTEGRITY (White Card) */}
            <div className="bg-white rounded-3xl p-7 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0F9D82]">
                <Shield className="w-4 h-4" />
                <span>INVESTMENT INTEGRITY</span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Competitive data including rankings and totals are hidden to ensure unbiased
                evaluation until the official reveal ceremony.
              </p>

              <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <Lock className="w-3.5 h-3.5" />
                <span>VERIFIED SECURE</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
