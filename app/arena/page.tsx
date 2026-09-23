"use client";

import React, { useState } from 'react';
import { DashboardNav } from '@/components/navigation/DashboardNav';
import { IdeaCard } from '@/components/arena/IdeaCard';
import { WalletCard } from '@/components/arena/WalletCard';
import { InvestmentConfirmModal } from '@/components/arena/InvestmentConfirmModal';
import { InvestmentSuccessModal } from '@/components/arena/InvestmentSuccessModal';
import { CoinFlightAnimation } from '@/components/brand/CoinFlightAnimation';
import { useVentura } from '@/lib/store';
import { useToast } from '@/components/feedback/Toast';
import { Idea } from '@/lib/types';
import { Filter, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function InvestmentArenaPage() {
  const { ideas, invest, wallet, eventConfig, currentUser, arenaDiagnostics, refreshData } = useVentura();
  const toast = useToast();

  React.useEffect(() => {
    refreshData();
  }, [refreshData]);

  const [selectedTrack, setSelectedTrack] = useState<string>('ALL');
  const [activeIdeaForConfirm, setActiveIdeaForConfirm] = useState<Idea | null>(null);
  const [confirmAmount, setConfirmAmount] = useState<number>(10);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnimatingCoins, setIsAnimatingCoins] = useState(false);
  const [recentlyInvestedIdeaId, setRecentlyInvestedIdeaId] = useState<string | null>(null);

  // Success modal state
  const [successModalData, setSuccessModalData] = useState<{
    isOpen: boolean;
    ideaAnonymousId: string;
    amount: number;
    prevBalance: number;
    newBalance: number;
  }>({
    isOpen: false,
    ideaAnonymousId: '',
    amount: 0,
    prevBalance: 100,
    newBalance: 100,
  });

  const tracks = ['ALL', 'INNOVATION TRACK', 'AI & DATA TRACK', 'PRIVACY & SECURITY', 'CLEANTECH TRACK'];

  const filteredIdeas = selectedTrack === 'ALL'
    ? ideas
    : ideas.filter((i) => i.track.toLowerCase().includes(selectedTrack.toLowerCase()));

  const effectiveStatus = currentUser.role === 'ADMIN'
    ? (currentUser.roomStatus || 'OPEN')
    : (currentUser.roomId ? (currentUser.roomStatus || 'DRAFT') : 'NO_ROOM');

  const handleInvestRequest = (idea: Idea, amount: number) => {
    if (effectiveStatus !== 'OPEN') {
      if (effectiveStatus === 'PAUSED') {
        toast.error(
          'Arena Paused',
          'Investment is temporarily paused in your room.'
        );
      } else if (effectiveStatus === 'CLOSED') {
        toast.error(
          'Investment Closed',
          'The investment window for your room has closed.'
        );
      } else if (effectiveStatus === 'REVEALED') {
        toast.info(
          'Results Revealed',
          'The competition results have been revealed. View winners on the Results page.'
        );
      } else {
        toast.error(
          'Arena Not Open',
          'Next arena is being prepared. Investment opportunities will unlock shortly.'
        );
      }
      return;
    }
    setActiveIdeaForConfirm(idea);
    setConfirmAmount(amount);
  };

  const handleConfirmInvestment = async () => {
    if (!activeIdeaForConfirm || isProcessing) return;

    setIsProcessing(true);
    const prevBal = wallet.remaining;
    const targetIdea = activeIdeaForConfirm;
    const amountToDeploy = confirmAmount;

    try {
      const res = await fetch('/api/invest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ideaId: targetIdea.id,
          amount: amountToDeploy,
        }),
      });

      const data = await res.json();
      setIsProcessing(false);

      if (res.ok && data.success) {
        // Authoritative 200 OK received: trigger signature animation
        setIsAnimatingCoins(true);
        setRecentlyInvestedIdeaId(targetIdea.id);
        setTimeout(() => setRecentlyInvestedIdeaId(null), 2500);

        // Update local store wallet
        invest(targetIdea.id, amountToDeploy, data.wallet);
        const newBal = data.wallet?.remaining ?? prevBal - amountToDeploy;
        setActiveIdeaForConfirm(null);

        // Display Success Modal with animated ticker after short flight initiation
        setTimeout(() => {
          setSuccessModalData({
            isOpen: true,
            ideaAnonymousId: targetIdea.anonymousId,
            amount: amountToDeploy,
            prevBalance: prevBal,
            newBalance: newBal,
          });
        }, 350);
      } else {
        setIsAnimatingCoins(false);
        if (data.code === 'SELF_TEAM_INVESTMENT' || data.code === 'OWN_TEAM_INVESTMENT_FORBIDDEN') {
          toast.error(
            'Investment Restricted',
            'You cannot invest in your own team\'s idea.'
          );
        } else {
          toast.error('Investment Rejected', data.message || 'Failed to process allocation.');
        }
        setActiveIdeaForConfirm(null);
      }
    } catch (err) {
      console.error('Investment request failed:', err);
      setIsProcessing(false);
      setIsAnimatingCoins(false);
      toast.error('Transaction Failed', 'Unable to reach the investment ledger server.');
      setActiveIdeaForConfirm(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
      <DashboardNav />

      <main className="flex-1 py-6 sm:py-8 lg:py-10 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Arena Header matching PITCH AND PROSPER ARENA */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-[#635BFF] mb-1">
                PITCH AND PROSPER by CSEA
              </div>
              <h1 className="font-display font-black text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight">
                PITCH AND PROSPER ARENA
              </h1>
            </div>

            {currentUser.roomName && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-50 border border-purple-200/80 text-[#635BFF] shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#635BFF] animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Assigned Arena: {currentUser.roomName} {currentUser.roomCode ? `(${currentUser.roomCode})` : ''}
                </span>
              </div>
            )}
          </div>
          <p className="mt-1 text-xs sm:text-sm md:text-base text-slate-600 font-normal">
            Anonymized opportunities. Pure strategic allocation based on merit.
          </p>
        </div>

        {/* Room Status Banners */}
        {!currentUser.roomId && currentUser.role !== 'ADMIN' ? (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-900">
                NO COMPETITION ROOM ASSIGNED
              </p>
              <p className="text-[11px] text-amber-700">
                Your team is not currently assigned to any competition room. Please contact the administrator.
              </p>
            </div>
          </div>
        ) : effectiveStatus === 'PAUSED' ? (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <div>
              <p className="text-xs font-black text-amber-950 uppercase tracking-wide">
                INVESTMENT PAUSED
              </p>
              <p className="text-xs text-amber-800">
                Investment is temporarily paused in your room.
              </p>
            </div>
          </div>
        ) : effectiveStatus === 'CLOSED' ? (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
            <div>
              <p className="text-xs font-black text-rose-950 uppercase tracking-wide">
                INVESTMENT CLOSED
              </p>
              <p className="text-xs text-rose-800">
                Investment has ended for your room.
              </p>
            </div>
          </div>
        ) : effectiveStatus === 'REVEALED' ? (
          <div className="mb-6 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-purple-50 border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#635BFF] animate-pulse shrink-0" />
              <div>
                <p className="text-xs font-black text-purple-950 uppercase tracking-wide">
                  RESULTS REVEALED
                </p>
                <p className="text-xs text-purple-800">
                  Results are now available.
                </p>
              </div>
            </div>
            <a
              href="/results"
              className="inline-flex items-center justify-center px-4 py-2 rounded-full text-xs font-bold bg-[#635BFF] text-white hover:bg-[#5046E5] transition-colors"
            >
              View Results →
            </a>
          </div>
        ) : effectiveStatus === 'DRAFT' ? (
          <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-400 animate-pulse shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                ARENA NOT STARTED
              </p>
              <p className="text-xs text-slate-600">
                You are assigned to {currentUser.roomName || 'your competition room'}. The investment arena has not started yet.
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/70 flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-xs font-bold text-emerald-900 tracking-wide uppercase">
              INVESTMENT ARENA IS LIVE
            </span>
          </div>
        )}

        {/* Track Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 sm:mb-8 scrollbar-none touch-pan-x">
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 mr-1 sm:mr-2 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            Tracks:
          </span>
          {tracks.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTrack(t)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all shrink-0 ${
                selectedTrack === t
                  ? 'bg-[#111827] text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Arena Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column: Idea Cards */}
          <div className="lg:col-span-8 space-y-4 sm:space-y-6">
            {effectiveStatus !== 'OPEN' ? (
              <div className="bg-white rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center border border-slate-100 shadow-sm">
                <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <h3 className="font-display font-bold text-base sm:text-lg text-slate-900 mb-1">
                  {effectiveStatus === 'DRAFT'
                    ? 'ARENA NOT STARTED'
                    : effectiveStatus === 'PAUSED'
                    ? 'INVESTMENT PAUSED'
                    : effectiveStatus === 'CLOSED'
                    ? 'INVESTMENT CLOSED'
                    : effectiveStatus === 'REVEALED'
                    ? 'RESULTS REVEALED'
                    : 'ARENA UNAVAILABLE'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-4">
                  {effectiveStatus === 'DRAFT'
                    ? `You are assigned to ${currentUser.roomName || 'your competition room'}. The investment arena has not started yet.`
                    : effectiveStatus === 'PAUSED'
                    ? 'Investment is temporarily paused in your room.'
                    : effectiveStatus === 'CLOSED'
                    ? 'Investment has ended for your room.'
                    : effectiveStatus === 'REVEALED'
                    ? 'Results are now available.'
                    : effectiveStatus === 'NO_ROOM'
                    ? (currentUser.teamName ? `Team "${currentUser.teamName}" is not currently assigned to any competition room. Investment opportunities will unlock when your room is configured.` : 'Your account is not currently assigned to any competition room.')
                    : 'Investment is currently locked.'}
                </p>
                {effectiveStatus === 'REVEALED' && (
                  <a
                    href="/results"
                    className="inline-flex items-center px-4 py-2 rounded-full text-xs font-bold bg-[#635BFF] text-white hover:bg-[#5046E5] transition-colors"
                  >
                    View Results →
                  </a>
                )}
              </div>
            ) : ideas.length === 0 ? (
              <div className="bg-white rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center border border-slate-100 shadow-sm">
                {arenaDiagnostics?.emptyReason === 'ALL_IDEAS_INVESTED' ? (
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                ) : (
                  <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                )}
                <h3 className="font-display font-bold text-base sm:text-lg text-slate-900 mb-1">
                  {arenaDiagnostics?.emptyReason === 'ALL_IDEAS_INVESTED'
                    ? 'ALL OPPORTUNITIES BACKED'
                    : 'NO INVESTABLE IDEAS YET'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto mb-3">
                  {arenaDiagnostics?.emptyReason === 'ALL_IDEAS_INVESTED'
                    ? 'You have deployed capital into all available opportunities in your room. Review your allocations in your portfolio.'
                    : arenaDiagnostics?.emptyReason === 'NO_OTHER_TEAMS'
                    ? 'Investment requires at least two participating teams with approved ideas. Your room currently has no other teams assigned.'
                    : arenaDiagnostics?.emptyReason === 'AWAITING_APPROVAL'
                    ? 'Other ideas in this room are currently awaiting organizer approval.'
                    : arenaDiagnostics?.emptyReason === 'NO_INVESTABLE_IDEAS'
                    ? 'Your team\'s idea cannot receive investment from your own team.'
                    : arenaDiagnostics?.emptyReason === 'NO_ROOM'
                    ? 'No competition room is currently assigned to your team.'
                    : 'This room currently does not have another approved idea available for investment.'}
                </p>
                {arenaDiagnostics?.emptyReason === 'ALL_IDEAS_INVESTED' && (
                  <div className="mb-4">
                    <a
                      href="/portfolio"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-[#635BFF] text-white hover:bg-[#5046E5] transition-colors"
                    >
                      View Portfolio →
                    </a>
                  </div>
                )}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-[11px] font-mono text-slate-600">
                  <span>Room: {currentUser.roomName || 'Active'}</span>
                  <span>•</span>
                  <span>Teams: {arenaDiagnostics?.roomTeamsCount ?? 0}</span>
                  <span>•</span>
                  <span>Approved: {arenaDiagnostics?.approvedIdeasCount ?? 0}</span>
                  <span>•</span>
                  <span>Investable: 0</span>
                </div>
              </div>
            ) : filteredIdeas.length === 0 ? (
              <div className="bg-white rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center border border-slate-100 shadow-sm">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <h3 className="font-display font-bold text-base sm:text-lg text-slate-900 mb-1">
                  No opportunities in this track
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Select another track to browse available anonymous innovations.
                </p>
                <button
                  onClick={() => setSelectedTrack('ALL')}
                  className="text-xs font-bold text-[#635BFF] hover:underline cursor-pointer"
                >
                  View All Opportunities
                </button>
              </div>
            ) : (
              filteredIdeas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onInvestRequest={handleInvestRequest}
                  isProcessing={isProcessing}
                  isHighlighted={recentlyInvestedIdeaId === idea.id}
                />
              ))
            )}
          </div>

          {/* Right Column: Wallet & Allocations */}
          <div className="lg:col-span-4 w-full lg:sticky lg:top-24">
            <WalletCard />
          </div>
        </div>
      </main>

      {/* Confirmation Modal */}
      {activeIdeaForConfirm && (
        <InvestmentConfirmModal
          isOpen={Boolean(activeIdeaForConfirm)}
          onClose={() => setActiveIdeaForConfirm(null)}
          onConfirm={handleConfirmInvestment}
          ideaAnonymousId={activeIdeaForConfirm.anonymousId}
          amount={confirmAmount}
          currentBalance={wallet.remaining}
          isLoading={isProcessing}
          minInvestment={currentUser.roomMinInvestment ?? eventConfig.minPerIdea}
          maxInvestment={currentUser.roomMaxInvestment ?? eventConfig.maxPerIdea}
        />
      )}

      {/* Signature Coin Flight Animation (Authoritatively gated upon HTTP 200) */}
      <CoinFlightAnimation
        isActive={isAnimatingCoins}
        onComplete={() => setIsAnimatingCoins(false)}
        amount={confirmAmount}
      />

      {/* Success Modal */}
      <InvestmentSuccessModal
        isOpen={successModalData.isOpen}
        onClose={() => setSuccessModalData((prev) => ({ ...prev, isOpen: false }))}
        ideaAnonymousId={successModalData.ideaAnonymousId}
        investedAmount={successModalData.amount}
        previousBalance={successModalData.prevBalance}
        newBalance={successModalData.newBalance}
      />
    </div>
  );
}
