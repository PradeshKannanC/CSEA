"use client";

import React, { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/navigation/DashboardNav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CoinIcon } from '@/components/brand/CoinIcon';
import { CoinToken } from '@/components/brand/CoinToken';
import { NumberTicker } from '@/components/animation/NumberTicker';
import { InvestmentConfirmModal } from '@/components/arena/InvestmentConfirmModal';
import { InvestmentSuccessModal } from '@/components/arena/InvestmentSuccessModal';
import { CoinFlightAnimation } from '@/components/brand/CoinFlightAnimation';
import { useVentura } from '@/lib/store';
import { useToast } from '@/components/feedback/Toast';
import {
  ArrowLeft,
  Shield,
  Layers,
  Sparkles,
  Lock,
  Minus,
  Plus,
  Sliders,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function IdeaDetailsPage({
  params,
}: {
  params: Promise<{ ideaId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { ideas, invest, wallet, currentUser, getUserTeam, eventConfig, investments } = useVentura();
  const toast = useToast();

  const idea = ideas.find(
    (i) =>
      i.id.toLowerCase() === resolvedParams.ideaId.toLowerCase() ||
      i.anonymousId.toLowerCase().replace(/\s+/g, '-') === resolvedParams.ideaId.toLowerCase() ||
      i.anonymousId.toLowerCase() === resolvedParams.ideaId.toLowerCase()
  );

  const minInvestment = eventConfig.minPerIdea || 10;
  const configuredMax = eventConfig.maxPerIdea || 100;
  const effectiveMax = Math.min(configuredMax, wallet.remaining);
  const isInsufficientForMin = wallet.remaining < minInvestment;

  const [amount, setAmount] = useState<number>(() => {
    if (wallet.remaining < minInvestment) return wallet.remaining;
    return minInvestment;
  });
  const [inputValue, setInputValue] = useState<string>(() => {
    if (wallet.remaining < minInvestment) return String(wallet.remaining);
    return String(minInvestment);
  });

  // Dynamic clamping when Admin updates limits or wallet changes in real-time
  React.useEffect(() => {
    if (isInsufficientForMin) {
      setAmount(wallet.remaining);
      setInputValue(String(wallet.remaining));
      return;
    }

    setAmount((prev) => {
      let next = prev;
      if (next < minInvestment) next = minInvestment;
      if (next > effectiveMax) next = effectiveMax;
      setInputValue(String(next));
      return next;
    });
  }, [minInvestment, effectiveMax, isInsufficientForMin, wallet.remaining]);

  const handleMinus = () => {
    if (isInsufficientForMin || amount <= minInvestment) return;
    setAmount((prev) => {
      const next = Math.max(minInvestment, prev - 10);
      setInputValue(String(next));
      return next;
    });
  };

  const handlePlus = () => {
    if (isInsufficientForMin || amount >= effectiveMax) return;
    setAmount((prev) => {
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
        setAmount(parsed);
      }
    }
  };

  const handleInputBlur = () => {
    if (isInsufficientForMin) {
      setAmount(wallet.remaining);
      setInputValue(String(wallet.remaining));
      return;
    }

    let parsed = parseInt(inputValue, 10);
    if (isNaN(parsed) || parsed < minInvestment) {
      parsed = minInvestment;
    } else if (parsed > effectiveMax) {
      parsed = effectiveMax;
    }
    setAmount(parsed);
    setInputValue(String(parsed));
  };
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnimatingCoins, setIsAnimatingCoins] = useState(false);
  const [successData, setSuccessData] = useState<{
    isOpen: boolean;
    prev: number;
    next: number;
    amount: number;
  }>({
    isOpen: false,
    prev: 100,
    next: 100,
    amount: 0,
  });

  if (!idea) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
        <DashboardNav />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white rounded-3xl p-10 border border-slate-100 shadow-sm max-w-md w-full">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-4" />
            <h2 className="font-display font-bold text-xl text-slate-900 mb-2">
              Opportunity Not Found
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              The requested anonymous innovation asset does not exist or has been withdrawn.
            </p>
            <Link href="/arena">
              <Button variant="primary" size="md" pill>
                Return to Arena
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const userTeam = getUserTeam(currentUser.id);
  const isOwnTeamIdea = Boolean(userTeam && userTeam.id === idea.teamId);
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
    wallet.remaining >= amount &&
    amount >= minInvestment &&
    amount <= effectiveMax;

  const handleConfirm = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    const prev = wallet.remaining;
    const amountToDeploy = amount;

    try {
      const res = await fetch('/api/invest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ideaId: idea.id,
          amount: amountToDeploy,
        }),
      });

      const data = await res.json();
      setIsProcessing(false);

      if (res.ok && data.success) {
        // Gated strictly on confirmed HTTP 200
        setIsAnimatingCoins(true);
        invest(idea.id, amountToDeploy, data.wallet);
        const newBal = data.wallet?.remaining ?? prev - amountToDeploy;
        setIsConfirmOpen(false);

        // Smooth transition to Success Modal
        setTimeout(() => {
          setSuccessData({
            isOpen: true,
            prev,
            next: newBal,
            amount: amountToDeploy,
          });
        }, 300);
      } else {
        setIsAnimatingCoins(false);
        if (data.code === 'SELF_TEAM_INVESTMENT') {
          toast.error(
            'Investment Restricted',
            'This opportunity isn\'t available to your account.'
          );
        } else {
          toast.error('Investment Rejected', data.message || 'Failed to allocate coins.');
        }
        setIsConfirmOpen(false);
      }
    } catch (err) {
      console.error('Investment request failed:', err);
      setIsProcessing(false);
      setIsAnimatingCoins(false);
      toast.error('Transaction Failed', 'Unable to reach the investment ledger server.');
      setIsConfirmOpen(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
      <DashboardNav />

      <main className="flex-1 py-6 sm:py-8 lg:py-10 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Back navigation */}
        <div className="mb-4 sm:mb-6">
          <Link
            href="/arena"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Investment Arena</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Main Idea Dossier */}
          <div className="lg:col-span-8 bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-6 sm:space-y-8">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="px-4 py-1.5 rounded-full bg-indigo-50 text-[#635BFF] font-display font-black text-lg sm:text-xl border border-indigo-100">
                    {idea.anonymousId}
                  </span>
                  <Badge variant="tag">{idea.categoryTag}</Badge>
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-2">
                  Track: {idea.track}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-[#0F9D82] bg-[#E6FBF5] px-3.5 py-1.5 rounded-full border border-[#22C7A9]/30">
                <Shield className="w-4 h-4" />
                <span>Cryptographically Shielded</span>
              </div>
            </div>

            {/* Dossier Sections */}
            <div className="space-y-6 text-left">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  THE PROBLEM STATEMENT
                </h3>
                <p className="text-slate-800 text-sm sm:text-base leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  {idea.problem}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  PROPOSED SOLUTION
                </h3>
                <p className="text-slate-800 text-sm sm:text-base leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  {idea.solution}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  CORE TECHNICAL &amp; CONCEPTUAL INNOVATION
                </h3>
                <p className="text-slate-800 text-sm sm:text-base leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  {idea.innovation}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  IMPACT &amp; SCALE METRICS
                </h3>
                <p className="text-slate-800 text-sm sm:text-base leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  {idea.impact}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  WHY INVEST? (STRATEGIC MOAT)
                </h3>
                <blockquote className="text-sm sm:text-base italic font-semibold text-[#635BFF] bg-indigo-50/70 p-5 rounded-2xl border-l-4 border-[#635BFF] leading-relaxed">
                  &ldquo;{idea.whyInvest}&rdquo;
                </blockquote>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  TECHNOLOGY STACK ARCHITECTURE
                </h3>
                <div className="flex flex-wrap gap-2">
                  {idea.techStack.split(',').map((tech, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-mono text-xs font-semibold border border-slate-200"
                    >
                      {tech.trim()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Capital Allocation Panel */}
          <div className="lg:col-span-4 w-full lg:sticky lg:top-24 space-y-5 sm:space-y-6">
            <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-slate-100 shadow-[0_12px_36px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  STRATEGIC ALLOCATION
                </span>
                <Sliders className="w-4 h-4 text-slate-400" />
              </div>

              <h3 className="font-display font-black text-xl text-slate-900 mb-1">
                Back {idea.anonymousId}
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Deploy your virtual capital based purely on merits.
              </p>

              {/* Protection & Lifecycle Checks */}
              {isOwnTeamIdea ? (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 text-xs font-medium space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <Shield className="w-4 h-4 text-slate-500" />
                    <span>Investment Unavailable</span>
                  </div>
                  <p>This opportunity isn&apos;t available to your account.</p>
                </div>
              ) : investments.some((inv) => inv.ideaId === idea.id) ? (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium space-y-3">
                  <div className="flex items-center gap-2 font-bold text-emerald-800 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>ALREADY INVESTED</span>
                  </div>
                  <p className="text-emerald-700 leading-relaxed">
                    You have deployed <strong className="text-emerald-900 font-extrabold">{investments.find((inv) => inv.ideaId === idea.id)?.amount} coins</strong> into this opportunity. Exactly one investment per opportunity is permitted in this competition room.
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/portfolio"
                      className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
                    >
                      View in My Portfolio →
                    </Link>
                  </div>
                </div>
              ) : !canInvest ? (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 text-xs font-medium">
                  <Lock className="w-4 h-4 text-slate-400 mb-1" />
                  <span>
                    {currentRoomStatus === 'PAUSED'
                      ? 'Arena is currently paused.'
                      : currentRoomStatus === 'CLOSED'
                      ? 'Investment is closed for this room.'
                      : currentRoomStatus === 'REVEALED'
                      ? 'Tournament results have been revealed.'
                      : 'The arena window is not currently open.'}
                  </span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Current Balance Row */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Available Balance</span>
                    <div className="flex items-center gap-1.5 font-extrabold text-slate-900">
                      <CoinToken size="xs" />
                      <NumberTicker value={wallet.remaining} />
                      <span>Coins</span>
                    </div>
                  </div>

                  {/* Insufficient Balance Banner */}
                  {isInsufficientForMin && (
                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                      <span>Insufficient coins for the minimum investment.</span>
                    </div>
                  )}

                  {/* Amount Stepper & Manual Input */}
                  <div>
                    <div className="flex justify-between items-center text-xs mb-2">
                      <span className="font-bold text-slate-700 uppercase tracking-wider">
                        Allocation Amount
                      </span>
                      <span className="text-slate-400 font-medium">
                        Min {minInvestment} • Max {effectiveMax} Coins
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-2xl bg-slate-100/90 border border-slate-200">
                      <button
                        type="button"
                        onClick={handleMinus}
                        disabled={amount <= minInvestment || isInsufficientForMin || isProcessing}
                        className="w-10 h-10 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-800 font-bold flex items-center justify-center shadow-sm cursor-pointer disabled:cursor-not-allowed transition-all"
                        aria-label="Decrease by 10 coins"
                      >
                        <Minus className="w-4 h-4" />
                      </button>

                      <div className="flex items-center justify-center flex-1 px-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={inputValue}
                          onChange={handleInputChange}
                          onBlur={handleInputBlur}
                          disabled={isInsufficientForMin || isProcessing}
                          className="w-24 text-center font-display font-black text-2xl text-slate-900 bg-transparent border-b-2 border-transparent hover:border-slate-300 focus:border-[#635BFF] focus:outline-none tabular-nums transition-colors"
                          aria-label="Investment coin amount"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handlePlus}
                        disabled={amount >= effectiveMax || isInsufficientForMin || isProcessing}
                        className="w-10 h-10 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-800 font-bold flex items-center justify-center shadow-sm cursor-pointer disabled:cursor-not-allowed transition-all"
                        aria-label="Increase by 10 coins"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Range Slider for fluid visual adjustment */}
                    <div className="mt-4 px-1">
                      <input
                        type="range"
                        min={minInvestment}
                        max={Math.max(minInvestment, effectiveMax)}
                        step={1}
                        value={Math.min(effectiveMax, Math.max(minInvestment, amount))}
                        disabled={isInsufficientForMin || isProcessing}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setAmount(val);
                          setInputValue(String(val));
                        }}
                        className="w-full accent-[#635BFF] cursor-pointer disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Action CTA */}
                  <Button
                    variant="primary"
                    size="lg"
                    pill
                    disabled={!hasSufficientBalance || isProcessing || isInsufficientForMin}
                    onClick={() => setIsConfirmOpen(true)}
                    className="w-full justify-center py-4 font-bold text-base shadow-[0_8px_24px_rgba(99,91,255,0.4)] disabled:opacity-50 disabled:shadow-none"
                    icon={<CoinToken size="sm" />}
                  >
                    {isProcessing ? 'Verifying...' : `Deploy ${amount} Coins`}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Confirmation Modal */}
      <InvestmentConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirm}
        ideaAnonymousId={idea.anonymousId}
        amount={amount}
        currentBalance={wallet.remaining}
        isLoading={isProcessing}
        minInvestment={eventConfig.minPerIdea}
        maxInvestment={eventConfig.maxPerIdea}
      />

      {/* Subtle Coin Flight Transition Animation */}
      <CoinFlightAnimation
        isActive={isAnimatingCoins}
        amount={amount}
      />

      {/* Success Modal */}
      <InvestmentSuccessModal
        isOpen={successData.isOpen}
        onClose={() => {
          setSuccessData((p) => ({ ...p, isOpen: false }));
          router.push('/arena');
        }}
        ideaAnonymousId={idea.anonymousId}
        investedAmount={successData.amount}
        previousBalance={successData.prev}
        newBalance={successData.next}
      />
    </div>
  );
}
