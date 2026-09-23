"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';
import { CoinIcon } from '@/components/brand/CoinIcon';
import { Button } from '@/components/ui/Button';

interface InvestmentConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  ideaAnonymousId: string;
  amount: number;
  currentBalance: number;
  isLoading?: boolean;
  minInvestment?: number;
  maxInvestment?: number;
}

export const InvestmentConfirmModal: React.FC<InvestmentConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  ideaAnonymousId,
  amount,
  currentBalance,
  isLoading = false,
  minInvestment,
  maxInvestment,
}) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const afterBalance = Math.max(0, currentBalance - amount);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className="relative bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl max-w-[min(calc(100vw-2rem),28rem)] w-full max-h-[90dvh] overflow-y-auto border border-slate-100 z-10"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-[#635BFF] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display font-bold text-lg sm:text-xl text-slate-900 truncate">
                Confirm Capital Deployment
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Target Opportunity: <span className="font-bold text-slate-800">{ideaAnonymousId}</span>
              </p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3 mb-5 sm:mb-6">
            <div className="flex justify-between items-center text-xs sm:text-sm">
              <span className="text-slate-600 font-medium">Investment Amount</span>
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <CoinIcon size={16} />
                <span>{amount} coins</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs sm:text-sm">
              <span className="text-slate-600 font-medium">Current Balance</span>
              <span className="font-semibold text-slate-700">{currentBalance} coins</span>
            </div>

            <div className="pt-2 border-t border-slate-200/80 flex justify-between items-center text-xs sm:text-sm">
              <span className="text-slate-900 font-bold">Remaining After Investment</span>
              <span className="font-bold text-[#0F9D82]">{afterBalance} coins</span>
            </div>

            {minInvestment !== undefined && maxInvestment !== undefined && (
              <div className="text-[10px] text-slate-400 font-medium text-center pt-1">
                Active Governance Bounds: Min {minInvestment} • Max {maxInvestment} Coins
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
            <Button
              variant="secondary"
              size="md"
              pill
              onClick={onClose}
              disabled={isLoading}
              className="w-full sm:flex-1 justify-center min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              pill
              onClick={onConfirm}
              isLoading={isLoading}
              className="w-full sm:flex-1 justify-center min-h-[44px]"
              iconRight={<ArrowRight className="w-4 h-4" />}
            >
              Confirm Investment
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
