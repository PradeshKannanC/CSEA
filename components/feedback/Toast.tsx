"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, description, duration = 4000 }: Omit<ToastItem, 'id'>) => {
      setToasts((prev) => {
        // Prevent stacking duplicate toasts with identical title & description
        const isDuplicate = prev.some(
          (t) => t.title === title && t.description === description
        );
        if (isDuplicate) return prev;

        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newToast: ToastItem = { id, type, title, description, duration };

        if (duration > 0) {
          setTimeout(() => {
            removeToast(id);
          }, duration);
        }

        return [...prev, newToast];
      });
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      {/* Toast container */}
      <div
        aria-live="polite"
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
              className="pointer-events-auto bg-white/95 backdrop-blur-md text-slate-900 border border-slate-100 rounded-2xl p-4 shadow-[0_12px_32px_rgba(0,0,0,0.12)] flex items-start gap-3 relative overflow-hidden"
            >
              {/* Type indicator icon */}
              <div className="shrink-0 mt-0.5">
                {toast.type === 'success' && (
                  <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                )}
                {toast.type === 'error' && (
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                )}
                {toast.type === 'info' && (
                  <Info className="w-5 h-5 text-[#635BFF]" />
                )}
                {toast.type === 'warning' && (
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                )}
              </div>

              {/* Message */}
              <div className="flex-1 pr-4">
                <h4 className="text-sm font-bold text-slate-900 tracking-tight leading-snug">
                  {toast.title}
                </h4>
                {toast.description && (
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {toast.description}
                  </p>
                )}
              </div>

              {/* Dismiss button */}
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 text-slate-400 hover:text-slate-700 transition-colors p-1 -mr-1 rounded-lg hover:bg-slate-100 focus:outline-none"
                aria-label="Dismiss toast"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Progress bar */}
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: (toast.duration || 4000) / 1000, ease: 'linear' }}
                className={`absolute bottom-0 left-0 h-0.5 ${
                  toast.type === 'success'
                    ? 'bg-[#16A34A]'
                    : toast.type === 'error'
                    ? 'bg-rose-500'
                    : 'bg-[#635BFF]'
                }`}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  const { showToast } = context;

  return useMemo(
    () => ({
      success: (title: string, description?: string) =>
        showToast({ type: 'success', title, description }),
      error: (title: string, description?: string) =>
        showToast({ type: 'error', title, description }),
      info: (title: string, description?: string) =>
        showToast({ type: 'info', title, description }),
      warning: (title: string, description?: string) =>
        showToast({ type: 'warning', title, description }),
    }),
    [showToast]
  );
}
