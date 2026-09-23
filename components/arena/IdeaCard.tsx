"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Idea } from '@/lib/types';
import { useVentura } from '@/lib/store';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CoinToken } from '@/components/brand/CoinToken';
import { Minus, Plus, Shield, CheckCircle2, Lock, AlertCircle } from 'lucide-react';
import { EASE_PREMIUM } from '@/lib/motion';

interface IdeaCardProps {
  idea: Idea;
  onInvestRequest: (idea: Idea, amount: number) => void;
  isDetailedView?: boolean;
  isProcessing?: boolean;
  isHighlighted?: boolean;
}

export const IdeaCard: React.FC<IdeaCardProps> = ({
  idea,
  onInvestRequest,
  isDetailedView = false,
  isProcessing = false,
  isHighlighted = false,
}) => {
  const { currentUser, getUserTeam, getUserInvestments, eventConfig, wallet } = useVentura();
  const availableCoins = wallet.availableCoins ?? wallet.remaining ?? 0;
  const minInvestment = currentUser.roomMinInvestment ?? eventConfig.minPerIdea;
  const configuredMax = currentUser.roomMaxInvestment ?? eventConfig.maxPerIdea;
  const effectiveMax = Math.min(configuredMax, availableCoins);
  const isInsufficientForMin = availableCoins < minInvestment;

  const [selectedAmount, setSelectedAmount] = useState<number>(() => {
    if (availableCoins < minInvestment) return availableCoins;
    return minInvestment;
  });
  const [inputValue, setInputValue] = useState<string>(() => {
    if (availableCoins < minInvestment) return String(availableCoins);
    return String(minInvestment);
  });

  // Dynamic clamping when Admin updates limits in real-time
  React.useEffect(() => {
    if (isInsufficientForMin) {
      setSelectedAmount(availableCoins);
      setInputValue(String(availableCoins));
      return;
    }

    setSelectedAmount((prev) => {
      let next = prev;
      if (next < minInvestment) next = minInvestment;
      if (next > effectiveMax) next = effectiveMax;
      setInputValue(String(next));
      return next;
    });
  }, [minInvestment, effectiveMax, isInsufficientForMin, availableCoins]);

  const dynamicPresets = React.useMemo(() => {
    const min = minInvestment;
    const max = configuredMax;
    const mid = Math.round((min + max) / 2);
    return Array.from(new Set([min, mid, max])).filter(
      (p) => p >= min && p <= effectiveMax
    );
  }, [minInvestment, configuredMax, effectiveMax]);

  const userTeam = getUserTeam(currentUser.id);
  const isOwnTeamIdea = Boolean(userTeam && userTeam.id === idea.teamId);

  // Check if current user has already invested in this idea
  const userInvestments = getUserInvestments(currentUser.id);
  const myAllocations = userInvestments
    .filter((inv) => inv.ideaId === idea.id)
    .reduce((sum, inv) => sum + inv.amount, 0);

  const handleDecrement = () => {
    if (isInsufficientForMin || selectedAmount <= minInvestment) return;
    setSelectedAmount((prev) => {
      const next = Math.max(minInvestment, prev - 10);
      setInputValue(String(next));
      return next;
    });
  };

  const handleIncrement = () => {
    if (isInsufficientForMin || selectedAmount >= effectiveMax) return;
    setSelectedAmount((prev) => {
      const next = Math.min(effectiveMax, prev + 10);
      setInputValue(String(next));
      return next;
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = e.target.value.replace(/\D/g, '');
    setInputValue(sanitized);

    if (sanitized !== '') {
      const parsed = parseInt(sanitized, 10);
      if (!isNaN(parsed)) {
        setSelectedAmount(parsed);
      }
    }
  };

  const handleInputBlur = () => {
    if (isInsufficientForMin) {
      setSelectedAmount(wallet.remaining);
      setInputValue(String(wallet.remaining));
      return;
    }

    let parsed = parseInt(inputValue, 10);
    if (isNaN(parsed) || parsed < minInvestment) {
      parsed = minInvestment;
    } else if (parsed > effectiveMax) {
      parsed = effectiveMax;
    }
    setSelectedAmount(parsed);
    setInputValue(String(parsed));
  };

  // Participant investment eligibility is determined strictly by the participant's CURRENT room
  const currentRoomStatus = currentUser.roomStatus;
  const canInvest =
    currentRoomStatus === 'OPEN' ||
    (currentUser.role === 'ADMIN' &&
      currentRoomStatus !== 'PAUSED' &&
      currentRoomStatus !== 'CLOSED' &&
      currentRoomStatus !== 'REVEALED');
  const hasSufficientBalance =
    !isInsufficientForMin &&
    wallet.remaining >= selectedAmount &&
    selectedAmount >= minInvestment &&
    selectedAmount <= effectiveMax;

  // Under no circumstances should own team idea render in the anonymous Investment Arena
  if (isOwnTeamIdea) {
    return null;
  }

  return (
    <motion.article
      animate={
        isHighlighted
          ? {
              scale: [1, 1.015, 1],
              boxShadow: [
                '0 4px 24px rgba(0,0,0,0.03)',
                '0 12px 36px rgba(99,91,255,0.22)',
                '0 4px 24px rgba(0,0,0,0.03)',
              ],
            }
          : {}
      }
      transition={{ duration: 0.8, ease: EASE_PREMIUM }}
      className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100/90 shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_32px_rgba(0,0,0,0.06)] transition-all duration-300 p-4 sm:p-6 lg:p-8 flex flex-col justify-between group min-w-0"
    >
      {/* Top Meta Header */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <a
              href={`/investment/${idea.id}`}
              className="px-3.5 py-1.5 rounded-full bg-indigo-50 text-[#635BFF] hover:bg-indigo-100 font-display font-extrabold text-xs sm:text-sm tracking-wider border border-indigo-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF]"
              title="View full investment dossier"
            >
              {idea.anonymousId}
            </a>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {idea.track}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="tag">{idea.categoryTag}</Badge>
            {myAllocations > 0 && (
              <motion.span
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#0F9D82] bg-[#E6FBF5] px-3 py-1 rounded-full border border-[#22C7A9]/30 shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Allocated: {myAllocations}c</span>
              </motion.span>
            )}
          </div>
        </div>

        {/* Structured Innovation Sections */}
        <div className="space-y-4 text-left my-6">
          {/* Problem */}
          <div>
            <h4 className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              THE PROBLEM
            </h4>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {idea.problem}
            </p>
          </div>

          {/* Solution */}
          <div>
            <h4 className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              THE SOLUTION
            </h4>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {idea.solution}
            </p>
          </div>

          {/* Core Innovation */}
          <div>
            <h4 className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              INNOVATION
            </h4>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {idea.innovation}
            </p>
          </div>

          {/* Impact */}
          {idea.impact && (
            <div>
              <h4 className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                IMPACT
              </h4>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                {idea.impact}
              </p>
            </div>
          )}

          {/* Why Invest highlighted quote */}
          <div className="pt-2">
            <h4 className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              WHY INVEST?
            </h4>
            <blockquote className="text-xs sm:text-sm italic font-medium text-[#635BFF] bg-indigo-50/50 p-3 rounded-2xl border-l-2 border-[#635BFF] leading-relaxed">
              &ldquo;{idea.whyInvest}&rdquo;
            </blockquote>
          </div>
        </div>
      </div>

      {/* Bottom Action Area */}
      <div className="pt-6 border-t border-slate-100">
        {myAllocations > 0 ? (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-between text-emerald-800 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Already Invested in this opportunity.</span>
            </div>
            <span className="text-[11px] font-bold uppercase text-emerald-700 tracking-wider">
              {myAllocations} Coins Deployed
            </span>
          </div>
        ) : !canInvest ? (
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-slate-500 text-xs font-medium">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-400" />
              <span>
                {currentRoomStatus === 'PAUSED'
                  ? 'Arena is currently paused.'
                  : currentRoomStatus === 'CLOSED'
                  ? 'Investment is closed for this room.'
                  : currentRoomStatus === 'REVEALED'
                  ? 'Tournament results have been revealed.'
                  : 'Investment arena is not open yet.'}
              </span>
            </div>
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              Protected
            </span>
          </div>
        ) : isInsufficientForMin ? (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-between text-rose-700 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>Insufficient coins for the minimum investment.</span>
            </div>
            <span className="text-[10px] font-bold uppercase text-rose-400 tracking-wider">
              {wallet.remaining} Coins Left
            </span>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4">
            {/* Amount Stepper */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
                AMOUNT
              </span>
              <div className="inline-flex items-center bg-slate-100/90 rounded-full p-1 border border-slate-200/60">
                <button
                  type="button"
                  onClick={handleDecrement}
                  disabled={selectedAmount <= minInvestment || isInsufficientForMin || isProcessing}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-bold flex items-center justify-center shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF] cursor-pointer disabled:cursor-not-allowed"
                  aria-label="Decrease by 10 coins"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <div className="px-1 text-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    disabled={isInsufficientForMin || isProcessing}
                    className="w-12 text-center text-xs sm:text-sm font-display font-extrabold text-slate-900 bg-transparent border-none focus:outline-none tabular-nums"
                    aria-label="Investment coin amount"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleIncrement}
                  disabled={selectedAmount >= effectiveMax || isInsufficientForMin || isProcessing}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-bold flex items-center justify-center shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF] cursor-pointer disabled:cursor-not-allowed"
                  aria-label="Increase by 10 coins"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1">
                {dynamicPresets.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    disabled={isProcessing}
                    onClick={() => {
                      setSelectedAmount(amt);
                      setInputValue(String(amt));
                    }}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF] cursor-pointer ${
                      selectedAmount === amt
                        ? 'bg-[#635BFF] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Invest Button */}
            <Button
              variant="primary"
              size="md"
              pill
              disabled={!hasSufficientBalance || isProcessing || isInsufficientForMin}
              onClick={() => onInvestRequest(idea, selectedAmount)}
              className="w-full sm:w-auto shrink-0 justify-center py-2.5 sm:py-2 min-h-[44px]"
              icon={<CoinToken size="xs" />}
            >
              {isProcessing ? 'Verifying...' : `Invest ${selectedAmount} Coins`}
            </Button>
          </div>
        )}
      </div>
    </motion.article>
  );
};
