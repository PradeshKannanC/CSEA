"use client";

import React from 'react';
import Link from 'next/link';
import { LandingNav } from '@/components/navigation/LandingNav';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Shield, EyeOff, Coins, Trophy, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useVentura } from '@/lib/store';

export default function HowItWorksPage() {
  const { isAuthenticated, currentUser } = useVentura();
  const arenaDestination = !isAuthenticated
    ? '/login'
    : currentUser.role === 'ADMIN'
    ? '/admin'
    : currentUser.role === 'TEAM_LEADER' || currentUser.role === 'TEAM_MEMBER'
    ? '/team'
    : '/arena';
  const steps = [
    {
      num: '01',
      icon: <EyeOff className="w-6 h-6 text-[#635BFF]" />,
      title: 'Cryptographic Identity Shielding',
      description:
        'Teams submit their technical solutions. All identifying markers—team names, member bios, universities, and company affiliations—are scrubbed. Every idea is assigned a clean anonymous identifier (e.g. IDEA A01).',
      badge: 'Zero Bias',
    },
    {
      num: '02',
      icon: <Coins className="w-6 h-6 text-[#F5B942]" />,
      title: 'Virtual Coin Allocation',
      description:
        'Every verified participant receives an identical wallet containing 100 virtual coins. These are not ordinary survey votes; they represent limited strategic capital that forces real trade-off evaluation.',
      badge: 'Constrained Capital',
    },
    {
      num: '03',
      icon: <Shield className="w-6 h-6 text-[#22C7A9]" />,
      title: 'The Investment Arena',
      description:
        'Participants analyze the problem statements, architectural moats, and impact metrics. Capital is deployed between 10 to 50 coins per idea. Self-investment is strictly forbidden by server-side protocol.',
      badge: 'Strategic Backing',
    },
    {
      num: '04',
      icon: <Trophy className="w-6 h-6 text-[#635BFF]" />,
      title: 'The Grand Reveal Ceremony',
      description:
        'When the arena timer expires, all investments lock. Administrators trigger the theatrical reveal sequence: podium winners are unmasked, revealing the teams, members, and breakthrough solutions.',
      badge: 'The Moment of Truth',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
      <LandingNav />

      <main className="flex-1 py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <Badge variant="live-purple" size="sm" className="mb-4">
            TOURNAMENT PROTOCOL
          </Badge>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl text-slate-900 tracking-tight">
            How Pitch and Prosper Works
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Pitch and Prosper by CSEA transforms innovation evaluation from a superficial popularity contest
            into a high-stakes, merit-first investment marketplace.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          {steps.map((step) => (
            <div
              key={step.num}
              className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="font-display font-black text-3xl text-slate-300 group-hover:text-[#635BFF] transition-colors">
                    {step.num}
                  </span>
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                    {step.icon}
                  </div>
                </div>

                <Badge variant="track" className="mb-3">
                  {step.badge}
                </Badge>
                <h3 className="font-display font-bold text-2xl text-slate-900 mb-3">
                  {step.title}
                </h3>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  {step.description}
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-slate-400">
                <CheckCircle2 className="w-4 h-4 text-[#22C7A9]" />
                <span>Verified Protocol Standard</span>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Box */}
        <div className="bg-[#111827] text-white rounded-3xl p-10 sm:p-12 text-center max-w-4xl mx-auto shadow-2xl">
          <h2 className="font-display font-black text-3xl sm:text-4xl mb-4">
            Experience the Arena in Real Time
          </h2>
          <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto mb-8">
            Step into the arena with 100 virtual coins and discover the breakthrough ideas.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href={arenaDestination}>
              <Button variant="primary" size="lg" pill iconRight={<ArrowRight className="w-4 h-4" />}>
                Enter Investment Arena
              </Button>
            </Link>
            <Link href="/rules">
              <Button variant="secondary" size="lg" pill>
                View Tournament Rules
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
