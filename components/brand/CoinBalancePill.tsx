"use client";

import React from 'react';
import Link from 'next/link';
import { CoinToken } from './CoinToken';
import { NumberTicker } from '@/components/animation/NumberTicker';
import { useVentura } from '@/lib/store';

interface CoinBalancePillProps {
  label?: string;
  href?: string;
  className?: string;
}

export const CoinBalancePill: React.FC<CoinBalancePillProps> = ({
  label,
  href = '/portfolio',
  className = '',
}) => {
  const { wallet, isMounted, isAuthenticated } = useVentura();

  const balance = wallet.availableCoins ?? wallet.remaining;
  const isLoaded = isMounted && (wallet.userId !== '' || !isAuthenticated);

  const content = (
    <div
      className={`inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3.5 py-0.5 sm:py-1.5 rounded-full bg-[#FFFBEB] border border-[#FDE68A]/60 shadow-[0_1px_4px_rgba(245,185,66,0.12)] hover:bg-[#FEF3C7]/80 transition-colors duration-200 cursor-pointer select-none group shrink-0 ${className}`}
    >
      <CoinToken size="xs" className="group-hover:rotate-12 transition-transform duration-200 shrink-0" />
      <div className="flex items-center gap-1">
        {!isLoaded ? (
          <span className="text-[10px] sm:text-xs font-semibold text-slate-500 animate-pulse">
            Loading wallet...
          </span>
        ) : isAuthenticated && !wallet.userId && wallet.totalBudget === 0 ? (
          <span className="text-[10px] sm:text-xs font-semibold text-amber-700">
            Wallet unavailable
          </span>
        ) : (
          <>
            <span className="font-display font-bold text-slate-800 text-xs sm:text-sm tracking-tight tabular-nums">
              <NumberTicker value={balance} />
            </span>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-600 hidden xs:inline">
              {label || 'Coins'}
            </span>
          </>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ventura-gold rounded-full">
        {content}
      </Link>
    );
  }

  return content;
};
