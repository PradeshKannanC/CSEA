"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShieldAlert, ArrowLeft, LogIn, Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useVentura } from '@/lib/store';

interface AccessRestrictedViewProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

export function AccessRestrictedView({ user }: AccessRestrictedViewProps) {
  const { currentUser } = useVentura();
  const effectiveUser = user || currentUser;
  const isGuest = !effectiveUser?.id || effectiveUser?.role === 'GUEST';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F8FC] px-4 text-center select-none py-12">
      <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200/80 shadow-[0_12px_40px_rgba(0,0,0,0.06)] max-w-md w-full flex flex-col items-center">
        {/* Official TCE CSEA Emblem */}
        <div className="w-16 h-16 rounded-full bg-white p-1 border border-slate-200 shadow-xs mb-4 flex items-center justify-center">
          <Image
            src="/branding/tce-csea-logo.png"
            alt="TCE CSEA"
            width={64}
            height={64}
            className="rounded-full object-contain"
          />
        </div>

        {/* Unauthorized Status Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold uppercase tracking-wider border border-rose-200 mb-3">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
          <span>{isGuest ? 'AUTHENTICATION REQUIRED' : 'UNAUTHORIZED CORRIDOR'}</span>
        </div>

        <h1 className="font-display font-black text-2xl text-slate-900 tracking-tight mb-2 flex items-center justify-center gap-2">
          <span>❌</span>
          <span>Access Restricted</span>
        </h1>

        <p className="text-xs text-slate-500 leading-relaxed mb-6">
          {isGuest
            ? 'Administrator credentials are required to view the Arena Control Center. Please sign in with an administrator account.'
            : `Administrative clearance is required to view the Arena Control Center. Your current account (${effectiveUser.name}) holds the ${effectiveUser.role} role and cannot access administrative tools.`}
        </p>

        {/* Access Flow Diagnostic Pipeline */}
        <div className="w-full bg-slate-50 border border-slate-200/90 rounded-2xl p-4 mb-6 text-left">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-3 text-center font-bold">
            AUTHORIZATION GATE EVALUATION
          </div>

          <div className="flex flex-col items-center space-y-1.5 text-xs">
            {/* Step 1: Current Account */}
            <div className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <span className="text-slate-500 font-medium text-[11px]">Current account</span>
              <span className="font-bold text-slate-800 text-xs truncate max-w-[180px]">
                {isGuest ? 'Not Signed In' : (effectiveUser?.name || 'Anonymous User')}
              </span>
            </div>

            {/* Arrow */}
            <div className="text-slate-400 font-black text-xs leading-none select-none">↓</div>

            {/* Step 2: Role */}
            <div className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <span className="text-slate-500 font-medium text-[11px]">Account role</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-black text-[11px] border ${
                isGuest
                  ? 'bg-slate-100 text-slate-700 border-slate-200'
                  : 'bg-amber-100 text-amber-900 border-amber-200'
              }`}>
                {isGuest ? 'GUEST / NONE' : (effectiveUser?.role || 'INVESTOR')}
              </span>
            </div>

            {/* Arrow */}
            <div className="text-slate-400 font-black text-xs leading-none select-none">↓</div>

            {/* Step 3: Target Resource */}
            <div className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <span className="text-slate-500 font-medium text-[11px]">Trying to access</span>
              <span className="font-bold text-slate-700 text-xs">
                Arena Control Center
              </span>
            </div>

            {/* Arrow */}
            <div className="text-slate-400 font-black text-xs leading-none select-none">↓</div>

            {/* Step 4: Requirement */}
            <div className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <span className="text-slate-500 font-medium text-[11px]">Requires</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-black text-[11px] border border-indigo-200">
                ADMIN
              </span>
            </div>

            {/* Arrow */}
            <div className="text-slate-400 font-black text-xs leading-none select-none">↓</div>

            {/* Step 5: Result */}
            <div className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-black text-xs shadow-2xs">
              <span>❌</span>
              <span>Access Restricted</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 w-full">
          {isGuest ? (
            <Link href="/login?redirect=/admin" className="w-full block">
              <Button
                variant="primary"
                size="md"
                pill
                className="w-full justify-center"
                icon={<LogIn className="w-4 h-4" />}
              >
                Sign In as Administrator
              </Button>
            </Link>
          ) : (
            <>
              {effectiveUser.role === 'TEAM_LEADER' || effectiveUser.role === 'TEAM_MEMBER' ? (
                <Link href="/team" className="w-full block">
                  <Button
                    variant="primary"
                    size="md"
                    pill
                    className="w-full justify-center"
                    icon={<ArrowLeft className="w-4 h-4" />}
                  >
                    Go to Team Workspace
                  </Button>
                </Link>
              ) : (
                <Link href="/dashboard" className="w-full block">
                  <Button
                    variant="primary"
                    size="md"
                    pill
                    className="w-full justify-center"
                    icon={<ArrowLeft className="w-4 h-4" />}
                  >
                    Return to Dashboard
                  </Button>
                </Link>
              )}

              <Link href="/login?redirect=/admin" className="w-full block">
                <button className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors active:scale-95">
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Switch to Admin Account</span>
                </button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}