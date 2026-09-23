"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useVentura } from '@/lib/store';
import {
  LayoutDashboard,
  Users,
  Shield,
  Lightbulb,
  Sliders,
  Trophy,
  FileText,
  PieChart,
  Sparkles,
  AlertCircle,
  LogOut,
  ChevronDown,
  User as UserIcon,
} from 'lucide-react';
import { EASE_PREMIUM } from '@/lib/motion';

interface AccountMenuProps {
  theme?: 'light' | 'dark';
  className?: string;
  onOpenReportIssue?: () => void;
}

export const AccountMenu: React.FC<AccountMenuProps> = ({
  theme = 'light',
  className = '',
  onOpenReportIssue,
}) => {
  const { currentUser, logout, isAuthenticated } = useVentura();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
  };

  // Do not render dropdown trigger if completely unauthenticated
  if (!isAuthenticated && (!currentUser.id || currentUser.role === 'GUEST')) {
    return (
      <Link
        href="/login"
        className="px-4 py-1.5 rounded-full bg-[#635BFF] text-white text-xs font-bold hover:bg-[#5046E5] transition-colors"
      >
        Sign In
      </Link>
    );
  }

  // Role Badge Styling
  const getRoleBadge = () => {
    switch (currentUser.role) {
      case 'ADMIN':
        return {
          label: 'ADMINISTRATOR',
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
          ringClass: 'ring-rose-400',
        };
      case 'TEAM_LEADER':
        return {
          label: 'TEAM LEADER',
          badgeClass: 'bg-indigo-100 text-[#635BFF] border-indigo-200',
          ringClass: 'ring-[#635BFF]',
        };
      case 'TEAM_MEMBER':
        return {
          label: 'TEAM MEMBER',
          badgeClass: 'bg-emerald-100 text-[#0F9D82] border-emerald-200',
          ringClass: 'ring-[#22C7A9]',
        };
      case 'INVESTOR':
      default:
        return {
          label: 'INVESTOR',
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
          ringClass: 'ring-amber-400',
        };
    }
  };

  const roleInfo = getRoleBadge();

  return (
    <div ref={menuRef} className={`relative select-none ${className}`}>
      {/* Interactive Account / Profile Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="User Account Menu"
        className={`flex items-center gap-2 sm:gap-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF] ${
          theme === 'dark'
            ? 'bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-700'
            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/80 shadow-2xs'
        } ${isOpen ? 'ring-2 ring-[#635BFF]/30' : ''}`}
      >
        {/* User Initials Avatar with Role Ring */}
        <div
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-display font-extrabold text-xs shrink-0 shadow-xs ring-2 ${roleInfo.ringClass} ${
            theme === 'dark'
              ? 'bg-slate-700 text-white'
              : 'bg-indigo-50 text-[#635BFF]'
          }`}
        >
          {currentUser.avatarInitials || 'U'}
        </div>

        {/* Desktop Name & Role Label */}
        <div className="hidden md:flex flex-col text-left min-w-0 pr-1">
          <span
            className={`text-xs font-bold truncate max-w-[120px] leading-tight ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}
          >
            {currentUser.name}
          </span>
          <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider leading-none mt-0.5">
            {currentUser.role.replace('_', ' ')}
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-[#635BFF]' : ''
          }`}
        />
      </button>

      {/* Popover Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 4 }}
            transition={{ duration: 0.2, ease: EASE_PREMIUM }}
            className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white border border-slate-100 shadow-[0_12px_40px_rgba(17,24,39,0.12)] p-2 z-50 text-left"
            role="menu"
            aria-orientation="vertical"
          >
            {/* Header: User Profile Info */}
            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-100 mb-1.5 flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-display font-extrabold text-sm shrink-0 ring-2 ${roleInfo.ringClass} bg-white text-[#635BFF] shadow-xs`}
              >
                {currentUser.avatarInitials || 'U'}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="font-display font-black text-sm text-slate-900 truncate">
                    {currentUser.name}
                  </h4>
                  <span
                    className={`text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${roleInfo.badgeClass}`}
                  >
                    {roleInfo.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">{currentUser.email}</p>

                {currentUser.teamId && (
                  <div className="mt-1 text-[10px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200/80 inline-block truncate max-w-full">
                    Team: {currentUser.teamName || currentUser.teamId}
                  </div>
                )}
              </div>
            </div>

            {/* Role-Specific Navigation Links */}
            <div className="py-1 space-y-0.5 text-xs font-semibold text-slate-700">
              {/* ================= ADMIN MENU ================= */}
              {currentUser.role === 'ADMIN' && (
                <>
                  <Link
                    href="/admin"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4 text-[#635BFF]" />
                    <span>Admin Dashboard</span>
                  </Link>

                  <Link
                    href="/admin/users"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    <Users className="w-4 h-4 text-slate-500" />
                    <span>User Management</span>
                  </Link>

                  <Link
                    href="/admin/teams"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    <Shield className="w-4 h-4 text-slate-500" />
                    <span>Team Management</span>
                  </Link>

                  <Link
                    href="/admin/ideas"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    <Lightbulb className="w-4 h-4 text-slate-500" />
                    <span>Ideas Management</span>
                  </Link>

                  <Link
                    href="/admin/settings"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    <Sliders className="w-4 h-4 text-slate-500" />
                    <span>Event Settings</span>
                  </Link>
                </>
              )}

              {/* ================= TEAM LEADER MENU ================= */}
              {currentUser.role === 'TEAM_LEADER' && (
                <>
                  <Link
                    href="/team"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4 text-[#635BFF]" />
                    <span>Team Dashboard</span>
                  </Link>

                  <Link
                    href="/team"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    <Users className="w-4 h-4 text-slate-500" />
                    <span>My Team Roster</span>
                  </Link>

                  <Link
                    href="/team/submission"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-[#22C7A9]" />
                    <span>My Submission (Proposal Editor)</span>
                  </Link>
                </>
              )}

              {/* ================= TEAM MEMBER MENU ================= */}
              {currentUser.role === 'TEAM_MEMBER' && (
                <>
                  <Link
                    href="/team"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4 text-[#635BFF]" />
                    <span>Team Dashboard</span>
                  </Link>

                  <Link
                    href="/team"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    <Users className="w-4 h-4 text-slate-500" />
                    <span>My Team Roster</span>
                  </Link>

                  <Link
                    href="/team/submission"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-[#0F9D82]" />
                    <span>View Team Idea</span>
                  </Link>

                  <Link
                    href="/team/submission?action=report-issue"
                    onClick={() => {
                      setIsOpen(false);
                      if (onOpenReportIssue) onOpenReportIssue();
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-amber-50 text-amber-700 transition-colors"
                  >
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span>Report Issue</span>
                  </Link>
                </>
              )}

              {/* ================= INVESTOR MENU ================= */}
              {currentUser.role === 'INVESTOR' && (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4 text-[#635BFF]" />
                    <span>Participant Dashboard</span>
                  </Link>

                  <Link
                    href="/arena"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    <Sparkles className="w-4 h-4 text-[#F5B942]" />
                    <span>Investment Arena</span>
                  </Link>

                  <Link
                    href="/portfolio"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    <PieChart className="w-4 h-4 text-[#22C7A9]" />
                    <span>My Portfolio</span>
                  </Link>
                </>
              )}
            </div>

            {/* Bottom Actions: Log out */}
            <div className="pt-1.5 mt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  <span>{isLoggingOut ? 'Signing out...' : 'Log out'}</span>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
                  {currentUser.role}
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
