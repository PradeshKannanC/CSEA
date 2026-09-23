"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { CoinToken } from '@/components/brand/CoinToken';
import { Button } from '@/components/ui/Button';
import { NumberTicker } from '@/components/animation/NumberTicker';
import { EASE_PREMIUM } from '@/lib/motion';

interface InvestmentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  ideaAnonymousId: string;
  investedAmount: number;
  previousBalance: number;
  newBalance: number;
}

export const InvestmentSuccessModal: React.FC<InvestmentSuccessModalProps> = ({
  isOpen,
  onClose,
  ideaAnonymousId,
  investedAmount,
  previousBalance,
  newBalance,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Soft Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.35, ease: EASE_PREMIUM }}
          className="relative bg-white rounded-3xl p-6 sm:p-8 md:p-10 shadow-[0_20px_60px_rgba(17,24,39,0.14)] max-w-[min(calc(100vw-2rem),24rem)] w-full max-h-[90dvh] overflow-y-auto mx-auto text-center border border-slate-100 z-10"
        >
          {/* Refined Institutional SVG Checkmark with pathLength animation */}
          <div className="mx-auto w-16 h-16 rounded-full bg-[#E6FBF5] flex items-center justify-center border-4 border-[#C8F6EB] mb-5 shadow-[0_0_20px_rgba(34,199,169,0.25)]">
            <svg
              className="w-8 h-8 text-[#0F9D82]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <motion.path
                d="M5 13l4 4L19 7"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.45, delay: 0.15, ease: EASE_PREMIUM }}
              />
            </svg>
          </div>

          {/* Title */}
          <h3 className="font-display font-black text-2xl text-slate-900 tracking-tight mb-2">
            Investment Secured
          </h3>

          {/* Target Asset Badge */}
          <div className="inline-block mb-6">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#635BFF] bg-indigo-50 px-3.5 py-1 rounded-full border border-indigo-100">
              TARGET ASSET: {ideaAnonymousId}
            </span>
          </div>

          {/* Inner Wallet Update Card with Animated Number Ticker */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 mb-6 text-center relative overflow-hidden">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
              WALLET BALANCE UPDATE
            </span>

            {/* Previous Balance with subtle strikethrough */}
            <div className="text-xs font-semibold text-slate-400 line-through mb-1 tabular-nums">
              {previousBalance} Coins
            </div>

            {/* New Balance Animated Rolling Counter */}
            <div className="flex items-center justify-center gap-2">
              <CoinToken size="md" showGlow />
              <span className="font-display font-black text-3xl sm:text-4xl text-slate-900 tracking-tight">
                <NumberTicker
                  initialValue={previousBalance}
                  value={newBalance}
                  duration={800}
                />
              </span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider self-end mb-1">
                Coins
              </span>
            </div>

            {/* Deduction Tag */}
            <div className="mt-2 text-[11px] font-bold text-emerald-600 bg-emerald-50 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-emerald-100">
              Allocated {investedAmount} Coins
            </div>
          </div>

          {/* Confirmation Text */}
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-7">
            Strategic capital of <strong className="text-slate-900 font-bold">{investedAmount} coins</strong> has been committed to <strong className="text-slate-900 font-bold">{ideaAnonymousId}</strong>. Your cryptographic portfolio is updated.
          </p>

          {/* Return to Arena Button */}
          <Button
            variant="primary"
            size="lg"
            pill
            onClick={onClose}
            className="w-full justify-center py-3.5 shadow-md shadow-indigo-500/20"
            iconRight={<ArrowRight className="w-4 h-4" />}
          >
            Return to Arena
          </Button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
