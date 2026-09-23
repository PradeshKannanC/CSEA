"use client";

import React from 'react';
import Link from 'next/link';
import { VenturaLogo } from '@/components/brand/VenturaLogo';
import { CoinBalancePill } from '@/components/brand/CoinBalancePill';
import { Button } from '@/components/ui/Button';
import { useVentura } from '@/lib/store';

export const LandingNav: React.FC = () => {
  const { isAuthenticated, currentUser } = useVentura();

  // Authoritative destination resolution
  const arenaDestination = !isAuthenticated
    ? '/login'
    : currentUser.role === 'ADMIN'
    ? '/admin'
    : currentUser.role === 'TEAM_LEADER' || currentUser.role === 'TEAM_MEMBER'
    ? '/team'
    : '/arena';

  const portfolioDestination = !isAuthenticated ? '/login' : '/portfolio';

  const accountLink = !isAuthenticated ? (
    <Link
      href="/login"
      className="text-xs sm:text-sm font-bold text-slate-800 hover:text-[#635BFF] transition-colors px-1 sm:px-2 py-1 shrink-0"
    >
      Login
    </Link>
  ) : (
    <Link
      href={arenaDestination}
      className="text-xs sm:text-sm font-bold text-slate-800 hover:text-[#635BFF] transition-colors px-1 sm:px-2 py-1 shrink-0"
    >
      {currentUser.role === 'ADMIN'
        ? 'Admin Console'
        : currentUser.role === 'TEAM_LEADER' || currentUser.role === 'TEAM_MEMBER'
        ? 'My Team'
        : 'Dashboard'}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100/80 transition-all">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-1.5 sm:gap-2">
        {/* Logo */}
        <VenturaLogo href="/" />

        {/* Center Nav Links */}
        <nav className="hidden lg:flex items-center gap-6 xl:gap-8" aria-label="Landing Navigation">
          <Link
            href={arenaDestination}
            className="text-sm font-semibold text-slate-700 hover:text-[#635BFF] transition-colors"
          >
            Arena
          </Link>
          <Link
            href="/how-it-works"
            className="text-sm font-semibold text-slate-700 hover:text-[#635BFF] transition-colors"
          >
            How It Works
          </Link>
          <Link
            href="/rules"
            className="text-sm font-semibold text-slate-700 hover:text-[#635BFF] transition-colors"
          >
            Rules
          </Link>
          <Link
            href={portfolioDestination}
            className="text-sm font-semibold text-slate-700 hover:text-[#635BFF] transition-colors"
          >
            Portfolio
          </Link>
        </nav>

        {/* Right CTA */}
        <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
          {isAuthenticated && (
            <div className="hidden md:block">
              <CoinBalancePill href={portfolioDestination} />
            </div>
          )}

          {accountLink}

          <Link href={arenaDestination} className="shrink-0">
            <Button variant="dark" size="sm" pill className="px-2.5 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm whitespace-nowrap">
              <span className="hidden min-[360px]:inline">Enter </span>Arena
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
};
