"use client";

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ShieldAlert, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm Action',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isLoading = false,
}) => {
  useEffect(() => {
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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className="relative bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl max-w-[min(calc(100vw-2rem),28rem)] w-full max-h-[90dvh] overflow-y-auto border border-slate-100 z-10"
        >
          <div className="flex items-start gap-3.5 sm:gap-4 mb-4">
            <div
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                isDestructive
                  ? 'bg-rose-50 text-rose-600 border border-rose-100'
                  : 'bg-amber-50 text-amber-600 border border-amber-100'
              }`}
            >
              {isDestructive ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>

            <div className="min-w-0">
              <h3 className="font-display font-bold text-base sm:text-xl text-slate-900 leading-tight">
                {title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mt-1.5 sm:mt-2">
                {description}
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 mt-6 pt-4 border-t border-slate-100">
            <Button
              variant="secondary"
              size="md"
              pill
              onClick={onClose}
              disabled={isLoading}
              className="w-full sm:w-auto px-5 min-h-[44px] justify-center"
            >
              {cancelLabel}
            </Button>

            <Button
              variant={isDestructive ? 'danger' : 'primary'}
              size="md"
              pill
              onClick={onConfirm}
              isLoading={isLoading}
              className="w-full sm:w-auto px-5 min-h-[44px] justify-center"
            >
              {confirmLabel}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
