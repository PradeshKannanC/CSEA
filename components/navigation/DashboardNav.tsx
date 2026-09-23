"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { VenturaLogo } from '@/components/brand/VenturaLogo';
import { CoinBalancePill } from '@/components/brand/CoinBalancePill';
import { useVentura } from '@/lib/store';
import { AccountMenu } from '@/components/navigation/AccountMenu';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Menu, X, User as UserIcon, Shield, Trophy } from 'lucide-react';

export const DashboardNav: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, eventConfig, logout } = useVentura();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Arena', href: '/arena' },
    { name: 'Portfolio', href: '/portfolio' },
  ];

  if (currentUser.role === 'TEAM_LEADER' || currentUser.role === 'ADMIN') {
    navLinks.push({ name: 'Team Submission', href: '/team-submission' });
  } else if (currentUser.teamId) {
    navLinks.push({ name: 'My Team', href: '/team' });
  }

  if (eventConfig.status === 'REVEALED' || currentUser.roomStatus === 'REVEALED' || currentUser.role === 'ADMIN') {
    navLinks.push({ name: 'Results Reveal', href: '/results' });
  }

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-[0_1px_8px_rgba(0,0,0,0.02)] transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
        {/* Left: Brand Logo & Desktop Nav Links */}
        <div className="flex items-center gap-3 sm:gap-6 lg:gap-8 min-w-0">
          <VenturaLogo href="/dashboard" />

          {/* Desktop Nav Links (Visible on large screens) */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5" aria-label="Main Navigation">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href === '/team-submission' && pathname.startsWith('/team/submission'));
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`px-3 xl:px-4 py-2 rounded-full text-xs xl:text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? 'text-[#635BFF] bg-indigo-50/70 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
            {currentUser.role === 'ADMIN' && (
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-full text-[11px] xl:text-xs font-bold uppercase tracking-wider text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors ml-1 whitespace-nowrap"
              >
                Admin Console
              </Link>
            )}
          </nav>
        </div>

        {/* Right Nav Items: Desktop Layout */}
        <div className="hidden lg:flex items-center gap-3 xl:gap-4 shrink-0">
          {/* Virtual Coin Balance Pill */}
          <CoinBalancePill href="/portfolio" />

          {/* Real-time Notifications Bell */}
          <NotificationBell theme="light" />

          {/* Role-Aware Account Menu Popover */}
          <AccountMenu theme="light" />
        </div>

        {/* Mobile / Tablet / Split-Screen Controls (< 1024px) */}
        <div className="flex lg:hidden items-center gap-1.5 sm:gap-2 shrink-0">
          <CoinBalancePill href="/portfolio" />

          {/* Real-time Notifications Bell */}
          <NotificationBell theme="light" />

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 sm:p-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF]"
            aria-label="Toggle Navigation Menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation (< 1024px) */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-100 bg-white px-4 pt-3 pb-5 space-y-1.5 shadow-lg animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between p-3 mb-2 rounded-2xl bg-amber-50/70 border border-amber-200/50">
            <span className="text-xs font-bold text-amber-900">Virtual Balance</span>
            <CoinBalancePill href="/portfolio" />
          </div>

          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  isActive ? 'bg-indigo-50 text-[#635BFF]' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {link.name}
              </Link>
            );
          })}

          {currentUser.role === 'ADMIN' && (
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-2.5 rounded-xl text-sm font-bold text-rose-700 bg-rose-50 border border-rose-100"
            >
              Admin Console
            </Link>
          )}

          {/* User Profile & Logout inside Mobile Drawer */}
          <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-full bg-indigo-100 text-[#635BFF] font-bold text-xs flex items-center justify-center shrink-0">
                {currentUser.avatarInitials}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-800 truncate">{currentUser.name}</div>
                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                  {currentUser.role}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-full bg-[#111827] text-white text-xs font-bold shrink-0 hover:bg-black transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
