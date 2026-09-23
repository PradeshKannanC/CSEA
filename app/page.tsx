"use client";

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { LandingNav } from '@/components/navigation/LandingNav';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CoinIcon } from '@/components/brand/CoinIcon';
import { useVentura } from '@/lib/store';
import {
  ArrowRight,
  Shield,
  Coins,
  EyeOff,
  Trophy,
  Sparkles,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';

export default function LandingPage() {
  const { ideas, wallet, eventConfig, isAuthenticated, currentUser } = useVentura();

  // Authoritative destination resolution
  const arenaDestination = !isAuthenticated
    ? '/login'
    : currentUser.role === 'ADMIN'
    ? '/admin'
    : currentUser.role === 'TEAM_LEADER' || currentUser.role === 'TEAM_MEMBER'
    ? '/team'
    : '/arena';

  const previewIdeas = ideas.slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FC] overflow-hidden">
      {/* Top Navigation */}
      <LandingNav />

      <main className="flex-1">
        {/* HERO SECTION matching landing.png */}
        <section className="relative pt-12 sm:pt-20 pb-24 px-4 sm:px-6 lg:px-8 text-center max-w-7xl mx-auto">
          {/* Subtle Ambient Background Gradients */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-[#635BFF]/10 via-[#22C7A9]/8 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

          {/* Top Pill Badge matching landing.png */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-block mb-6"
          >
            <Badge variant="live-purple" size="sm" dot>
              {eventConfig.status === 'OPEN'
                ? 'INVESTMENT ARENA LIVE'
                : `ARENA STATUS: ${eventConfig.status}`}
            </Badge>
          </motion.div>

          {/* Main Headline matching PITCH AND PROSPER specification */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="max-w-5xl mx-auto"
          >
            <div className="text-xs sm:text-sm font-bold uppercase tracking-[0.3em] text-[#635BFF] mb-3">
              CSEA PRESENTS
            </div>
            <h1 className="font-display font-black text-3xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl tracking-tight text-slate-900 leading-[1.08]">
              PITCH AND PROSPER
              <br />
              <span className="text-slate-400 font-extrabold text-xl sm:text-3xl md:text-4xl lg:text-5xl block mt-2">
                Invest in ideas. Not identities.
              </span>
            </h1>
          </motion.div>

          {/* Subtitle matching landing.png */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-4 sm:mt-8 text-sm sm:text-base md:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed font-normal px-2"
          >
            Use your virtual coins to back the innovations you believe in. Teams stay
            anonymous until the investment window closes to ensure focus on pure impact.
          </motion.p>

          {/* CTA Buttons matching landing.png */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 max-w-md sm:max-w-none mx-auto"
          >
            <Link href={arenaDestination} className="w-full sm:w-auto">
              <Button
                variant="primary"
                size="lg"
                pill
                className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base font-bold shadow-[0_8px_25px_rgba(99,91,255,0.35)] justify-center"
                iconRight={<ArrowRight className="w-5 h-5" />}
              >
                Enter Investment Arena
              </Button>
            </Link>

            <Link href="/how-it-works" className="w-full sm:w-auto">
              <Button
                variant="secondary"
                size="lg"
                pill
                className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base font-semibold justify-center"
              >
                How It Works
              </Button>
            </Link>
          </motion.div>

          {/* HERO CARDS SHOWCASE matching landing.png lower peek */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-16 sm:mt-24 relative max-w-5xl mx-auto"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              {/* Left Anonymous Idea Peek Card */}
              <div className="hidden md:block bg-white rounded-3xl p-6 border border-slate-100/90 shadow-[0_10px_30px_rgba(0,0,0,0.04)] text-left translate-y-6 opacity-90 hover:opacity-100 transition-all">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    INNOVATION TRACK
                  </span>
                  <Badge variant="tag">SUSTAINABLE</Badge>
                </div>
                <div className="font-display font-black text-lg text-slate-900 mb-2">
                  IDEA A01
                </div>
                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                  Zero-knowledge proof layer enabling verifiable green certifications while
                  keeping sensitive logistics data encrypted.
                </p>
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Cap: 50c</span>
                  <span className="text-[#635BFF] font-bold">Merit-Only</span>
                </div>
              </div>

              {/* Center Dark Investment Wallet Showcase Card */}
              <div className="bg-[#111827] text-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-slate-800 shadow-[0_20px_50px_rgba(17,24,39,0.3)] text-center relative z-10 scale-100 md:scale-105">
                <div className="inline-block mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                    CURRENT PORTFOLIO
                  </span>
                </div>
                <div className="flex items-center justify-center gap-3 my-3">
                  <CoinIcon size={38} animated />
                  <span className="font-display font-black text-4xl sm:text-5xl md:text-6xl tracking-tight text-white">
                    {wallet.remaining}
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Available virtual coins
                </span>

                <div className="mt-6 pt-5 border-t border-slate-800/90 flex justify-around text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">
                      MIN ALLOCATION
                    </span>
                    <span className="font-bold text-white mt-0.5 block">10 Coins</span>
                  </div>
                  <div className="w-px h-8 bg-slate-800" />
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">
                      MAX ALLOCATION
                    </span>
                    <span className="font-bold text-white mt-0.5 block">50 Coins</span>
                  </div>
                </div>
              </div>

              {/* Right Anonymous Idea Peek Card */}
              <div className="hidden md:block bg-white rounded-3xl p-6 border border-slate-100/90 shadow-[0_10px_30px_rgba(0,0,0,0.04)] text-left translate-y-6 opacity-90 hover:opacity-100 transition-all">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    AI & DATA TRACK
                  </span>
                  <Badge variant="tag">SCALABLE</Badge>
                </div>
                <div className="font-display font-black text-lg text-slate-900 mb-2">
                  IDEA B02
                </div>
                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                  Quantized 2-bit neural inference running locally on recycled hardware
                  without cellular handshake for off-grid healthcare clinics.
                </p>
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Cap: 50c</span>
                  <span className="text-[#635BFF] font-bold">Merit-Only</span>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* SECTION: The Psychological Model of PITCH AND PROSPER */}
        <section className="py-20 bg-white border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs font-bold uppercase tracking-widest text-[#635BFF] bg-indigo-50 px-3.5 py-1 rounded-full">
                THE PSYCHOLOGY OF MERIT
              </span>
              <h2 className="font-display font-black text-3xl sm:text-4xl text-slate-900 mt-4 tracking-tight">
                This is not ordinary voting.
                <br />
                It&apos;s capital allocation under constraints.
              </h2>
              <p className="text-slate-600 mt-4 text-base sm:text-lg">
                Traditional hackathons suffer from presentation bias and reputation skew.
                PITCH AND PROSPER by CSEA eliminates noise so you judge the innovation itself.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="bg-slate-50/80 rounded-3xl p-8 border border-slate-100 flex flex-col justify-between hover:bg-slate-50 transition-colors">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-[#635BFF] flex items-center justify-center mb-6">
                    <EyeOff className="w-6 h-6" />
                  </div>
                  <h3 className="font-display font-bold text-xl text-slate-900 mb-3">
                    Cryptographic Shielding
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Team names, member identities, institutions, and logos are completely
                    masked until the closing bell. Every idea stands solely on technical moat and impact.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-200/60 text-xs font-bold text-[#635BFF]">
                  ZERO IDENTITY BIAS
                </div>
              </div>

              {/* Feature 2 */}
              <div className="bg-slate-50/80 rounded-3xl p-8 border border-slate-100 flex flex-col justify-between hover:bg-slate-50 transition-colors">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-[#FFFBEB] text-[#D97706] flex items-center justify-center mb-6 border border-[#FDE68A]">
                    <Coins className="w-6 h-6" />
                  </div>
                  <h3 className="font-display font-bold text-xl text-slate-900 mb-3">
                    Constrained Capital
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    You have exactly 100 coins. Because your budget is finite, every coin deployed
                    represents real conviction and trade-off thinking.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-200/60 text-xs font-bold text-[#D97706]">
                  HIGH-CONVICTION BETS
                </div>
              </div>

              {/* Feature 3 */}
              <div className="bg-slate-50/80 rounded-3xl p-8 border border-slate-100 flex flex-col justify-between hover:bg-slate-50 transition-colors">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-[#E6FBF5] text-[#0F9D82] flex items-center justify-center mb-6">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <h3 className="font-display font-bold text-xl text-slate-900 mb-3">
                    The Grand Reveal
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    When the arena closes, the curtain lifts in an orchestrated theatrical ceremony.
                    Discover the minds behind the championship solutions.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-200/60 text-xs font-bold text-[#0F9D82]">
                  STAGE-READY DRAMA
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION: Live Arena Opportunities Preview */}
        <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                ACTIVE OPPORTUNITIES
              </span>
              <h2 className="font-display font-black text-3xl sm:text-4xl text-slate-900 mt-2">
                Explore Anonymous Assets
              </h2>
            </div>
            <Link href={arenaDestination}>
              <Button variant="outline" size="md" pill iconRight={<ChevronRight className="w-4 h-4" />}>
                View All {ideas.length} Arena Assets
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {previewIdeas.map((idea) => (
              <div
                key={idea.id}
                className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="px-3 py-1 rounded-full bg-indigo-50 text-[#635BFF] font-display font-extrabold text-xs">
                      {idea.anonymousId}
                    </span>
                    <Badge variant="tag">{idea.categoryTag}</Badge>
                  </div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    THE SOLUTION
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed mb-4">
                    {idea.solution}
                  </p>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs text-[#635BFF] italic font-medium">
                    &ldquo;{idea.whyInvest}&rdquo;
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">
                    Min 10 • Max 50
                  </span>
                  <Link href={arenaDestination}>
                    <Button variant="primary" size="sm" pill>
                      Invest
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION: CTA Banner */}
        <section className="py-16 bg-[#111827] text-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto">
              <Sparkles className="w-7 h-7 text-[#F5B942]" />
            </div>
            <h2 className="font-display font-black text-3xl sm:text-5xl tracking-tight">
              Ready to back the future of innovation?
            </h2>
            <p className="text-slate-400 text-base max-w-xl mx-auto">
              Log in with your credentials, check your wallet allocation, and back the most audacious ideas.
            </p>
            <div className="pt-4">
              <Link href={arenaDestination}>
                <Button variant="primary" size="lg" pill className="px-10 py-4 font-bold text-base">
                  Enter Investment Arena Now
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer matching PITCH AND PROSPER specification */}
      <footer className="bg-white border-t border-slate-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white p-0.5 border border-slate-200 shadow-xs flex items-center justify-center">
              <img
                src="/branding/tce-csea-logo.png"
                alt="TCE CSEA"
                className="w-full h-full object-contain rounded-full"
              />
            </div>
            <div className="text-left">
              <div className="font-display font-black text-sm text-slate-900 leading-tight">
                PITCH AND PROSPER <span className="text-[#635BFF] font-bold">by CSEA</span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                An Idea Investment Arena
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 sm:gap-6 text-xs text-slate-500 font-medium">
            <Link href="/how-it-works" className="hover:text-slate-900">
              How It Works
            </Link>
            <Link href="/rules" className="hover:text-slate-900">
              Tournament Rules
            </Link>
            <Link href="/faq" className="hover:text-slate-900">
              FAQ
            </Link>
            <Link href="/login" className="hover:text-slate-900">
              Participant Login
            </Link>
          </div>

          <div className="text-xs text-slate-400">
            &copy; CSEA — PITCH AND PROSPER. Identity shielded environment.
          </div>
        </div>
      </footer>
    </div>
  );
}
