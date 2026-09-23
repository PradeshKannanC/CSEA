"use client";

import React from 'react';
import Link from 'next/link';
import { LandingNav } from '@/components/navigation/LandingNav';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ShieldAlert, Check, X, Scale, Lock, Clock } from 'lucide-react';
import { useVentura } from '@/lib/store';

export default function RulesPage() {
  const { isAuthenticated, currentUser } = useVentura();
  const arenaDestination = !isAuthenticated || !currentUser
    ? '/login'
    : currentUser.role === 'ADMIN'
      ? '/admin'
      : (currentUser.role === 'TEAM_LEADER' || currentUser.role === 'TEAM_MEMBER')
        ? '/team'
        : '/dashboard';

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
      <LandingNav />

      <main className="flex-1 py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge variant="live-teal" size="sm" className="mb-3">
            GOVERNANCE & INTEGRITY
          </Badge>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl text-slate-900 tracking-tight">
            Official Arena Rules
          </h1>
          <p className="mt-4 text-slate-600 text-base sm:text-lg max-w-2xl mx-auto">
            Strict cryptographic and procedural rules enforced across all participants, team
            leaders, and syndicate investors.
          </p>
        </div>

        <div className="space-y-8">
          {/* Rule 1: Self-Investment Protection */}
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold text-xl text-slate-900">
                    1. Absolute Self-Investment Prohibition
                  </h3>
                  <Badge variant="admin">Enforced by Server</Badge>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Participants are strictly forbidden from investing virtual coins into their own
                  team&apos;s submitted idea. To preserve identity shielding, the user interface
                  displays a generic <em className="text-slate-800 font-semibold">&ldquo;This opportunity isn&apos;t available to your account&rdquo;</em> notice rather than disclosing the team relationship.
                </p>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-700 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Server-side validator verifies author team ID and rejects any illicit transaction attempt.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Rule 2: Capital Constraints */}
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Scale className="w-6 h-6" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold text-xl text-slate-900">
                    2. Capital Caps & Allocation Limits
                  </h3>
                  <Badge variant="gold">100 Coins Total</Badge>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Each participant receives an immutable wallet of 100 virtual coins upon check-in.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                      MINIMUM ALLOCATION
                    </span>
                    <span className="font-display font-extrabold text-xl text-slate-900">
                      10 Coins
                    </span>
                    <p className="text-xs text-slate-500 mt-1">Prevents micro-vote dusting.</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                      MAXIMUM ALLOCATION
                    </span>
                    <span className="font-display font-extrabold text-xl text-slate-900">
                      50 Coins
                    </span>
                    <p className="text-xs text-slate-500 mt-1">Prevents all-in single-asset betting.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Rule 3: Shielding and Reveal */}
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-[#635BFF] flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold text-xl text-slate-900">
                    3. Irreversible Finality & Staged Unmasking
                  </h3>
                  <Badge variant="live-purple">Ceremony Protocol</Badge>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Once confirmed, coin deployments are logged to the transaction ledger and cannot
                  be refunded or transferred. When the arena closes, rankings remain hidden from
                  participants until the administrator triggers the official results ceremony.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link href={arenaDestination}>
            <Button variant="primary" size="lg" pill className="px-8">
              Proceed to Investment Arena
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
