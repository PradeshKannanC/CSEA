"use client";

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { VenturaLogo } from '@/components/brand/VenturaLogo';
import { Hourglass, Lock, ShieldCheck, ArrowRight } from 'lucide-react';
import { useVentura } from '@/lib/store';

export default function InvestmentClosedPage() {
  const { eventConfig, currentUser, isAuthenticated } = useVentura();

  const arenaDestination = !isAuthenticated || !currentUser
    ? '/login'
    : currentUser.role === 'ADMIN'
      ? '/admin'
      : (currentUser.role === 'TEAM_LEADER' || currentUser.role === 'TEAM_MEMBER')
        ? '/team'
        : '/dashboard';

  const resultsDestination = !isAuthenticated || !currentUser ? '/login' : '/results';

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-b from-[#0B0F19] via-[#0F172A] to-[#111827] text-white select-none px-3 sm:px-6 lg:px-8 py-6 sm:py-10 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[450px] bg-[#635BFF]/12 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar matching screenshot */}
      <div className="flex flex-col items-center gap-4 sm:gap-6 relative z-20">
        {currentUser?.role === 'ADMIN' && (
          <div className="w-full max-w-xl mx-auto p-3 rounded-2xl bg-[#1E293B]/80 border border-indigo-500/40 backdrop-blur-md flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-300">Viewing participant Closed screen as Administrator</span>
            <Link
              href="/admin"
              className="px-3.5 py-1.5 rounded-full bg-[#635BFF] hover:bg-[#5046E5] text-white font-bold transition-all shrink-0 flex items-center gap-1.5"
            >
              <span>← Back to Control Center</span>
            </Link>
          </div>
        )}

        {/* Status Pill matching investment-closed.png */}
        <div className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-[10px] sm:text-[11px] font-bold tracking-wider text-rose-400">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span className="uppercase">
            ARENA STATUS: {eventConfig.status === 'CLOSED' ? 'TERMINATED' : eventConfig.status}
          </span>
        </div>

        {/* Logo in dark mode */}
        <VenturaLogo theme="dark" href="/" />
      </div>

      {/* Center Stage matching investment-closed.png */}
      <main className="text-center max-w-2xl mx-auto py-8 sm:py-12 relative z-10 px-2">
        {/* Giant Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="font-display font-black text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight text-white leading-tight"
        >
          Investment
          <br />
          Closed
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-6 text-sm sm:text-base text-slate-400 max-w-lg mx-auto leading-relaxed"
        >
          All investments have been locked. The transaction ledger is being finalized for the official reveal.
        </motion.p>

        {/* Center Glass Card matching screenshot */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 bg-[#1E293B]/60 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl max-w-md mx-auto"
        >
          {/* Hourglass Icon */}
          <div className="w-14 h-14 rounded-2xl bg-[#635BFF]/20 text-[#635BFF] flex items-center justify-center mx-auto mb-4 border border-[#635BFF]/30">
            <Hourglass className="w-7 h-7" />
          </div>

          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
            CURRENT PHASE
          </span>

          <h3 className="font-display font-black text-xl sm:text-2xl text-white tracking-tight mb-4">
            {eventConfig.status === 'DRAFT'
              ? 'Next arena is being prepared.'
              : eventConfig.status === 'OPEN'
              ? 'Investment Arena is Live!'
              : 'Awaiting Admin Reveal'}
          </h3>

          {/* Glowing teal-to-purple progress bar matching screenshot */}
          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mb-4 relative">
            <div className="w-full h-full bg-gradient-to-r from-[#22C7A9] via-[#635BFF] to-[#22C7A9] animate-pulse" />
          </div>

          <p className="text-xs text-slate-400">
            {eventConfig.status === 'DRAFT'
              ? 'A new investment cycle has been initialized. The arena will unlock once launched.'
              : eventConfig.status === 'OPEN'
              ? 'Virtual trading is now open. Deploy your capital to high-merit proposals.'
              : 'Results are verified and ready for the stage.'}
          </p>
        </motion.div>

        {/* Navigation jump if OPEN */}
        {eventConfig.status === 'OPEN' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8"
          >
            <Link
              href={arenaDestination}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#22C7A9] text-slate-900 font-bold text-sm shadow-[0_4px_20px_rgba(34,199,169,0.4)] hover:bg-[#1eb69a] transition-all"
            >
              <span>The Arena is Live! Enter Investment Arena</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        )}

        {/* Navigation jump if revealed */}
        {eventConfig.status === 'REVEALED' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8"
          >
            <Link
              href={resultsDestination}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#635BFF] text-white font-bold text-sm shadow-[0_4px_20px_rgba(99,91,255,0.4)] hover:bg-[#5046E5] transition-all"
            >
              <span>The Results Are In! Enter Ceremony</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        )}
      </main>

      {/* Bottom Footer matching screenshot */}
      <footer className="w-full max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500 font-medium">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#22C7A9]" />
          <span>SESSION ENCRYPTED</span>
        </div>

        <div className="text-center text-slate-400">
          Your participation data has been securely saved.
        </div>

        <div>
          &copy; CSEA — PITCH AND PROSPER
        </div>
      </footer>
    </div>
  );
}
