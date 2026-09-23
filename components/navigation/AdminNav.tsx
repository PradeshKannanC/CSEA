"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { VenturaLogo } from '@/components/brand/VenturaLogo';
import { useVentura } from '@/lib/store';

import { AccountMenu } from '@/components/navigation/AccountMenu';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export const AdminNav: React.FC = () => {
  const pathname = usePathname();
  const { eventConfig, currentUser } = useVentura();

  if (currentUser?.role !== 'ADMIN') {
    return null;
  }

  const links = [
    { name: 'Control Center', href: '/admin' },
    { name: 'Users', href: '/admin/users' },
    { name: 'Teams', href: '/admin/teams' },
    { name: 'Rooms', href: '/admin/rooms' },
    { name: 'Ideas', href: '/admin/ideas' },
    { name: 'Investments', href: '/admin/investments' },
    { name: 'Settings', href: '/admin/settings' },
    { name: 'Results Stage', href: '/admin/results' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#111827] text-white border-b border-slate-800 shadow-xl transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
        {/* Brand */}
        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
          <VenturaLogo theme="dark" isAdmin={true} href="/admin" />

          {/* Nav links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5 pl-4 border-l border-slate-800" aria-label="Admin Navigation">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-inner border border-slate-700'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Admin Navigation */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Real-time Notifications */}
          <NotificationBell theme="dark" />

          {/* Role-Aware Admin Account Menu */}
          <div className="pl-1 border-l border-slate-800">
            <AccountMenu theme="dark" />
          </div>
        </div>
      </div>

      {/* Subnav on mobile/tablet */}
      <div className="lg:hidden border-t border-slate-800 bg-slate-900/90 overflow-x-auto px-3 sm:px-4 py-2 flex items-center gap-2 scrollbar-none touch-pan-x">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`shrink-0 px-3 py-1 rounded-lg text-xs font-medium ${
                isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {link.name}
            </Link>
          );
        })}
      </div>
    </header>
  );
};
