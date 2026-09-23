"use client";

import React from 'react';
import Link from 'next/link';
import { useVentura } from '@/lib/store';
import { CoinIcon } from '@/components/brand/CoinIcon';
import { CoinToken } from '@/components/brand/CoinToken';
import { NumberTicker } from '@/components/animation/NumberTicker';
import { Button } from '@/components/ui/Button';
import { Shield, ArrowRight, History, PieChart } from 'lucide-react';

interface WalletCardProps {
  showQuickDeploy?: boolean;
}

export const WalletCard: React.FC<WalletCardProps> = ({ showQuickDeploy = false }) => {
  const { wallet, eventConfig, currentUser, getUserInvestments, ideas, isMounted, isAuthenticated } = useVentura();
  const allInvestments = getUserInvestments(currentUser.id);
  const investments = currentUser.roomId
    ? allInvestments.filter((i) => i.roomId === currentUser.roomId)
    : allInvestments;

  const allocated = wallet.allocatedCoins ?? wallet.totalBudget ?? eventConfig.totalBudget;
  const invested = wallet.investedCoins ?? wallet.allocated ?? 0;
  const available = wallet.availableCoins ?? wallet.remaining ?? Math.max(0, allocated - invested);

  const allocationPercent = allocated > 0 ? Math.min(100, Math.round((invested / allocated) * 100)) : 0;
  const isLoaded = isMounted && (wallet.userId !== '' || !isAuthenticated);

  return (
    <div className="space-y-6">
      {/* Sleek Dark Investment Wallet */}
      <div className="bg-[#111827] text-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-slate-800 shadow-2xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-[#635BFF]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between mb-5 sm:mb-6">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
              CAPITAL CONTROL
            </span>
            <h3 className="font-display font-extrabold text-sm sm:text-base text-white tracking-tight">
              Your Investment Wallet
            </h3>
          </div>
          <div className="w-8 h-8 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-[#22C7A9] shrink-0">
            <Shield className="w-4 h-4" />
          </div>
        </div>

        {/* Big Balance Callout */}
        <div className="text-center py-4 bg-[#1E293B]/40 rounded-2xl border border-slate-800/70 mb-5 sm:mb-6">
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            <CoinToken size={32} showGlow />
            {!isLoaded ? (
              <span className="text-sm font-semibold text-slate-400 animate-pulse">
                Loading wallet...
              </span>
            ) : isAuthenticated && !wallet.userId && wallet.totalBudget === 0 ? (
              <span className="text-sm font-semibold text-amber-400">
                Wallet unavailable
              </span>
            ) : (
              <span className="font-display font-black text-4xl sm:text-5xl text-white tracking-tight tabular-nums">
                <NumberTicker value={available} />
              </span>
            )}
          </div>
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block mt-2">
            Available virtual coins
          </span>
        </div>

        {/* Breakdown row */}
        <div className="space-y-3 mb-5 sm:mb-6">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">Total Allocated</span>
            <span className="font-bold text-white">
              {allocated} Coins
            </span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">Invested Capital</span>
            <span className="font-bold text-white">
              <NumberTicker value={invested} /> Coins
            </span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">Remaining Available</span>
            <span className="font-bold text-[#22C7A9]">
              <NumberTicker value={available} /> Coins
            </span>
          </div>

          {/* Allocation Progress Bar */}
          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mt-2">
            <div
              className="h-full bg-gradient-to-r from-[#635BFF] to-[#22C7A9] transition-all duration-500 rounded-full"
              style={{ width: `${allocationPercent}%` }}
            />
          </div>
        </div>

        {/* Action Button if enabled (as in participant-dashboard.png) */}
        {showQuickDeploy && (
          <div className="mb-4">
            <Link href="/arena" className="block w-full">
              <Button
                variant="primary"
                size="md"
                pill
                className="w-full justify-center shadow-[0_6px_20px_rgba(99,91,255,0.4)] min-h-[44px]"
                iconRight={<ArrowRight className="w-4 h-4" />}
              >
                Deploy Capital
              </Button>
            </Link>
          </div>
        )}

        {/* Security / Parameter Footnote */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span>MIN: {currentUser.roomMinInvestment ?? eventConfig.minPerIdea} | MAX: {currentUser.roomMaxInvestment ?? eventConfig.maxPerIdea} PER IDEA</span>
          <span className="text-slate-500">AES-256</span>
        </div>
      </div>

      {/* Active Investments Sub-Card matching invsetment-arena.png */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            MY INVESTMENTS
          </h4>
          <span className="text-xs font-semibold text-slate-500">
            {investments.length} Active
          </span>
        </div>

        {investments.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs font-medium">
            No capital deployed yet. Select an idea to invest.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {investments.slice(0, 4).map((inv) => {
              const target = ideas.find((i) => i.id === inv.ideaId);
              return (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900">
                      {target?.anonymousId || 'IDEA'}
                    </div>
                    <div className="text-[10px] text-slate-400">{inv.dateFormatted}</div>
                  </div>
                  <div className="flex items-center gap-1 font-bold text-slate-800">
                    <CoinIcon size={14} />
                    <span>{inv.amount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-slate-100 text-center">
          <Link
            href="/portfolio"
            className="text-xs font-bold text-[#635BFF] hover:text-[#5046E5] inline-flex items-center gap-1"
          >
            <span>View Full Portfolio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};
